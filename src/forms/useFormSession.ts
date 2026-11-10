import { remapArrayPath, type FormArrayContext } from './arrayField'
import { createFormOutputs, type FormPublisher } from './outputs'
import { markRaw, toRaw, computed, nextTick, onUnmounted, provide, reactive, ref, shallowReactive, shallowRef, useId, watch, type ComputedRef } from 'vue'
import { isCancelledError } from '@tanstack/vue-query'
import { toast } from 'vue-sonner'
import type { FormSubmitOptions, FormDefinition, FormDraft, FormDraftSnapshot, FormFieldContext, FormInput } from '../contracts/forms'
import type { RecordLoadContext } from '../contracts/load'
import type { SchemaIssue, SchemaParseResult } from '../contracts/schema'
import type { SubmitError } from '../contracts/results'
import { useFrameworkAdapters } from '../adapters/projectAdapters'
import { useRendererRegistry } from '../renderers/registry'
import { useLoader } from '../query'
import { stableValue } from '../query/keys'
import { instanceIdentity, recordCacheKey } from '../components/core/useCoreData'
import { associateResourceLoader, resourceLoaderIdentity } from '../resources/loaderIdentity'
import { formInputPendingKeyOf, provideFormInputPending } from '../components/core/useFormInputState'
import { createDerivedRuntime } from './behavior'
import type { RuntimeFormField } from './definitionTypes'
import { createSchemaRuntime } from '../schemas/schemaRuntime'
import { assertFormDefinition, assertFormFields } from './assertFormDefinition'
import { fieldKeys, fieldPatch, formFieldValue } from './fieldBinding'
import { cloneEditable, isPlainRecord, snapshotEditable } from './draftValues'
import type { FormProps } from './props'
import { isConfirmedWriteRefreshError, normalizeWriteError } from '../resources/postWriteOutcome'
import { resolveLabel } from '../labels/resolveLabel'

export interface FormSessionEvents<TInput extends object, TResult> {
  updateModel: (value: FormDraftSnapshot<TInput>) => void
  submitted: (result: TResult, refreshError?: SubmitError) => void
  error: (error: SubmitError) => void
  reset: () => void
}

export interface FormSession<TInput extends object, TOutput extends object, TResult, TKeys extends string = Extract<keyof TInput, string>, TContext extends object = Readonly<Record<string, unknown>>> {
  confirmation: ComputedRef<{ readonly title: string; readonly message: string } | undefined>
  settleConfirmation: (confirmed: boolean) => void
  arrayFields: FormArrayContext
  draft: ComputedRef<FormDraftSnapshot<TInput>>
  submittedValues: ComputedRef<Readonly<TOutput> | undefined>
  dirty: ComputedRef<boolean>
  submitting: ComputedRef<boolean>
  submitPending: ComputedRef<boolean>
  postWriteError: ComputedRef<SubmitError | undefined>
  validating: ComputedRef<boolean>
  inputPending: ComputedRef<boolean>
  loading: ComputedRef<boolean>
  loadError: ComputedRef<SubmitError | undefined>
  issues: ComputedRef<readonly SchemaIssue[]>
  visibleFields: ComputedRef<readonly RuntimeFormField<TInput, TKeys>[]>
  visibleKeys: ComputedRef<readonly string[]>
  formId: string
  hasSubmit: ComputedRef<boolean>
  fieldFor: (key: string) => RuntimeFormField<TInput, TKeys> | undefined
  controlValue: (key: string) => unknown
  setValue: (key: string, value: unknown) => void
  setControlValue: (key: string, value: unknown) => void
  setControlError: (key: string, message: string | undefined) => void
  controlErrorKeys: () => readonly string[]
  controlGeneration: (key: string) => number
  issueFor: (key: string) => string | undefined
  validatingField: (key: string) => boolean
  touchedField: (key: string) => boolean
  touch: (key: string) => void
  validate: () => Promise<SchemaParseResult<TOutput>>
  submit: (options?: FormSubmitOptions<TInput, TOutput, TResult, TContext>) => Promise<void>
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
  return keys.length === Object.keys(right).length && keys.every((key) => Object.hasOwn(right, key) && equalValue(left[key], right[key]))
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

function definitionFromProps<TInput extends object, TOutput extends object, TResult, TKeys extends string, TContext extends object, TFields extends object>(
  props: FormProps<TInput, TOutput, TResult, TKeys, TContext, TFields>
): FormDefinition<TInput, TOutput, TResult, TKeys, TContext, TFields> {
  return {
    schema: props.schema,
    fields: props.fields,
    ...(props.labels !== undefined ? { labels: props.labels } : {}),
    ...(props.validators !== undefined ? { validators: props.validators } : {}),
    ...(typeof props.submit === 'function' ? { submit: props.submit } : {}),
  }
}

function formDefaults<TInput extends object, TKeys extends string>(fields: readonly RuntimeFormField<TInput, TKeys>[], overrides: readonly (object | undefined)[] = []): Record<string, unknown> {
  const values: Record<string, unknown> = {}
  for (const field of fields) {
    if (hasOwn(field, 'initialValue') && !overrides.some((value) => value !== undefined && fieldKeys(field.key, field).some((key) => hasOwn(value, key)))) {
      Object.assign(values, fieldPatch(field.key, field, typeof field.initialValue === 'function' ? field.initialValue() : field.initialValue))
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

export function useFormSession<TInput extends object, TOutput extends object, TResult, TKeys extends string, TContext extends object, TFields extends object>(
  props: FormProps<TInput, TOutput, TResult, TKeys, TContext, TFields>,
  events: FormSessionEvents<TInput, TResult>,
  host: { modelValuePresent: boolean }
): FormSession<TInput, TOutput, TResult, TKeys, TContext> {
  type RuntimeField = RuntimeFormField<TInput, TKeys>

  const modelValuePresent = host.modelValuePresent
  if (!props.schema) throw new Error('[loom][FORM_SCHEMA_REQUIRED] Form requires a raw schema.')
  if (typeof props.submit !== 'function' && !modelValuePresent) {
    throw new Error('[loom][FORM_BINDING_REQUIRED] Form requires a function-valued submit prop or a present modelValue prop.')
  }

  const confirmation = shallowRef<{ readonly title: string; readonly message: string }>()
  let resolveConfirmation: ((confirmed: boolean) => void) | undefined
  function settleConfirmation(confirmed: boolean): void {
    const resolve = resolveConfirmation
    resolveConfirmation = undefined
    confirmation.value = undefined
    resolve?.(confirmed)
  }
  const publications = createFormOutputs()
  const outputGeneration = ref(0)
  const acceptedValues = shallowRef<Readonly<TOutput>>()
  const completed = ref(false)
  const submittedValues = computed(() => acceptedValues.value)
  const adapters = useFrameworkAdapters()
  const renderers = useRendererRegistry('form')
  const definition = computed(() => definitionFromProps<TInput, TOutput, TResult, TKeys, TContext, TFields>(props))
  const schemaRuntime = computed(() => {
    const currentDefinition = definition.value
    const runtime = createSchemaRuntime(currentDefinition.schema)
    assertFormDefinition<TInput, TOutput, TResult, TKeys, TContext, TFields>(currentDefinition, runtime)
    return runtime
  })
  type ResolverLoaderState = { signature: string | undefined; current: Function; forwarder: (...args: unknown[]) => unknown }
  const resolverLoaders = new Map<string, ResolverLoaderState>()
  const resolverLoaderRoles = ['load', 'loadDetail'] as const
  const resolveFieldLoaders = (key: string, input: unknown): unknown => {
    if (!isRecord(input) || !isRecord(input.props)) return input
    const props = { ...input.props }
    let changed = false
    for (const role of resolverLoaderRoles) {
      const load = Reflect.get(props, role)
      if (typeof load !== 'function') continue
      const identity = resourceLoaderIdentity(load)
      const signature = identity === undefined ? undefined : JSON.stringify(stableValue(identity))
      const loaderKey = JSON.stringify([key, role])
      let state = resolverLoaders.get(loaderKey)
      if (!state || state.signature !== signature) {
        const nextState: ResolverLoaderState = {
          signature,
          current: load,
          forwarder: (...args) => Reflect.apply(nextState.current, undefined, args),
        }
        if (identity !== undefined) associateResourceLoader(nextState.forwarder, identity)
        resolverLoaders.set(loaderKey, nextState)
        state = nextState
      } else state.current = load
      if (load !== state.forwarder) {
        props[role] = state.forwarder
        changed = true
      }
    }
    return changed ? { ...input, props } : input
  }
  const resolveConfiguredFields = (sourceDraft: object): readonly RuntimeField[] => {
    const currentDefinition = definition.value
    const runtime = schemaRuntime.value
    const draftSnapshot = snapshotDraft<TInput>(sourceDraft)
    const generation = outputGeneration.value
    const publish: FormPublisher = (output, value) => {
      if (generation === outputGeneration.value) publications.publish(output, value)
    }
    const fieldEntries = Object.fromEntries(
      Object.keys(currentDefinition.fields).map((key) => {
        const fieldKey = key as Extract<TKeys, string>
        const entry = Reflect.get(currentDefinition.fields, fieldKey)
        const resolvedInput =
          typeof entry === 'function'
            ? (entry as (context: FormFieldContext<TInput, TContext>) => unknown)({ draft: draftSnapshot, outputs: publications.outputs, publish, context: (props.context ?? {}) as TContext })
            : entry
        const input = typeof entry === 'function' ? resolveFieldLoaders(fieldKey, resolvedInput) : resolvedInput
        return [key, input]
      })
    )
    assertFormFields(fieldEntries, runtime.inputKeys)
    return Object.keys(fieldEntries).map((key) => {
      const fieldKey = key as Extract<TKeys, string>
      const input = Reflect.get(fieldEntries, fieldKey) as FormInput<TInput>
      if (typeof input.renderer === 'string' && !renderers.has(input.renderer)) {
        throw new Error(`[loom][RENDERER_NOT_REGISTERED] Form field "${fieldKey}" uses unregistered form renderer "${input.renderer}".`)
      }
      return {
        ...input,
        renderer: typeof input.renderer === 'string' ? input.renderer : markRaw(toRaw(input.renderer)),
        key: fieldKey,
        label: resolveLabel(fieldKey, input.label, props.labels),
        props: { ...input.props },
        visible: input.visible !== false,
        required: fieldKeys(key, input).some((name) => runtime.requiredKeys.has(name)),
      }
    })
  }
  const initialDraftSeed = mergeInputValues(schemaRuntime.value.inputKeys, [props.initialData, modelValuePresent ? props.modelValue : undefined])
  const initialFields = resolveConfiguredFields(initialDraftSeed)
  const idPrefix = useId()
  const formId = `form-${idPrefix}`
  const controlGenerations = reactive(new Map<string, number>())
  const inputPendingCount = ref(0)
  const inputPendingRegistry = provideFormInputPending(inputPendingCount)
  provide(formInputPendingKeyOf(), inputPendingRegistry)
  const inputPending = computed(() => inputPendingCount.value > 0)
  const fallbackOwner = instanceIdentity('form')
  const owner = computed(() => props.resource ?? props.namespace ?? fallbackOwner)
  const loader = useLoader<RecordLoadContext, FormDraft<TInput> | undefined>({
    key: computed(() => recordCacheKey(owner.value, props.id, 'form', props.namespace, props.searchParameters ?? {})),
    context: computed(() => ({ id: props.id, searchParameters: props.searchParameters ?? {} })),
    load: computed(() => (modelValuePresent ? undefined : props.load)),
    enabled: computed(() => !modelValuePresent && props.load !== undefined),
  })
  const initialModel = modelValuePresent ? props.modelValue : undefined
  const defaults = shallowRef(formDefaults(initialFields, [props.initialData, initialModel]))
  const initialValues = mergeInputValues(schemaRuntime.value.inputKeys, [defaults.value, props.initialData, initialModel])
  const baseline = ref(cloneRecord(initialValues))
  const draft = shallowReactive<FormDraft<TInput>>({})
  Object.assign(draft, cloneRecord(initialValues))
  const fields = computed<readonly RuntimeField[]>(() => resolveConfiguredFields(draft))
  const touched = reactive<Record<string, boolean>>({})
  const controlIssues = reactive<Record<string, string>>({})
  const issues = ref<SchemaIssue[]>([])
  const serverIssues = ref<SchemaIssue[]>([])
  const loadedValues = shallowRef<Record<string, unknown>>({})
  const submitting = ref(false)
  const submitPending = ref(false)
  const postWriteErrorState = shallowRef<SubmitError>()
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
  let activeRecovery: { error: SubmitError; target: string; promise: Promise<void> } | undefined
  let mutationSequence = 0
  let activeMutationOwner: number | undefined

  const loaded = computed(() => loader.data.value)
  const loading = computed(() => loader.loading.value)
  const loadError = computed(() => loader.error.value)
  const visibleFields = computed(() => fields.value.filter((field) => field.visible))
  const visibleKeys = computed<string[]>(() => visibleFields.value.map((field) => field.key))
  const hasSubmit = computed(() => typeof props.submit === 'function')
  const dirty = computed(() => !equalRecord(cloneRecord(draft), baseline.value))
  const readonlyDraft = computed(() => snapshotDraft<TInput>(draft))
  const postWriteError = computed(() => postWriteErrorState.value)

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
    settleConfirmation(false)
    draftRevision += 1
    cancelValidation()
  }

  function emitModel(): void {
    if (!modelValuePresent) return
    const value = snapshotDraft<TInput>(draft)
    lastEmittedModel = value
    events.updateModel(value)
  }

  function fieldFor(key: string): RuntimeField | undefined {
    return fields.value.find((field) => field.key === key)
  }

  function clearControlError(key: string): boolean {
    if (!hasOwn(controlIssues, key)) return false
    const message = controlIssues[key]
    delete controlIssues[key]
    issues.value = issues.value.filter((issue) => issue.path.join('.') !== key || issue.message !== message)
    return true
  }

  let previousVisibleKeys = new Set(visibleKeys.value)
  watch(
    visibleKeys,
    (keys) => {
      const nextVisibleKeys = new Set(keys)
      for (const key of previousVisibleKeys) {
        if (!nextVisibleKeys.has(key)) clearControlError(key)
      }
      previousVisibleKeys = nextVisibleKeys
    },
    { flush: 'post' }
  )

  function setValue(key: string, value: unknown, userEdit = true): boolean {
    const field = fieldFor(key)
    if (!field && !schemaRuntime.value.inputKeys.includes(key)) {
      throw new Error(`[loom][FORM_FIELD_UNKNOWN] Form field "${key}" is not in the schema input.`)
    }
    if (userEdit && field?.behavior?.derived) return false
    const patch = field ? fieldPatch(key, field, value) : { [key]: cloneEditable(value) }
    if (userEdit) for (const name of Object.keys(patch)) edited.add(name)
    const hadControlIssue = clearControlError(key)
    const changed = Object.entries(patch).some(([name, next]) => !equalValue(Reflect.get(draft, name), next))
    if (changed) {
      Object.assign(draft, patch)
      serverIssues.value = serverIssues.value.filter((issue) => !Object.keys(patch).includes(String(issue.path[0])))
    }
    if (!userEdit && !changed && !hadControlIssue) return false
    settleConfirmation(false)
    draftRevision += 1
    cancelValidation()
    emitModel()
    return changed
  }

  function setDerivedValue(key: string, value: unknown): boolean {
    const field = fieldFor(key)
    for (const name of field ? fieldKeys(key, field) : [key]) edited.delete(name)
    return setValue(key, value, false)
  }

  const derivedRuntime = createDerivedRuntime({
    fields: () => fields.value,
    draft,
    context: () => props.context ?? {},
    write: setDerivedValue,
  })

  function setControlError(key: string, message: string | undefined): void {
    if (!fieldFor(key.split('.')[0] ?? key)) {
      throw new Error(`[loom][FORM_FIELD_UNKNOWN] Form field "${key}" is not selected.`)
    }
    if (message === undefined ? !hasOwn(controlIssues, key) : controlIssues[key] === message) return
    clearControlError(key)
    if (message !== undefined) controlIssues[key] = message
    cancelValidation()
  }

  function controlErrorKeys(): readonly string[] {
    return Object.keys(controlIssues)
  }

  function applyUneditedBaseline(value: Readonly<Record<string, unknown>>): void {
    for (const key of schemaRuntime.value.inputKeys) {
      if (edited.has(key)) continue
      if (hasOwn(value, key)) Reflect.set(draft, key, cloneEditable(value[key]))
      else Reflect.deleteProperty(draft, key)
    }
  }

  function controlValue(key: string): unknown {
    const field = fieldFor(key)
    return field ? formFieldValue(key, field, draft) : snapshotEditable(Reflect.get(draft, key))
  }

  function setControlValue(key: string, value: unknown): void {
    const field = fieldFor(key)
    if (!field) throw new Error(`[loom][FORM_FIELD_UNKNOWN] Form field "${key}" is not selected.`)
    setValue(key, value)
  }

  function candidateFor(snapshot: Readonly<Record<string, unknown>>): Record<string, unknown> {
    const visible = new Set<string>(
      resolveConfiguredFields(snapshot)
        .filter((field) => field.visible)
        .flatMap((field) => [...fieldKeys(field.key, field)])
    )
    const selected = new Set(fields.value.flatMap((field) => [...fieldKeys(field.key, field)]))
    const candidate: Record<string, unknown> = {}
    for (const key of schemaRuntime.value.inputKeys) {
      if (selected.has(key) && !visible.has(key)) continue
      if (hasOwn(snapshot, key)) candidate[key] = cloneEditable(snapshot[key])
    }
    return candidate
  }

  function controlIssuesFor(snapshot: Readonly<Record<string, unknown>>): SchemaIssue[] {
    const visible = new Set<string>(
      resolveConfiguredFields(snapshot)
        .filter((field) => field.visible)
        .map((field) => field.key)
    )
    const nextIssues = Object.entries(controlIssues)
      .filter(([key]) => visible.has(key.split('.')[0] ?? key))
      .map(([key, message]) => schemaIssue(key.split('.'), message))
    return nextIssues
  }

  function isCurrentValidation(run: number, controller: AbortController, generation: number, revision: number): boolean {
    return mounted && run === validationRun && !controller.signal.aborted && generation === sessionGeneration.value && revision === draftRevision
  }

  async function performValidation(trigger: 'blur' | 'submit', field?: string, values?: object): Promise<SchemaParseResult<TOutput>> {
    validationController?.abort()
    const controller = new AbortController()
    validationController = controller
    const run = ++validationRun
    const generation = sessionGeneration.value
    const revision = draftRevision
    const snapshot = { ...cloneRecord(draft), ...cloneRecord(values ?? {}) }
    const activeRuntime = schemaRuntime.value
    validating.value = true
    const validatorPaths = (props.validators ?? [])
      .filter((validator) => (validator.triggers ?? ['submit']).includes(trigger))
      .flatMap((validator) => (validator.path?.[0] === undefined ? [] : [String(validator.path[0])]))
    validatingPaths.value = new Set(field === undefined ? validatorPaths : [...validatorPaths, field])
    try {
      const inputIssues = controlIssuesFor(snapshot)
      if (inputIssues.length > 0) {
        const result: SchemaParseResult<TOutput> = { success: false, issues: inputIssues }
        if (isCurrentValidation(run, controller, generation, revision)) issues.value = inputIssues
        return result
      }
      const candidate = candidateFor(snapshot)
      const parsed = await activeRuntime.parseAsync(candidate)
      if (!isCurrentValidation(run, controller, generation, revision)) return { success: false, issues: [] }
      if (!parsed.success) {
        issues.value = parsed.issues
        return parsed
      }

      const validators = (props.validators ?? []).filter((validator) => (validator.triggers ?? ['submit']).includes(trigger))
      const validatorResults = await Promise.all(
        validators.map(async (validator) => {
          try {
            const result = await validator.validate({
              data: parsed.data,
              draft: snapshotDraft<TInput>(snapshot),
              initial: snapshotDraft<TInput>(baseline.value),
              context: (props.context ?? {}) as TContext,
              ...(field !== undefined ? { field } : {}),
              signal: controller.signal,
            })
            return normalizedValidatorIssues(result, validator.path?.[0] === undefined ? 'form' : String(validator.path[0]))
          } catch (error) {
            if (controller.signal.aborted) return []
            return [schemaIssue(validator.path ?? [], issueMessage(error), 'operational')]
          }
        })
      )
      if (!isCurrentValidation(run, controller, generation, revision)) return { success: false, issues: [] }
      const validatorIssues = validatorResults.flat()
      const result: SchemaParseResult<TOutput> = validatorIssues.length > 0 ? { success: false, issues: validatorIssues } : parsed
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
    derivedRuntime.settle()
    return performValidation('submit')
  }

  async function runSubmit(generation: number, revision: number, submitTarget: FormProps<TInput, TOutput, TResult, TKeys, TContext, TFields>['submit'], values?: object, options?: FormSubmitOptions<TInput, TOutput, TResult, TContext>): Promise<void> {
    if (postWriteErrorState.value || !mounted || generation !== sessionGeneration.value || revision !== draftRevision || props.submit !== submitTarget) return
    serverIssues.value = []
    const result = await performValidation('submit', undefined, values)
    if (!result.success) {
      if (mounted && generation === sessionGeneration.value) await focusFirstInvalid()
      return
    }
    if (
      !mounted ||
      generation !== sessionGeneration.value ||
      revision !== draftRevision ||
      props.submit !== submitTarget ||
      postWriteErrorState.value ||
      props.disabled ||
      loading.value ||
      inputPending.value
    )
      return
    const run = options?.run ?? submitTarget
    if (typeof run !== 'function') return
    const request = options?.confirm
    if (request) {
      const accepted = await new Promise<boolean>((resolve) => {
        resolveConfirmation = resolve
        confirmation.value = { ...request }
      })
      if (!accepted || !mounted || generation !== sessionGeneration.value || revision !== draftRevision || props.submit !== submitTarget || props.disabled || loading.value || postWriteErrorState.value || inputPending.value) return
    }
    const mutationOwner = ++mutationSequence
    activeMutationOwner = mutationOwner
    submitting.value = true
    try {
      acceptedValues.value = snapshotEditable(result.data) as Readonly<TOutput>
      const submitted = await run(result.data, { outputs: publications.outputs, context: (props.context ?? {}) as TContext })
      if (mounted && generation === sessionGeneration.value && activeMutationOwner === mutationOwner) {
        if (props.completeOnSubmit) completed.value = true
        events.submitted(submitted)
      }
    } catch (error) {
      if (!mounted || generation !== sessionGeneration.value || activeMutationOwner !== mutationOwner) return
      const normalized = normalizeWriteError(error, props.normalizeError ?? adapters.data.normalizeError)
      if (isConfirmedWriteRefreshError<TResult>(normalized)) {
        postWriteErrorState.value = normalized
        toast.warning('Changes saved. Could not refresh the data.')
        if (props.completeOnSubmit) completed.value = true
        events.submitted(normalized.result, normalized)
        return
      }
      if (normalized.postWrite === true) postWriteErrorState.value = normalized
      if (normalized.issues) serverIssues.value = normalized.issues
      toast.error(normalized.message)
      events.error(normalized)
    } finally {
      if (mounted && generation === sessionGeneration.value && activeMutationOwner === mutationOwner) {
        activeMutationOwner = undefined
        submitting.value = false
      }
    }
  }

  function submit(options?: FormSubmitOptions<TInput, TOutput, TResult, TContext>): Promise<void> {
    if (completed.value || postWriteErrorState.value) return Promise.resolve()
    if (activeSubmit) return activeSubmit
    if (props.disabled || submitting.value || loading.value || inputPending.value) return Promise.resolve()
    derivedRuntime.settle()
    const generation = sessionGeneration.value
    const revision = draftRevision
    const submitTarget = props.submit
    submitAttempted.value = true
    submitPending.value = true
    const values = options?.values === undefined ? undefined : cloneRecord(options.values)
    const selected = options && { ...options, confirm: options.confirm && { ...options.confirm } }
    const attempt = Promise.resolve().then(() => runSubmit(generation, revision, submitTarget, values, selected))
    const ownedAttempt = attempt.finally(async () => {
      if (activeSubmit !== ownedAttempt) return
      activeSubmit = undefined
      submitPending.value = false
      if (displayedIssues.value.length > 0) await focusFirstInvalid()
    })
    activeSubmit = ownedAttempt
    return ownedAttempt
  }

  function touch(key: string): void {
    touched[key] = true
    derivedRuntime.settle()
    if (!submitPending.value) void performValidation('blur', key)
  }

  function issueField(key: string): string {
    return fields.value.find((field) => fieldKeys(field.key, field).includes(key))?.key ?? key
  }

  const visibleIssues = computed(() =>
    [...issues.value, ...serverIssues.value].filter((issue) => {
      const key = issue.path[0]
      return issue.path.length === 0 || submitAttempted.value || (typeof key === 'string' && (touched[issueField(key)] || touched[issue.path.join('.')]))
    })
  )
  const displayedIssues = computed(() => {
    const visible = visibleIssues.value.map((issue) => (typeof issue.path[0] === 'string' ? { ...issue, path: [issueField(issue.path[0]), ...issue.path.slice(1)] } : issue))
    return [
      ...visible,
      ...Object.entries(controlIssues)
        .filter(
          ([key, message]) =>
            visibleKeys.value.includes(key.split('.')[0] ?? key) &&
            (submitAttempted.value || touched[key] || touched[issueField(key.split('.')[0] ?? key)]) &&
            !visible.some((issue) => issue.path.join('.') === key && issue.message === message)
        )
        .map(([key, message]) => schemaIssue(key.split('.'), message)),
    ]
  })

  function issueFor(key: string): string | undefined {
    return displayedIssues.value.find((issue) => issue.path[0] === key)?.message
  }

  function validatingField(key: string): boolean {
    const field = fieldFor(key)
    return validatingPaths.value.has(key) || Boolean(field && fieldKeys(key, field).some((name) => validatingPaths.value.has(name)))
  }

  function touchedField(key: string): boolean {
    return touched[key] === true
  }

  const arrayFields: FormArrayContext = {
    disabled: computed(() => props.disabled === true || submitting.value || submitPending.value),
    id: (path) => `${formId}-field-${path.join('.')}`,
    issue: (path) => displayedIssues.value.find((issue) => issue.path.join('.') === path.join('.'))?.message,
    touch: (path) => {
      touched[path.join('.')] = true
      derivedRuntime.settle()
      if (!submitPending.value) void performValidation('blur', String(path[0]))
    },
    setError: (path, message) => setControlError(path.join('.'), message),
    update: (field, rows, previousIndices, changed) => {
      const oldServerIssues = serverIssues.value
      const previousRows = controlValue(field)
      const oldRow = changed && Array.isArray(previousRows) ? previousRows[changed[0]] : undefined
      const newRow = changed ? rows[changed[0]] : undefined
      const changedPath = (path: readonly (string | number)[]) =>
        changed &&
        path[0] === field &&
        Number(path[1]) === changed[0] &&
        path.length > 2 &&
        isPlainRecord(oldRow) &&
        newRow !== undefined &&
        !equalValue(Reflect.get(oldRow, String(path[2])), Reflect.get(newRow, String(path[2])))
      setValue(field, rows)
      const remap = (entries: readonly SchemaIssue[]) =>
        entries.flatMap((issue) => {
          const path = remapArrayPath(issue.path, field, previousIndices)
          if (!path || changedPath(path)) return []
          return [{ ...issue, path }]
        })
      serverIssues.value = remap(oldServerIssues)
      issues.value = remap(issues.value)
      for (const state of [touched, controlIssues]) {
        const entries = Object.entries(state)
        for (const key of Object.keys(state)) delete state[key]
        for (const [key, value] of entries) {
          const path = remapArrayPath(key.split('.'), field, previousIndices)
          if (path && !(state === controlIssues && changedPath(path))) Reflect.set(state, path.join('.'), value)
        }
      }
    },
  }

  async function focusFirstInvalid(): Promise<void> {
    await nextTick()
    const issue = displayedIssues.value.find((entry) => typeof entry.path[0] === 'string' && visibleKeys.value.includes(entry.path[0]))
    if (!issue) return
    const path = issue.path.join('.')
    const element = document.getElementById(`${formId}-field-${path}`) ?? document.getElementById(`${formId}-field-${issue.path[0]}`)
    const control = element?.matches('input,textarea,select,button,[role="combobox"]') ? element : element?.querySelector<HTMLElement>('input,textarea,select,button,[role="combobox"]')
    element?.scrollIntoView?.({ block: 'nearest' })
    ;(control ?? element)?.focus?.()
  }

  function reset(): void {
    for (const key of Object.keys(controlIssues)) {
      const field = key.split('.')[0] ?? key
      controlGenerations.set(field, (controlGenerations.get(field) ?? 0) + 1)
    }
    outputGeneration.value += 1
    publications.clear()
    acceptedValues.value = undefined
    const next = cloneRecord(baseline.value)
    replaceDraft(next)
    edited.clear()
    for (const key of Object.keys(touched)) delete touched[key]
    for (const key of Object.keys(controlIssues)) delete controlIssues[key]
    issues.value = []
    serverIssues.value = []
    submitAttempted.value = false
    if (modelValuePresent) emitModel()
    events.reset()
  }

  function recoveryIsCurrent(error: SubmitError, generation: number, target: string): boolean {
    return mounted && generation === sessionGeneration.value && target === writeTargetSignature.value && postWriteErrorState.value === error
  }

  function refresh(): Promise<void> {
    const confirmedError = postWriteErrorState.value
    if (confirmedError && isConfirmedWriteRefreshError(confirmedError)) {
      if (activeRecovery?.error === confirmedError && activeRecovery.target === writeTargetSignature.value) return activeRecovery.promise
      const generation = sessionGeneration.value
      const target = writeTargetSignature.value
      const recovery = Promise.resolve()
        .then(confirmedError.refresh)
        .then(
          () => {
            if (recoveryIsCurrent(confirmedError, generation, target)) postWriteErrorState.value = undefined
          },
          (error: unknown) => {
            if (recoveryIsCurrent(confirmedError, generation, target) && !isCancelledError(error)) {
              toast.warning('Changes saved. Could not refresh the data.')
            }
          }
        )
      const ownedRecovery = recovery.finally(() => {
        if (activeRecovery?.promise === ownedRecovery) activeRecovery = undefined
      })
      activeRecovery = { error: confirmedError, target, promise: ownedRecovery }
      return ownedRecovery
    }
    if (modelValuePresent || props.load === undefined) return Promise.resolve()
    return loader.refresh()
  }

  function applyLoaded(value: FormDraft<TInput> | undefined): void {
    if (modelValuePresent || value === undefined || !mounted) return
    const mapped = copyInputValues(value, schemaRuntime.value.inputKeys)
    loadedValues.value = mapped
    const nextBaseline = mergeInputValues(schemaRuntime.value.inputKeys, [defaults.value, props.initialData, loadedValues.value])
    applyUneditedBaseline(nextBaseline)
    baseline.value = nextBaseline
    settleConfirmation(false)
    draftRevision += 1
    cancelValidation()
  }

  watch(loaded, (value) => applyLoaded(value), { immediate: true })
  watch(
    () => props.initialData,
    (value) => {
      if (modelValuePresent) return
      const nextBaseline = mergeInputValues(schemaRuntime.value.inputKeys, [defaults.value, value, loadedValues.value])
      applyUneditedBaseline(nextBaseline)
      baseline.value = nextBaseline
      settleConfirmation(false)
      draftRevision += 1
      cancelValidation()
    },
    { deep: true }
  )
  watch(
    () => props.modelValue,
    (value) => {
      if (!modelValuePresent) return
      const next = mergeInputValues(schemaRuntime.value.inputKeys, [defaults.value, props.initialData, value])
      if (lastEmittedModel && equalRecord(next, cloneRecord(lastEmittedModel)) && equalRecord(next, cloneRecord(draft))) return
      replaceDraft(next)
      baseline.value = cloneRecord(next)
      edited.clear()
      for (const key of Object.keys(touched)) delete touched[key]
      issues.value = []
      serverIssues.value = []
    },
    { deep: true }
  )

  watch(() => props.submit, () => settleConfirmation(false), { flush: 'sync' })
  const keySignature = computed(() => JSON.stringify(fields.value.map((field) => [field.key, fieldKeys(field.key, field)])))
  const writeTargetSignature = computed(() => JSON.stringify(stableValue([props.resource, props.id])))
  watch(writeTargetSignature, () => {
    postWriteErrorState.value = undefined
  })
  const identitySignature = computed(() => JSON.stringify(recordCacheKey(owner.value, props.id, 'form', props.namespace, props.searchParameters ?? {})))
  watch([() => props.schema, keySignature, identitySignature], ([schema, keys, identity], previous) => {
    if (!previous) return
    const [previousSchema, previousKeys, previousIdentity] = previous
    if (schema === previousSchema && keys === previousKeys && identity === previousIdentity) return
    settleConfirmation(false)
    sessionGeneration.value += 1
    completed.value = false
    acceptedValues.value = undefined
    outputGeneration.value += 1
    publications.clear()
    abandonSessionWork()
    cancelValidation()
    loadedValues.value = {}
    const nextFields = fields.value
    defaults.value = formDefaults(nextFields, [props.initialData, modelValuePresent ? props.modelValue : undefined])
    const next = mergeInputValues(schemaRuntime.value.inputKeys, [defaults.value, props.initialData, modelValuePresent ? props.modelValue : undefined])
    baseline.value = cloneRecord(next)
    replaceDraft(next)
    edited.clear()
    for (const key of Object.keys(touched)) delete touched[key]
    for (const key of Object.keys(controlIssues)) delete controlIssues[key]
    issues.value = []
    serverIssues.value = []
    submitAttempted.value = false
    if (identity === previousIdentity) applyLoaded(loaded.value)
    if (modelValuePresent && !equalRecord(next, mergeInputValues(schemaRuntime.value.inputKeys, [props.modelValue]))) nextTick(emitModel)
  })

  onUnmounted(() => {
    outputGeneration.value += 1
    mounted = false
    settleConfirmation(false)
    sessionGeneration.value += 1
    abandonSessionWork()
    cancelValidation()
    derivedRuntime.stop()
  })

  if (modelValuePresent && !equalRecord(initialValues, mergeInputValues(schemaRuntime.value.inputKeys, [props.modelValue]))) {
    nextTick(() => {
      if (mounted) emitModel()
    })
  }

  return {
    confirmation: computed(() => confirmation.value),
    settleConfirmation,
    submittedValues,
    arrayFields,
    draft: readonlyDraft,
    dirty,
    submitting: computed(() => submitting.value),
    submitPending: computed(() => submitPending.value),
    postWriteError,
    validating: computed(() => validating.value),
    inputPending,
    loading,
    loadError,
    issues: displayedIssues,
    visibleFields,
    visibleKeys,
    formId,
    hasSubmit,
    fieldFor,
    controlValue,
    setValue: (key, value) => setValue(key, value),
    setControlValue,
    setControlError,
    controlErrorKeys,
    controlGeneration: (key) => controlGenerations.get(key) ?? 0,
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
