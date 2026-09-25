import { computed, getCurrentInstance, nextTick, onUnmounted, provide, reactive, ref, shallowReactive, shallowRef, useId, watch, type ComputedRef, type WatchStopHandle } from 'vue'
import { toast } from 'vue-sonner'
import type { FormDefinition, FormDraft, FormDraftSnapshot } from '../contracts/forms'
import type { RecordLoadContext } from '../contracts/load'
import type { SchemaIssue, SchemaParseResult } from '../contracts/schema'
import type { SubmitError } from '../contracts/results'
import { useFrameworkAdapters } from '../adapters/projectAdapters'
import { useRendererRegistry } from '../renderers/registry'
import { useLoader } from '../query'
import { instanceIdentity, recordCacheKey } from '../components/core/useCoreData'
import { formInputPendingKeyOf, provideFormInputPending } from '../components/core/useFormInputState'
import { createFormBehaviorRuntime, type FormBehaviorRuntime } from './behavior'
import { compileForm, type CompiledForm, type CompiledFormField } from './compileForm'
import { cloneEditable, isPlainRecord, snapshotEditable } from './draftValues'
import type { FormProps } from './props'

export interface FormSessionEvents<TInput extends object, TResult> {
  updateModel: (value: FormDraftSnapshot<TInput>) => void
  submitted: (result: TResult) => void
  error: (error: SubmitError) => void
  reset: () => void
}

export interface FormSession<
  TInput extends object,
  TOutput extends object,
  TResult,
  TKeys extends Extract<keyof TInput, string> = Extract<keyof TInput, string>,
> {
  compiled: ComputedRef<CompiledForm<TInput, TOutput, TResult, TKeys>>
  behavior: ComputedRef<FormBehaviorRuntime>
  draft: ComputedRef<FormDraftSnapshot<TInput>>
  dirty: ComputedRef<boolean>
  submitting: ComputedRef<boolean>
  submitPending: ComputedRef<boolean>
  validating: ComputedRef<boolean>
  inputPending: ComputedRef<boolean>
  loading: ComputedRef<boolean>
  loadError: ComputedRef<SubmitError | undefined>
  issues: ComputedRef<readonly SchemaIssue[]>
  visibleFields: ComputedRef<readonly CompiledFormField[]>
  visibleKeys: ComputedRef<readonly string[]>
  formId: string
  hasSubmit: ComputedRef<boolean>
  controlValue: (key: string) => unknown
  setValue: (key: string, value: unknown) => void
  setControlValue: (key: string, value: unknown) => void
  setControlError: (key: string, message: string | undefined) => void
  controlErrorKeys: () => readonly string[]
  issueFor: (key: string) => string | undefined
  validatingField: (key: string) => boolean
  touchedField: (key: string) => boolean
  touch: (key: string) => void
  validate: () => Promise<SchemaParseResult<TOutput>>
  submit: () => Promise<void>
  reset: () => void
  refresh: () => Promise<void>
  focusFirstInvalid: () => Promise<void>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function equalValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true
  if (left instanceof Date && right instanceof Date) return left.getTime() === right.getTime()
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((value, index) => equalValue(value, right[index]))
  }
  if (!isPlainRecord(left) || !isPlainRecord(right)) return false
  const keys = Object.keys(left)
  return keys.length === Object.keys(right).length
    && keys.every((key) => Object.hasOwn(right, key) && equalValue(left[key], right[key]))
}

function equalRecord(left: Readonly<Record<string, unknown>>, right: Readonly<Record<string, unknown>>): boolean {
  return equalValue(left, right)
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function mergeInputValues(inputKeys: readonly string[], sources: readonly (object | undefined)[]): Record<string, unknown> {
  const inputKeySet = new Set(inputKeys)
  const result: Record<string, unknown> = {}
  for (const source of sources) {
    if (!source) continue
    for (const [key, value] of Object.entries(source)) {
      if (inputKeySet.has(key)) result[key] = cloneEditable(value)
    }
  }
  return result
}

function copyInputValues(value: object | undefined, inputKeys: readonly string[]): Record<string, unknown> {
  if (!value) return {}
  const inputKeySet = new Set(inputKeys)
  const result: Record<string, unknown> = {}
  for (const [key, rawValue] of Object.entries(value)) {
    if (!inputKeySet.has(key)) continue
    result[key] = cloneEditable(rawValue)
  }
  return result
}

function schemaIssue(path: readonly (string | number)[], message: string, kind?: 'operational'): SchemaIssue {
  return kind === undefined ? { path: [...path], message } : { path: [...path], message, kind }
}

function issueMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Validation failed unexpectedly.'
}

function removedPropError(component: string, member: string): never {
  throw new Error(`[loom][SURFACE_OPTION_INVALID] ${component} member "${member}" was removed; expected a flat Form prop bag.`)
}

function assertRemovedProps(component: string): void {
  const props = getCurrentInstance()?.vnode.props ?? {}
  for (const member of ['run', 'form']) {
    if (hasOwn(props, member) || hasOwn(props, member.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`))) {
      removedPropError(component, member)
    }
  }
}

function isModelPropPresent(): boolean {
  const props = getCurrentInstance()?.vnode.props ?? {}
  return hasOwn(props, 'modelValue') || hasOwn(props, 'model-value')
}

function definitionFromProps<
  TInput extends object,
  TOutput extends object,
  TResult,
  TKeys extends Extract<keyof TInput, string>,
>(
  props: FormProps<TInput, TOutput, TResult, TKeys>,
): FormDefinition<TInput, TOutput, TResult, TKeys> {
  return {
    schema: props.schema,
    fields: props.fields,
    ...(props.labels !== undefined ? { labels: props.labels } : {}),
    ...(props.validators !== undefined ? { validators: props.validators } : {}),
    ...(typeof props.submit === 'function' ? { submit: props.submit } : {}),
  }
}

function formDefaults(fields: readonly CompiledFormField[], overrides: readonly (object | undefined)[] = []): Record<string, unknown> {
  const values: Record<string, unknown> = {}
  for (const field of fields) {
    if (field.initialValue && !overrides.some((value) => value !== undefined && hasOwn(value, field.key))) {
      values[field.key] = cloneEditable(field.initialValue())
    }
  }
  return values
}

function cloneRecord(value: object): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(value)) result[key] = cloneEditable(entry)
  return result
}

function snapshotDraft<TInput extends object>(value: object): FormDraftSnapshot<TInput> {
  return snapshotEditable(value) as FormDraftSnapshot<TInput>
}

function isValidationIssue(value: unknown): value is SchemaIssue {
  if (!isRecord(value) || !Array.isArray(value.path) || typeof value.message !== 'string') return false
  return value.path.every((part) => typeof part === 'string' || typeof part === 'number')
}

function normalizedValidatorIssues(value: unknown, fieldKey: string): SchemaIssue[] {
  if (value === undefined || value === null) return []
  const values = Array.isArray(value) ? value : [value]
  const issues: SchemaIssue[] = []
  for (const issue of values) {
    if (!isValidationIssue(issue)) {
      throw new Error(`[loom][SURFACE_OPTION_INVALID] Form validator for field "${fieldKey}" must return an issue or an array of issues.`)
    }
    issues.push(schemaIssue(issue.path, issue.message, issue.kind))
  }
  return issues
}

export function useFormSession<
  TInput extends object,
  TOutput extends object,
  TResult,
  TKeys extends Extract<keyof TInput, string>,
>(
  props: FormProps<TInput, TOutput, TResult, TKeys>,
  events: FormSessionEvents<TInput, TResult>,
): FormSession<TInput, TOutput, TResult, TKeys> {
  assertRemovedProps('Form')
  const modelValuePresent = isModelPropPresent()
  if (!props.schema) throw new Error('[loom][FORM_SCHEMA_REQUIRED] Form requires a raw schema.')
  if (typeof props.submit !== 'function' && !modelValuePresent) {
    throw new Error('[loom][FORM_BINDING_REQUIRED] Form requires a function-valued submit prop or a present modelValue prop.')
  }

  const adapters = useFrameworkAdapters()
  const renderers = useRendererRegistry('form')
  const compiled = computed(() => compileForm(definitionFromProps(props)))
  const initialCompiled = compiled.value
  const idPrefix = useId()
  const formId = `form-${idPrefix}`
  const inputPendingCount = ref(0)
  const inputPendingRegistry = provideFormInputPending(inputPendingCount)
  provide(formInputPendingKeyOf(), inputPendingRegistry)
  const inputPending = computed(() => inputPendingCount.value > 0)
  const fallbackOwner = instanceIdentity('form')
  const owner = computed(() => props.resource ?? props.namespace ?? fallbackOwner)
  const loader = useLoader<RecordLoadContext, FormDraft<TInput> | undefined>({
    key: computed(() => recordCacheKey(owner.value, props.id, 'form', props.namespace, props.searchParameters ?? {})),
    context: computed(() => ({ id: props.id, searchParameters: props.searchParameters ?? {} })),
    load: computed(() => modelValuePresent ? undefined : props.load),
    enabled: computed(() => !modelValuePresent && props.load !== undefined),
  })
  const initialModel = modelValuePresent ? props.modelValue : undefined
  const defaults = shallowRef(formDefaults(initialCompiled.fields, [props.initialData, initialModel]))
  const initialValues = mergeInputValues(initialCompiled.inputKeys, [
    defaults.value,
    props.initialData,
    initialModel,
  ])
  const baseline = ref(cloneRecord(initialValues))
  const draft = shallowReactive<FormDraft<TInput>>({})
  Object.assign(draft, cloneRecord(initialValues))
  const touched = reactive<Record<string, boolean>>({})
  const controlIssues = reactive<Record<string, string>>({})
  const issues = ref<SchemaIssue[]>([])
  const loadedValues = shallowRef<Record<string, unknown>>({})
  const submitting = ref(false)
  const submitPending = ref(false)
  const validating = ref(false)
  const validatingPaths = ref(new Set<string>())
  const submitAttempted = ref(false)
  const edited = new Set<string>()
  const sessionGeneration = ref(0)
  let draftRevision = 0
  let validationRun = 0
  let validationController: AbortController | undefined
  let mounted = true
  let lastEmittedModel: FormDraftSnapshot<TInput> | undefined
  let activeSubmit: Promise<void> | undefined
  let mutationSequence = 0
  let activeMutationOwner: number | undefined

  const behaviorFor = (form: CompiledForm<TInput, TOutput, TResult, TKeys>): FormBehaviorRuntime => createFormBehaviorRuntime({
    fields: form.fields,
    draft,
    context: () => props.context ?? {},
    labels: () => props.labels,
    resolveBaseProps: (field, renderer) => {
      if (!renderers.has(renderer)) {
        throw new Error(`[loom][RENDERER_NOT_REGISTERED] Form field "${field.key}" uses unregistered form renderer "${renderer}".`)
      }
      return { ...field.props }
    },
  })
  const behaviorRuntime = shallowRef(behaviorFor(initialCompiled))
  const behavior = computed(() => behaviorRuntime.value)
  const loaded = computed(() => loader.data.value)
  const loading = computed(() => loader.loading.value)
  const loadError = computed(() => loader.error.value)
  const visibleFields = computed(() => compiled.value.fields.filter((field) => behaviorRuntime.value.state(field.key).value.visible))
  const visibleKeys = computed(() => visibleFields.value.map((field) => field.key))
  const hasSubmit = computed(() => typeof props.submit === 'function')
  const dirty = computed(() => !equalRecord(cloneRecord(draft), baseline.value))
  const readonlyDraft = computed(() => snapshotDraft<TInput>(draft))

  function cancelSubmitAttempt(): void {
    if (submitting.value) return
    activeSubmit = undefined
    submitPending.value = false
  }

  function cancelValidation(): void {
    validationController?.abort()
    validationController = undefined
    validationRun += 1
    validating.value = false
    validatingPaths.value = new Set()
    cancelSubmitAttempt()
  }

  function abandonSessionWork(): void {
    mutationSequence += 1
    activeMutationOwner = undefined
    activeSubmit = undefined
    submitting.value = false
    submitPending.value = false
  }

  function replaceDraft(value: Readonly<Record<string, unknown>>): void {
    for (const key of Object.keys(draft)) Reflect.deleteProperty(draft, key)
    Object.assign(draft, cloneRecord(value))
    draftRevision += 1
    cancelValidation()
  }

  function emitModel(): void {
    if (!modelValuePresent) return
    const value = snapshotDraft<TInput>(draft)
    lastEmittedModel = value
    events.updateModel(value)
  }

  function fieldFor(key: string): CompiledFormField | undefined {
    return compiled.value.fields.find((field) => field.key === key)
  }

  function clearControlError(key: string): boolean {
    if (!hasOwn(controlIssues, key)) return false
    const message = controlIssues[key]
    delete controlIssues[key]
    issues.value = issues.value.filter((issue) => issue.path[0] !== key || issue.path.length !== 1 || issue.message !== message)
    return true
  }

  let previousVisibleKeys = new Set(visibleKeys.value)
  watch(visibleKeys, (keys) => {
    const nextVisibleKeys = new Set(keys)
    for (const key of previousVisibleKeys) {
      if (!nextVisibleKeys.has(key)) clearControlError(key)
    }
    previousVisibleKeys = nextVisibleKeys
  }, { flush: 'post' })

  function setValue(key: string, value: unknown, userEdit = true): void {
    if (!compiled.value.inputKeys.includes(key)) {
      throw new Error(`[loom][FORM_FIELD_UNKNOWN] Form field "${key}" is not in the schema input.`)
    }
    const field = fieldFor(key)
    if (userEdit && field?.behavior?.derived) return
    if (userEdit) edited.add(key)
    const hadControlIssue = clearControlError(key)
    const previous = Reflect.get(draft, key)
    const changed = !Object.is(previous, value)
    if (changed) Reflect.set(draft, key, cloneEditable(value))
    if (!userEdit && !changed && !hadControlIssue) return
    draftRevision += 1
    cancelValidation()
    emitModel()
  }

  function setDerivedValue(key: string, value: unknown): void {
    edited.delete(key)
    setValue(key, value, false)
  }

  function resetBehaviorValue(key: string): void {
    edited.add(key)
    setValue(key, undefined, false)
  }

  function setControlError(key: string, message: string | undefined): void {
    if (!compiled.value.inputKeys.includes(key)) {
      throw new Error(`[loom][FORM_FIELD_UNKNOWN] Form field "${key}" is not in the schema input.`)
    }
    clearControlError(key)
    if (message !== undefined) controlIssues[key] = message
    cancelValidation()
  }

  function controlErrorKeys(): readonly string[] {
    return Object.keys(controlIssues)
  }

  function applyUneditedBaseline(value: Readonly<Record<string, unknown>>): void {
    for (const key of compiled.value.inputKeys) {
      if (edited.has(key)) continue
      if (hasOwn(value, key)) Reflect.set(draft, key, cloneEditable(value[key]))
      else Reflect.deleteProperty(draft, key)
    }
  }

  let stopBehavior: WatchStopHandle = behaviorRuntime.value.connect(setDerivedValue, resetBehaviorValue)
  watch(compiled, (next) => {
    stopBehavior()
    behaviorRuntime.value = behaviorFor(next)
    stopBehavior = behaviorRuntime.value.connect(setDerivedValue, resetBehaviorValue)
  })

  function controlValue(key: string): unknown {
    return snapshotEditable(Reflect.get(draft, key))
  }

  function setControlValue(key: string, value: unknown): void {
    const field = fieldFor(key)
    if (!field) throw new Error(`[loom][FORM_FIELD_UNKNOWN] Form field "${key}" is not selected.`)
    setValue(key, value)
  }

  function candidateFor(snapshot: Readonly<Record<string, unknown>>): Record<string, unknown> {
    const visible = new Set(behaviorRuntime.value.visibleKeys.value)
    const selected = new Set(compiled.value.fields.map((field) => field.key))
    const candidate: Record<string, unknown> = {}
    for (const key of compiled.value.inputKeys) {
      if (selected.has(key) && !visible.has(key)) continue
      if (hasOwn(snapshot, key)) candidate[key] = cloneEditable(snapshot[key])
    }
    return candidate
  }

  function controlIssuesFor(): SchemaIssue[] {
    const nextIssues: SchemaIssue[] = []
    for (const field of visibleFields.value) {
      const controlIssue = controlIssues[field.key]
      if (hasOwn(controlIssues, field.key)) {
        nextIssues.push(schemaIssue([field.key], controlIssue ?? 'Invalid control value.'))
      }
    }
    return nextIssues
  }

  function isCurrentValidation(run: number, controller: AbortController, generation: number, revision: number): boolean {
    return mounted && run === validationRun && !controller.signal.aborted && generation === sessionGeneration.value && revision === draftRevision
  }

  async function performValidation(trigger: 'blur' | 'submit', field?: string): Promise<SchemaParseResult<TOutput>> {
    validationController?.abort()
    const controller = new AbortController()
    validationController = controller
    const run = ++validationRun
    const generation = sessionGeneration.value
    const revision = draftRevision
    const snapshot = cloneRecord(draft)
    const activeForm = compiled.value
    validating.value = true
    const validatorPaths = (props.validators ?? [])
      .filter((validator) => (validator.triggers ?? ['submit']).includes(trigger))
      .flatMap((validator) => validator.path?.[0] === undefined ? [] : [String(validator.path[0])])
    validatingPaths.value = new Set(field === undefined ? validatorPaths : [...validatorPaths, field])
    try {
      const inputIssues = controlIssuesFor()
      if (inputIssues.length > 0) {
        const result: SchemaParseResult<TOutput> = { success: false, issues: inputIssues }
        if (isCurrentValidation(run, controller, generation, revision)) issues.value = inputIssues
        return result
      }
      const candidate = candidateFor(snapshot)
      const parsed = await activeForm.parseAsync(candidate)
      if (!isCurrentValidation(run, controller, generation, revision)) return { success: false, issues: [] }
      if (!parsed.success) {
        issues.value = parsed.issues
        return parsed
      }

      const validators = (props.validators ?? []).filter((validator) => (validator.triggers ?? ['submit']).includes(trigger))
      const validatorResults = await Promise.all(validators.map(async (validator) => {
        try {
          const result = await validator.validate({
            data: parsed.data,
            draft: snapshotDraft<TInput>(snapshot),
            initial: snapshotDraft<TInput>(baseline.value),
            context: props.context ?? {},
            ...(field !== undefined ? { field } : {}),
            signal: controller.signal,
          })
          return normalizedValidatorIssues(result, validator.path?.[0] === undefined ? 'form' : String(validator.path[0]))
        } catch (error) {
          if (controller.signal.aborted) return []
          return [schemaIssue(validator.path ?? [], issueMessage(error), 'operational')]
        }
      }))
      if (!isCurrentValidation(run, controller, generation, revision)) return { success: false, issues: [] }
      const validatorIssues = validatorResults.flat()
      const result: SchemaParseResult<TOutput> = validatorIssues.length > 0
        ? { success: false, issues: validatorIssues }
        : parsed
      issues.value = result.success ? [] : result.issues
      return result
    } catch (error) {
      if (!isCurrentValidation(run, controller, generation, revision)) return { success: false, issues: [] }
      const issue = schemaIssue([], issueMessage(error), 'operational')
      issues.value = [issue]
      return { success: false, issues: [issue] }
    } finally {
      if (run === validationRun) {
        validating.value = false
        validatingPaths.value = new Set()
      }
    }
  }

  async function validate(): Promise<SchemaParseResult<TOutput>> {
    behaviorRuntime.value.settle()
    return performValidation('submit')
  }

  async function runSubmit(
    generation: number,
    revision: number,
    submitTarget: FormProps<TInput, TOutput, TResult>['submit'],
  ): Promise<void> {
    if (
      !mounted
      || generation !== sessionGeneration.value
      || revision !== draftRevision
      || props.submit !== submitTarget
    ) return
    const result = await performValidation('submit')
    if (!result.success) {
      if (mounted && generation === sessionGeneration.value) await focusFirstInvalid()
      return
    }
    if (
      !mounted
      || generation !== sessionGeneration.value
      || revision !== draftRevision
      || props.submit !== submitTarget
      || props.disabled
      || loading.value
      || inputPending.value
    ) return
    if (typeof submitTarget !== 'function') return
    const mutationOwner = ++mutationSequence
    activeMutationOwner = mutationOwner
    submitting.value = true
    try {
      const submitted = await submitTarget(result.data)
      if (mounted && generation === sessionGeneration.value && activeMutationOwner === mutationOwner) {
        events.submitted(submitted)
      }
    } catch (error) {
      if (!mounted || generation !== sessionGeneration.value || activeMutationOwner !== mutationOwner) return
      const normalized = (props.normalizeError ?? adapters.data.normalizeError)(error)
      if (normalized.issues) issues.value = normalized.issues
      toast.error(normalized.message)
      events.error(normalized)
    } finally {
      if (mounted && generation === sessionGeneration.value && activeMutationOwner === mutationOwner) {
        activeMutationOwner = undefined
        submitting.value = false
      }
    }
  }

  function submit(): Promise<void> {
    if (activeSubmit) return activeSubmit
    if (props.disabled || submitting.value || loading.value || inputPending.value) return Promise.resolve()
    behaviorRuntime.value.settle()
    const generation = sessionGeneration.value
    const revision = draftRevision
    const submitTarget = props.submit
    submitAttempted.value = true
    submitPending.value = true
    const attempt = Promise.resolve().then(() => runSubmit(generation, revision, submitTarget))
    const ownedAttempt = attempt.finally(() => {
      if (activeSubmit !== ownedAttempt) return
      activeSubmit = undefined
      submitPending.value = false
    })
    activeSubmit = ownedAttempt
    return ownedAttempt
  }

  function touch(key: string): void {
    touched[key] = true
    behaviorRuntime.value.settle()
    if (!submitPending.value) void performValidation('blur', key)
  }

  const visibleIssues = computed(() => issues.value.filter((issue) => {
    const key = issue.path[0]
    return issue.path.length === 0 || submitAttempted.value || (typeof key === 'string' && touched[key])
  }))
  const displayedIssues = computed(() => {
    const visible = visibleIssues.value
    return [
      ...visible,
      ...Object.entries(controlIssues)
        .filter(([key, message]) => visibleKeys.value.includes(key)
          && (submitAttempted.value || touched[key])
          && !visible.some((issue) => issue.path[0] === key && issue.message === message))
        .map(([key, message]) => schemaIssue([key], message)),
    ]
  })

  function issueFor(key: string): string | undefined {
    return displayedIssues.value.find((issue) => issue.path[0] === key)?.message
  }

  function validatingField(key: string): boolean {
    return validatingPaths.value.has(key)
  }

  function touchedField(key: string): boolean {
    return touched[key] === true
  }

  async function focusFirstInvalid(): Promise<void> {
    await nextTick()
    const key = displayedIssues.value.map((issue) => issue.path[0]).find((part): part is string => typeof part === 'string' && visibleKeys.value.includes(part))
    if (!key) return
    const element = document.getElementById(`${formId}-field-${key}`)
    element?.scrollIntoView?.({ block: 'nearest' })
    element?.focus?.()
  }

  function reset(): void {
    const next = cloneRecord(baseline.value)
    replaceDraft(next)
    edited.clear()
    for (const key of Object.keys(touched)) delete touched[key]
    for (const key of Object.keys(controlIssues)) delete controlIssues[key]
    issues.value = []
    submitAttempted.value = false
    if (modelValuePresent) emitModel()
    events.reset()
  }

  async function refresh(): Promise<void> {
    if (modelValuePresent || props.load === undefined) return
    await loader.refresh()
  }

  function applyLoaded(value: FormDraft<TInput> | undefined): void {
    if (modelValuePresent || value === undefined || !mounted) return
    const mapped = copyInputValues(value, compiled.value.inputKeys)
    loadedValues.value = mapped
    const nextBaseline = mergeInputValues(compiled.value.inputKeys, [
      defaults.value,
      props.initialData,
      loadedValues.value,
    ])
    applyUneditedBaseline(nextBaseline)
    baseline.value = nextBaseline
    draftRevision += 1
    cancelValidation()
  }

  watch(loaded, (value) => applyLoaded(value), { immediate: true })
  watch(() => props.initialData, (value) => {
    if (modelValuePresent) return
    const nextBaseline = mergeInputValues(compiled.value.inputKeys, [
      defaults.value,
      value,
      loadedValues.value,
    ])
    applyUneditedBaseline(nextBaseline)
    baseline.value = nextBaseline
    draftRevision += 1
    cancelValidation()
  }, { deep: true })
  watch(() => props.modelValue, (value) => {
    if (!modelValuePresent) return
    const next = mergeInputValues(compiled.value.inputKeys, [
      defaults.value,
      props.initialData,
      value,
    ])
    if (lastEmittedModel && equalRecord(next, cloneRecord(lastEmittedModel)) && equalRecord(next, cloneRecord(draft))) return
    replaceDraft(next)
    baseline.value = cloneRecord(next)
    edited.clear()
    for (const key of Object.keys(touched)) delete touched[key]
    issues.value = []
  }, { deep: true })

  const keySignature = computed(() => JSON.stringify(compiled.value.fields.map((field) => field.key)))
  const identitySignature = computed(() => JSON.stringify(recordCacheKey(owner.value, props.id, 'form', props.namespace, props.searchParameters ?? {})))
  watch([() => props.schema, keySignature, identitySignature], ([schema, keys, identity], previous) => {
    if (!previous) return
    const [previousSchema, previousKeys, previousIdentity] = previous
    if (schema === previousSchema && keys === previousKeys && identity === previousIdentity) return
    sessionGeneration.value += 1
    abandonSessionWork()
    cancelValidation()
    loadedValues.value = {}
    const nextCompiled = compiled.value
    defaults.value = formDefaults(nextCompiled.fields, [props.initialData, modelValuePresent ? props.modelValue : undefined])
    const next = mergeInputValues(nextCompiled.inputKeys, [
      defaults.value,
      props.initialData,
      modelValuePresent ? props.modelValue : undefined,
    ])
    baseline.value = cloneRecord(next)
    replaceDraft(next)
    edited.clear()
    for (const key of Object.keys(touched)) delete touched[key]
    for (const key of Object.keys(controlIssues)) delete controlIssues[key]
    issues.value = []
    submitAttempted.value = false
    if (identity === previousIdentity) applyLoaded(loaded.value)
    if (modelValuePresent && !equalRecord(next, mergeInputValues(nextCompiled.inputKeys, [props.modelValue]))) nextTick(emitModel)
  })

  onUnmounted(() => {
    mounted = false
    sessionGeneration.value += 1
    abandonSessionWork()
    cancelValidation()
    stopBehavior()
  })

  if (modelValuePresent && !equalRecord(initialValues, mergeInputValues(initialCompiled.inputKeys, [props.modelValue]))) {
    nextTick(() => {
      if (mounted) emitModel()
    })
  }

  return {
    compiled,
    behavior,
    draft: readonlyDraft,
    dirty,
    submitting: computed(() => submitting.value),
    submitPending: computed(() => submitPending.value),
    validating: computed(() => validating.value),
    inputPending,
    loading,
    loadError,
    issues: displayedIssues,
    visibleFields,
    visibleKeys,
    formId,
    hasSubmit,
    controlValue,
    setValue: (key, value) => setValue(key, value),
    setControlValue,
    setControlError,
    controlErrorKeys,
    issueFor,
    validatingField,
    touchedField,
    touch,
    validate,
    submit,
    reset,
    refresh,
    focusFirstInvalid,
  }
}
