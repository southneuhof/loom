import { computed, watch, type ComputedRef, type WatchStopHandle } from 'vue'
import type { FormBehaviorContext, FormDraftSnapshot, FormInput } from '../contracts/forms'
import type { Label } from '../contracts/labels'
import { resolveLabel } from '../labels/resolveLabel'
import { formFieldValue } from './fieldBinding'
import { snapshotEditable } from './draftValues'

export interface FormBehaviorState {
  visible: boolean
  disabled: boolean
  label: string
  renderer: string
  props: Readonly<Record<string, unknown>>
  span?: number
  required: boolean
  derived?: unknown
}

export interface FormBehaviorRuntime {
  state: (key: string) => ComputedRef<FormBehaviorState>
  settle: () => void
  connect: (write: (key: string, value: unknown) => void) => WatchStopHandle
}

export interface FormBehaviorRuntimeOptions<
  TInput extends object,
  TKeys extends string = Extract<keyof TInput, string>,
> {
  fields: readonly RuntimeFormField<TInput, TKeys>[]
  draft: object
  context: () => Readonly<Record<string, unknown>>
  labels: () => Readonly<Record<string, Label | undefined>> | undefined
}

export type RuntimeFormField<
  TInput extends object,
  TKeys extends string = Extract<keyof TInput, string>,
> = {
  key: Extract<TKeys, string>
  input: FormInput<TInput>
  required: boolean
}

function invalidBehavior(key: string, member: string): never {
  throw new Error(`[loom][SURFACE_OPTION_INVALID] Form field "${key}" member "${member}" must be a function.`)
}

export function assertFormBehavior(value: unknown, key: string): void {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) invalidBehavior(key, 'behavior')
  const behavior = value as Record<string, unknown>
  for (const [member, callback] of Object.entries(behavior)) {
    if (member !== 'derived') invalidBehavior(key, `behavior.${member}`)
    if (typeof callback !== 'function') invalidBehavior(key, `behavior.${member}`)
  }
}

function callbackResult<TInput extends object, TKeys extends string>(
  field: RuntimeFormField<TInput, TKeys>,
  draft: object,
  context: Readonly<Record<string, unknown>>,
  dependencies: Set<string>,
): unknown {
  const callback = field.input.behavior?.derived
  if (typeof callback !== 'function') return undefined
  const readonlyDraft = new Proxy(draft, {
    get(target, property, receiver) {
      if (typeof property === 'string') dependencies.add(property)
      return snapshotEditable(Reflect.get(target, property, receiver))
    },
    set(_target, property) {
      throw new Error(`[loom][SURFACE_OPTION_INVALID] Form field "${field.key}" behavior.derived cannot write draft.${String(property)}.`)
    },
    deleteProperty(_target, property) {
      throw new Error(`[loom][SURFACE_OPTION_INVALID] Form field "${field.key}" behavior.derived cannot delete draft.${String(property)}.`)
    },
    defineProperty(_target, property) {
      throw new Error(`[loom][SURFACE_OPTION_INVALID] Form field "${field.key}" behavior.derived cannot define draft.${String(property)}.`)
    },
    getOwnPropertyDescriptor(target, property) {
      const descriptor = Reflect.getOwnPropertyDescriptor(target, property)
      if (!descriptor || !('value' in descriptor)) return descriptor
      return { ...descriptor, value: snapshotEditable(descriptor.value) }
    },
  })
  const behaviorContext: FormBehaviorContext<TInput, unknown> = {
    draft: readonlyDraft as FormDraftSnapshot<TInput>,
    value: formFieldValue(field.key, field.input, draft),
    context,
  }
  return callback(behaviorContext)
}

function cycleIn(edges: ReadonlyMap<string, readonly string[]>): string[] | undefined {
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const visit = (key: string, path: string[]): string[] | undefined => {
    if (visiting.has(key)) return [...path.slice(path.indexOf(key)), key]
    if (visited.has(key)) return undefined
    visiting.add(key)
    for (const dependency of edges.get(key) ?? []) {
      const found = visit(dependency, [...path, key])
      if (found) return found
    }
    visiting.delete(key)
    visited.add(key)
    return undefined
  }
  for (const key of edges.keys()) {
    const found = visit(key, [])
    if (found) return found
  }
  return undefined
}

export function createFormBehaviorRuntime<TInput extends object, TKeys extends string>(
  options: FormBehaviorRuntimeOptions<TInput, TKeys>,
): FormBehaviorRuntime {
  const effectKeys = new Set<string>(options.fields.filter((field) => field.input.behavior?.derived).map((field) => field.key))
  const effectDependencies = new Map<string, readonly string[]>()
  const states = new Map<string, ComputedRef<FormBehaviorState>>()
  for (const field of options.fields) {
    states.set(field.key, computed(() => {
      const renderer = field.input.renderer
      const derivedCallback = field.input.behavior?.derived
      let derived: unknown
      if (typeof derivedCallback === 'function') {
        const dependencies = new Set<string>()
        derived = callbackResult(field, options.draft, options.context(), dependencies)
        effectDependencies.set(field.key, [...dependencies].filter((dependency) => effectKeys.has(dependency)))
        const cycle = cycleIn(effectDependencies)
        if (cycle) throw new Error(`[loom][SURFACE_OPTION_INVALID] Form behavior value-effect cycle: ${cycle.join(' -> ')}.`)
      }
      const state: FormBehaviorState = {
        visible: field.input.visible !== false,
        disabled: typeof derivedCallback === 'function',
        label: resolveLabel(field.key, field.input.label, options.labels()),
        renderer,
        props: field.input.props ?? {},
        required: field.required,
        ...(typeof field.input.span === 'number' ? { span: field.input.span } : {}),
        ...(typeof derivedCallback === 'function' ? { derived } : {}),
      }
      return state
    }))
  }

  const state = (key: string): ComputedRef<FormBehaviorState> => {
    const found = states.get(key)
    if (!found) throw new Error(`[loom][FORM_FIELD_UNKNOWN] Form field "${key}" has no behavior state.`)
    return found
  }
  let write: ((key: string, value: unknown) => void) | undefined
  const settle = () => {
    if (!write) return
    for (const field of options.fields) {
      if (typeof field.input.behavior?.derived !== 'function') continue
      const value = state(field.key).value.derived
      if (!Object.is(formFieldValue(field.key, field.input, options.draft), value)) write(field.key, value)
    }
  }
  const connect = (nextWrite: (key: string, value: unknown) => void): WatchStopHandle => {
    write = nextWrite
    const stops: WatchStopHandle[] = []
    for (const field of options.fields) {
      if (typeof field.input.behavior?.derived === 'function') {
        stops.push(watch(() => state(field.key).value.derived, (value) => {
          if (!Object.is(formFieldValue(field.key, field.input, options.draft), value)) nextWrite(field.key, value)
        }, { immediate: true, flush: 'sync' }))
      }
    }
    return () => {
      write = undefined
      for (const stop of stops) stop()
    }
  }
  return { state, settle, connect }
}
