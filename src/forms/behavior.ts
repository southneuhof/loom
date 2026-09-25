import { computed, watch, type ComputedRef, type WatchStopHandle } from 'vue'
import type { FormBehaviorContext } from '../contracts/forms'
import type { Label } from '../contracts/labels'
import { resolveLabel } from '../labels/resolveLabel'
import type { CompiledFormField } from './compileForm'
import { isPlainRecord, snapshotEditable } from './draftValues'

const behaviorMembers = new Set(['visible', 'disabled', 'props', 'presentation', 'derived', 'resetWhen'])
const presentationMembers = new Set(['renderer', 'label', 'props', 'span', 'required'])

export interface FormBehaviorState {
  visible: boolean
  disabled: boolean
  label: string
  renderer?: string
  props: Readonly<Record<string, unknown>>
  span?: number
  required: boolean
  derived?: unknown
}

export interface FormBehaviorRuntime {
  state: (key: string) => ComputedRef<FormBehaviorState>
  visibleKeys: ComputedRef<string[]>
  settle: () => void
  connect: (write: (key: string, value: unknown) => void, reset: (key: string) => void) => WatchStopHandle
}

export interface FormBehaviorRuntimeOptions {
  fields: readonly CompiledFormField[]
  draft: object
  context: () => Readonly<Record<string, unknown>>
  labels: () => Readonly<Record<string, Label | undefined>> | undefined
  resolveBaseProps: (field: CompiledFormField, renderer: string) => Record<string, unknown>
}

interface FormPresentationRuntime {
  renderer?: string | null
  label?: Label | null
  props?: Record<string, unknown> | null
  span?: number | null
  required?: boolean | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isLabel(value: unknown): value is Label {
  return typeof value === 'string' || typeof value === 'function'
}

function invalidBehavior(key: string, member: string, expected: string): never {
  throw new Error(`[loom][SURFACE_OPTION_INVALID] Form field "${key}" member "${member}" must be ${expected}.`)
}

export function assertFormBehavior(value: unknown, key: string): void {
  if (!isRecord(value)) invalidBehavior(key, 'behavior', 'an object')
  for (const [member, callback] of Object.entries(value)) {
    if (!behaviorMembers.has(member)) invalidBehavior(key, `behavior.${member}`, 'a supported behavior member')
    if (typeof callback !== 'function') invalidBehavior(key, `behavior.${member}`, 'a function')
  }
  if (typeof value.derived === 'function' && typeof value.resetWhen === 'function') {
    throw new Error(`[loom][SURFACE_OPTION_INVALID] Form field "${key}" cannot use behavior.derived and behavior.resetWhen together.`)
  }
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

function equalRecord(left: Readonly<Record<string, unknown>>, right: Readonly<Record<string, unknown>>): boolean {
  const keys = Object.keys(left)
  return keys.length === Object.keys(right).length && keys.every((key) => Object.is(left[key], right[key]))
}

function callbackResult(
  field: CompiledFormField,
  member: string,
  draft: object,
  context: Readonly<Record<string, unknown>>,
  dependencies?: Set<string>,
): unknown {
  const callback = field.behavior?.[member]
  if (typeof callback !== 'function') return undefined
  const proxy = new Proxy(draft, {
    get(target, property, receiver) {
      if (dependencies && typeof property === 'string') dependencies.add(property)
      return snapshotEditable(Reflect.get(target, property, receiver))
    },
    set(_target, property) {
      throw new Error(`[loom][SURFACE_OPTION_INVALID] Form field "${field.key}" behavior.${member} cannot write draft.${String(property)}.`)
    },
    deleteProperty(_target, property) {
      throw new Error(`[loom][SURFACE_OPTION_INVALID] Form field "${field.key}" behavior.${member} cannot delete draft.${String(property)}.`)
    },
    defineProperty(_target, property) {
      throw new Error(`[loom][SURFACE_OPTION_INVALID] Form field "${field.key}" behavior.${member} cannot define draft.${String(property)}.`)
    },
    getOwnPropertyDescriptor(target, property) {
      const descriptor = Reflect.getOwnPropertyDescriptor(target, property)
      if (!descriptor || !('value' in descriptor)) return descriptor
      return { ...descriptor, value: snapshotEditable(descriptor.value) }
    },
  })
  const behaviorContext: FormBehaviorContext<object, unknown> = {
    draft: proxy,
    value: snapshotEditable(Reflect.get(draft, field.key)) as unknown,
    context,
  }
  return callback(behaviorContext)
}

function assertPresentation(field: CompiledFormField, value: unknown): FormPresentationRuntime | undefined {
  if (value === undefined) return undefined
  if (!isRecord(value)) invalidBehavior(field.key, 'behavior.presentation', 'an object')
  for (const member of Object.keys(value)) {
    if (!presentationMembers.has(member)) invalidBehavior(field.key, `behavior.presentation.${member}`, 'a presentation member')
  }
  const result: FormPresentationRuntime = {}
  if (value.label !== undefined && value.label !== null && !isLabel(value.label)) {
    invalidBehavior(field.key, 'behavior.presentation.label', 'a string, a function, or null')
  }
  if (isLabel(value.label) || value.label === null) result.label = value.label
  if (value.renderer !== undefined && value.renderer !== null && typeof value.renderer !== 'string') {
    invalidBehavior(field.key, 'behavior.presentation.renderer', 'a registered renderer key or null')
  }
  if (typeof value.renderer === 'string' || value.renderer === null) result.renderer = value.renderer
  if (value.props !== undefined && value.props !== null && !isRecord(value.props)) {
    invalidBehavior(field.key, 'behavior.presentation.props', 'an object or null')
  }
  if (isRecord(value.props) && Object.hasOwn(value.props, 'required')) {
    invalidBehavior(field.key, 'behavior.presentation.props.required', 'controlled by the input schema')
  }
  if (isRecord(value.props)) result.props = { ...value.props }
  else if (value.props === null) result.props = null
  if (value.span !== undefined && value.span !== null && (typeof value.span !== 'number' || !Number.isInteger(value.span) || value.span < 1)) {
    invalidBehavior(field.key, 'behavior.presentation.span', 'a positive integer or null')
  }
  if (typeof value.span === 'number' || value.span === null) result.span = value.span
  if (value.required !== undefined && value.required !== null && typeof value.required !== 'boolean') {
    invalidBehavior(field.key, 'behavior.presentation.required', 'a boolean or null')
  }
  if (typeof value.required === 'boolean' || value.required === null) result.required = value.required
  return result
}

function assertProps(field: CompiledFormField, props: Readonly<Record<string, unknown>>, member: string): void {
  if (Object.hasOwn(props, 'required')) invalidBehavior(field.key, `${member}.required`, 'controlled by the input schema')
}

export function createFormBehaviorRuntime(options: FormBehaviorRuntimeOptions): FormBehaviorRuntime {
  for (const field of options.fields) {
    if (field.behavior) assertFormBehavior(field.behavior, field.key)
  }

  const effectKeys = new Set(options.fields.filter((field) => field.behavior?.derived || field.behavior?.resetWhen).map((field) => field.key))
  const effectDependencies = new Map<string, readonly string[]>()
  const evaluate = (field: CompiledFormField, member: string): unknown => {
    const dependencies = member === 'derived' || member === 'resetWhen' ? new Set<string>() : undefined
    const value = callbackResult(field, member, options.draft, options.context(), dependencies)
    if (member === 'derived' || member === 'resetWhen') {
      effectDependencies.set(field.key, [...(dependencies ?? [])].filter((dependency) => effectKeys.has(dependency)))
      const cycle = cycleIn(effectDependencies)
      if (cycle) throw new Error(`[loom][SURFACE_OPTION_INVALID] Form behavior value-effect cycle: ${cycle.join(' -> ')}.`)
    }
    return value
  }

  const states = new Map<string, ComputedRef<FormBehaviorState>>()
  for (const field of options.fields) {
    let previousProps: Readonly<Record<string, unknown>> = field.props
    let previousState: FormBehaviorState | undefined
    states.set(field.key, computed(() => {
      const behavior = field.behavior
      const visibleResult = evaluate(field, 'visible')
      const disabledResult = evaluate(field, 'disabled')
      if (visibleResult !== undefined && typeof visibleResult !== 'boolean') invalidBehavior(field.key, 'behavior.visible', 'a boolean')
      if (disabledResult !== undefined && typeof disabledResult !== 'boolean') invalidBehavior(field.key, 'behavior.disabled', 'a boolean')
      const presentation = assertPresentation(field, evaluate(field, 'presentation'))
      const rendererMember = presentation && Object.hasOwn(presentation, 'renderer') ? presentation.renderer : field.renderer
      const renderer = typeof rendererMember === 'string' ? rendererMember : field.renderer
      let props = options.resolveBaseProps(field, renderer)
      const behaviorProps = evaluate(field, 'props')
      if (behaviorProps !== undefined) {
        if (!isRecord(behaviorProps)) invalidBehavior(field.key, 'behavior.props', 'an object')
        assertProps(field, behaviorProps, 'behavior.props')
        props = { ...props, ...behaviorProps }
      }
      if (presentation?.props === null) props = { ...field.props }
      else if (isRecord(presentation?.props)) {
        assertProps(field, presentation.props, 'behavior.presentation.props')
        props = { ...props, ...presentation.props }
      }
      assertProps(field, props, 'props')
      if (!equalRecord(props, previousProps)) previousProps = props
      const labelMember = presentation && Object.hasOwn(presentation, 'label') ? presentation.label : field.label
      const label = resolveLabel(field.key, labelMember, options.labels())
      const state: FormBehaviorState = {
        visible: visibleResult !== false,
        disabled: Boolean(disabledResult) || typeof behavior?.derived === 'function',
        label,
        props: previousProps,
        required: presentation?.required == null ? field.required : presentation.required === true,
      }
      state.renderer = renderer
      const span = presentation && Object.hasOwn(presentation, 'span') ? presentation.span : field.span
      if (typeof span === 'number') state.span = span
      if (typeof behavior?.derived === 'function') state.derived = evaluate(field, 'derived')
      if (previousState && previousState.visible === state.visible && previousState.disabled === state.disabled && previousState.label === state.label && previousState.renderer === state.renderer && previousState.props === state.props && previousState.span === state.span && previousState.required === state.required && Object.is(previousState.derived, state.derived)) {
        return previousState
      }
      previousState = state
      return state
    }))
  }

  const state = (key: string): ComputedRef<FormBehaviorState> => {
    const found = states.get(key)
    if (!found) throw new Error(`[loom][FORM_FIELD_UNKNOWN] Form field "${key}" has no behavior state.`)
    return found
  }
  const visibleKeys = computed(() => options.fields.filter((field) => state(field.key).value.visible).map((field) => field.key))
  let write: ((key: string, value: unknown) => void) | undefined
  const settle = () => {
    if (!write) return
    for (const field of options.fields) {
      if (typeof field.behavior?.derived !== 'function') continue
      const value = state(field.key).value.derived
      if (!Object.is(Reflect.get(options.draft, field.key), value)) write(field.key, value)
    }
  }
  const connect = (nextWrite: (key: string, value: unknown) => void, nextReset: (key: string) => void): WatchStopHandle => {
    write = nextWrite
    const stops: WatchStopHandle[] = []
    for (const field of options.fields) {
      if (typeof field.behavior?.derived === 'function') {
        stops.push(watch(() => state(field.key).value.derived, (value) => {
          if (!Object.is(Reflect.get(options.draft, field.key), value)) nextWrite(field.key, value)
        }, { immediate: true, flush: 'sync' }))
      }
      if (typeof field.behavior?.resetWhen === 'function') {
        stops.push(watch(() => evaluate(field, 'resetWhen'), (value, previous) => {
          if (!Object.is(value, previous)) nextReset(field.key)
        }, { flush: 'sync' }))
      }
    }
    return () => {
      write = undefined
      for (const stop of stops) stop()
    }
  }
  return { state, visibleKeys, settle, connect }
}
