import { computed, getCurrentInstance, nextTick, onUnmounted, provide, reactive, ref, shallowReactive, shallowRef, useId, watch, type ComputedRef, type WatchStopHandle } from 'vue'
import { toast } from 'vue-sonner'
import type { FormDefinition } from '../contracts/forms'
import type { RecordLoadContext } from '../contracts/load'
import type { SchemaIssue, SchemaParseResult } from '../contracts/schema'
import type { SubmitError } from '../contracts/results'
import { useFrameworkAdapters } from '../adapters/projectAdapters'
import { useInputPropsRegistry } from '../renderers/inputProps'
import { useRendererRegistry } from '../renderers/registry'
import { useLoader } from '../query'
import { resolveLabel } from '../labels/resolveLabel'
import { instanceIdentity, recordCacheKey } from '../components/core/useCoreData'
import { formInputPendingKeyOf, provideFormInputPending } from '../components/core/useFormInputState'
import { createFormBehaviorRuntime, type FormBehaviorRuntime } from './behavior'
import { compileForm, type CompiledForm, type CompiledFormField } from './compileForm'
import type { FormProps } from './props'
import { dateControlValueAdapter } from './controlValues'

export interface FormSessionEvents<TInput extends object, TResult> {
  updateModel: (value: Partial<TInput>) => void
  submitted: (result: TResult) => void
  error: (error: SubmitError) => void
  reset: () => void
}

export interface FormSession<TInput extends object, TOutput extends object, TResult> {
  compiled: ComputedRef<CompiledForm<TInput, TOutput, TResult>>
  behavior: ComputedRef<FormBehaviorRuntime>
  draft: Partial<TInput>
  dirty: ComputedRef<boolean>
  submitting: ComputedRef<boolean>
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

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function cloneEditable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cloneEditable)
  if (!isPlainRecord(value)) return value
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, cloneEditable(entry)]))
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

function copyInputValues(value: object | undefined, inputKeys: readonly string[], fields: readonly CompiledFormField[], rendererFor: (field: CompiledFormField) => string, inputProps: ReturnType<typeof useInputPropsRegistry>): Record<string, unknown> {
  if (!value) return {}
  const inputKeySet = new Set(inputKeys)
  const fieldByKey = new Map(fields.map((field) => [field.key, field]))
  const result: Record<string, unknown> = {}
  for (const [key, rawValue] of Object.entries(value)) {
    if (!inputKeySet.has(key)) continue
    const field = fieldByKey.get(key)
    const hydrated = field ? inputProps.hydrate(rendererFor(field), rawValue) : rawValue
    result[key] = cloneEditable(hydrated)
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

function definitionFromProps<TInput extends object, TOutput extends object, TResult>(
  props: FormProps<TInput, TOutput, TResult>,
): FormDefinition<TInput, TOutput, TResult> {
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

function cloneDraft<TInput extends object>(value: object): Partial<TInput> {
  const result: Partial<TInput> = {}
  for (const [key, entry] of Object.entries(value)) Reflect.set(result, key, cloneEditable(entry))
  return result
}

function snapshotInput<TInput extends object>(value: object): Readonly<Partial<TInput>> {
  return cloneDraft<TInput>(value)
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

export function useFormSession<TInput extends object, TOutput extends object, TResult>(
  props: FormProps<TInput, TOutput, TResult>,
  events: FormSessionEvents<TInput, TResult>,
): FormSession<TInput, TOutput, TResult> {
  assertRemovedProps('Form')
  const modelValuePresent = isModelPropPresent()
  if (!props.schema) throw new Error('[loom][FORM_SCHEMA_REQUIRED] Form requires a raw schema.')
  if (typeof props.submit !== 'function' && !modelValuePresent) {
    throw new Error('[loom][FORM_BINDING_REQUIRED] Form requires a function-valued submit prop or a present modelValue prop.')
  }

  const adapters = useFrameworkAdapters()
  const renderers = useRendererRegistry('form')
  const inputProps = useInputPropsRegistry()
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
  const loader = useLoader<RecordLoadContext, Partial<TInput> | undefined>({
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
  const draft = shallowReactive<Partial<TInput>>({})
  Object.assign(draft, cloneRecord(initialValues))
  const touched = reactive<Record<string, boolean>>({})
  const controlIssues = reactive<Record<string, string>>({})
  const issues = ref<SchemaIssue[]>([])
  const loadedValues = shallowRef<Record<string, unknown>>({})
  const submitting = ref(false)
  const validating = ref(false)
  const validatingPaths = ref(new Set<string>())
  const submitAttempted = ref(false)
  const edited = new Set<string>()
  const sessionGeneration = ref(0)
  let draftRevision = 0
  let validationRun = 0
  let validationController: AbortController | undefined
  let mounted = true
  let lastEmittedModel: Partial<TInput> | undefined

  const behaviorFor = (form: CompiledForm<TInput, TOutput, TResult>): FormBehaviorRuntime => createFormBehaviorRuntime({
    fields: form.fields,
    draft,
    context: () => props.context ?? {},
    labels: () => props.labels,
    resolveBaseProps: (field, renderer) => {
      if (!renderers.has(renderer)) {
        throw new Error(`[loom][RENDERER_NOT_REGISTERED] Form field "${field.key}" uses unregistered form renderer "${renderer}".`)
      }
      const label = resolveLabel(field.key, field.label, props.labels)
      return inputProps.resolve(renderer, {
        ...(field.source !== undefined ? { source: field.source } : {}),
        props: { ...field.props },
        context: { field: { key: field.key, label } },
      })
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

  function cancelValidation(): void {
    validationController?.abort()
    validationController = undefined
    validationRun += 1
    validating.value = false
    validatingPaths.value = new Set()
  }

  function replaceDraft(value: Readonly<Record<string, unknown>>): void {
    for (const key of Object.keys(draft)) Reflect.deleteProperty(draft, key)
    Object.assign(draft, cloneRecord(value))
    draftRevision += 1
    cancelValidation()
  }

  function emitModel(): void {
    if (!modelValuePresent) return
    const value = cloneDraft<TInput>(draft)
    lastEmittedModel = value
    events.updateModel(value)
  }

  function fieldFor(key: string): CompiledFormField | undefined {
    return compiled.value.fields.find((field) => field.key === key)
  }

  function setValue(key: string, value: unknown, userEdit = true): void {
    if (!compiled.value.inputKeys.includes(key)) {
      throw new Error(`[loom][FORM_FIELD_UNKNOWN] Form field "${key}" is not in the schema input.`)
    }
    const field = fieldFor(key)
    if (userEdit && field?.behavior?.derived) return
    if (userEdit) edited.add(key)
    delete controlIssues[key]
    if (Object.is(Reflect.get(draft, key), value)) return
    Reflect.set(draft, key, cloneEditable(value))
    draftRevision += 1
    cancelValidation()
    emitModel()
  }

  function setDerivedValue(key: string, value: unknown): void {
    edited.delete(key)
    setValue(key, value, false)
  }

  function applyUneditedBaseline(value: Readonly<Record<string, unknown>>): void {
    for (const key of compiled.value.inputKeys) {
      if (edited.has(key)) continue
      if (hasOwn(value, key)) Reflect.set(draft, key, cloneEditable(value[key]))
      else Reflect.deleteProperty(draft, key)
    }
  }

  let stopBehavior: WatchStopHandle = behaviorRuntime.value.connect(setDerivedValue)
  watch(compiled, (next) => {
    stopBehavior()
    behaviorRuntime.value = behaviorFor(next)
    stopBehavior = behaviorRuntime.value.connect(setDerivedValue)
  })

  function fieldControlValue(field: CompiledFormField, value: unknown): unknown {
    const state = behaviorRuntime.value.state(field.key).value
    if (field.kind === 'date' && state.renderer === 'date') {
      const withTime = state.props.withTimePicker === true
      if (value === null || value === undefined) return dateControlValueAdapter.toControl(value, withTime, field.key)
      if (!(value instanceof Date)) {
        throw new Error(`[loom][FORM_CONTROL_VALUE_INVALID] Form field "${field.key}" expects a Date editable value.`)
      }
      return dateControlValueAdapter.toControl(value, withTime, field.key)
    }
    return value
  }

  function controlValue(key: string): unknown {
    const field = fieldFor(key)
    const value = Reflect.get(draft, key)
    return field ? fieldControlValue(field, value) : value
  }

  function setControlValue(key: string, value: unknown): void {
    const field = fieldFor(key)
    if (!field) throw new Error(`[loom][FORM_FIELD_UNKNOWN] Form field "${key}" is not selected.`)
    const renderer = behaviorRuntime.value.state(key).value.renderer
    if (field.kind === 'date' && renderer === 'date') {
      try {
        if (value instanceof Date) {
          dateControlValueAdapter.toControl(value, false, key)
          setValue(key, value)
        } else if (value === null || value === undefined || typeof value === 'string') {
          setValue(key, dateControlValueAdapter.toEditable(value, key))
        } else {
          throw new Error(`[loom][FORM_CONTROL_VALUE_INVALID] Form field "${key}" expects a date control value.`)
        }
      } catch (error) {
        controlIssues[key] = issueMessage(error)
      }
      return
    }
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

  function controlIssuesFor(snapshot: Readonly<Record<string, unknown>>): SchemaIssue[] {
    const nextIssues: SchemaIssue[] = []
    for (const field of visibleFields.value) {
      const renderer = behaviorRuntime.value.state(field.key).value.renderer
      if (!renderer || !hasOwn(snapshot, field.key)) continue
      let value: unknown
      try {
        value = fieldControlValue(field, snapshot[field.key])
      } catch (error) {
        controlIssues[field.key] = issueMessage(error)
      }
      const controlIssue = controlIssues[field.key]
      if (controlIssue) {
        nextIssues.push(schemaIssue([field.key], controlIssue))
        continue
      }
      const contract = inputProps.contract(renderer)
      const message = contract.validate?.(value, {
        field: { key: field.key, label: behaviorRuntime.value.state(field.key).value.label },
        props: behaviorRuntime.value.state(field.key).value.props,
      })
      if (message) nextIssues.push(schemaIssue([field.key], message))
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
      const inputIssues = controlIssuesFor(snapshot)
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
            draft: snapshotInput<TInput>(snapshot),
            initial: snapshotInput<TInput>(baseline.value),
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

  async function submit(): Promise<void> {
    if (props.disabled || submitting.value || validating.value || loading.value || inputPending.value) return
    behaviorRuntime.value.settle()
    const generation = sessionGeneration.value
    const revision = draftRevision
    const submitTarget = props.submit
    submitAttempted.value = true
    const result = await performValidation('submit')
    if (!result.success) {
      await focusFirstInvalid()
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
    submitting.value = true
    try {
      const submitted = await submitTarget(result.data)
      events.submitted(submitted)
    } catch (error) {
      const normalized = (props.normalizeError ?? adapters.data.normalizeError)(error)
      if (normalized.issues) issues.value = normalized.issues
      toast.error(normalized.message)
      events.error(normalized)
    } finally {
      submitting.value = false
    }
  }

  function touch(key: string): void {
    touched[key] = true
    behaviorRuntime.value.settle()
    void performValidation('blur', key)
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

  function applyLoaded(value: Partial<TInput> | undefined): void {
    if (modelValuePresent || value === undefined || !mounted) return
    const mapped = copyInputValues(value, compiled.value.inputKeys, compiled.value.fields, (field) => behaviorRuntime.value.state(field.key).value.renderer ?? field.renderer, inputProps)
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
    draft,
    dirty,
    submitting: computed(() => submitting.value),
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
