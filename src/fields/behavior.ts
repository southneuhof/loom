/** Reactive, pure form behavior and synchronous value effects. */
import { computed, watch, type ComputedRef, type WatchStopHandle } from 'vue'
import type { FieldBehavior, FieldBehaviorPresentation, FieldContext } from '../contracts'
import type { ResolvedSurfaceField } from './resolve'

export interface FieldBehaviorState {
  visible: boolean
  disabled: boolean
  label?: string | null
  renderer?: string | null
  props: Record<string, unknown>
  span?: number | null
  derived?: unknown
}

export interface BehaviorRuntimeOptions<TDraft extends object> {
  fields: readonly ResolvedSurfaceField<Record<string, unknown>, TDraft>[]
  draft: TDraft
  context?: FieldContext
  onDependencies?: (key: string, dependencies: readonly string[]) => void
  resolveBaseProps?: (field: ResolvedSurfaceField<Record<string, unknown>, TDraft>, renderer: string) => Record<string, unknown>
}

export interface BehaviorRuntime<TDraft extends object> {
  state: (key: string) => ComputedRef<FieldBehaviorState>
  visibleKeys: ComputedRef<string[]>
  visibleDraft: ComputedRef<Partial<TDraft>>
  connect: (write: (key: string, value: unknown) => void) => WatchStopHandle
  /** Flushes derived/reset effects before validation or programmatic submission. */
  settle: () => void
}

const behaviorOptionNames = ['visible', 'disabled', 'props', 'presentation', 'derived', 'resetWhen'] as const

export function assertBehavior(key: string, behavior: FieldBehavior<never> | undefined): void {
  if (!behavior) return
  for (const [option, value] of Object.entries(behavior)) {
    if (!(behaviorOptionNames as readonly string[]).includes(option)) throw new Error(`[loom] Unknown behavior option "${option}" on field "${key}".`)
    if (typeof value !== 'function') throw new Error(`[loom] behavior.${option} on field "${key}" must be a function; constants belong in the static projection.`)
  }
  if (behavior.derived && behavior.resetWhen) throw new Error(`[loom] Field "${key}" declares both behavior.derived and behavior.resetWhen.`)
}

function shallowEqual(left: Record<string, unknown>, right: Record<string, unknown>): boolean {
  const keys = Object.keys(left)
  return keys.length === Object.keys(right).length && keys.every((key) => Object.is(left[key], right[key]))
}

function recordingDraft<TDraft extends object>(draft: TDraft, key: string, seen: Set<string>): TDraft {
  return new Proxy(draft, {
    get(target, property, receiver) {
      if (typeof property === 'string') seen.add(property)
      return Reflect.get(target, property, receiver)
    },
    set(_target, property) {
      throw new Error(`[loom] behavior on field "${key}" tried to write draft.${String(property)}; behavior functions must be pure.`)
    },
    deleteProperty(_target, property) {
      throw new Error(`[loom] behavior on field "${key}" tried to delete draft.${String(property)}; behavior functions must be pure.`)
    },
  }) as TDraft
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

export function createBehaviorRuntime<TDraft extends object>(options: BehaviorRuntimeOptions<TDraft>): BehaviorRuntime<TDraft> {
  const context = options.context ?? {}
  for (const field of options.fields) assertBehavior(field.key, field.behavior)

  const valueEffectKeys = new Set(options.fields.filter((field) => field.behavior?.derived || field.behavior?.resetWhen).map((field) => field.key))
  const effectDependencies = new Map<string, readonly string[]>()
  const evaluate = <TResult>(key: string, run: (draft: TDraft, value: unknown) => TResult, valueEffect = false): TResult => {
    const seen = new Set<string>()
    const result = run(recordingDraft(options.draft, key, seen), options.draft[key])
    const dependencies = [...seen]
    options.onDependencies?.(key, dependencies)
    if (valueEffect) {
      effectDependencies.set(key, dependencies.filter((dependency) => valueEffectKeys.has(dependency)))
      const cycle = cycleIn(effectDependencies)
      if (cycle) throw new Error(`[loom] Value-effect cycle: ${cycle.join(' -> ')}.`)
    }
    return result
  }

  const states = new Map<string, ComputedRef<FieldBehaviorState>>()
  for (const field of options.fields) {
    const behavior = field.behavior
    let lastProps = field.props
    let lastState: FieldBehaviorState | undefined
    states.set(field.key, computed(() => {
      const visible = behavior?.visible ? evaluate(field.key, (draft, value) => behavior.visible!({ draft, value, context })) : true
      const disabled = Boolean(behavior?.derived) || (behavior?.disabled ? evaluate(field.key, (draft, value) => behavior.disabled!({ draft, value, context })) : false)
      let presentation: FieldBehaviorPresentation | undefined
      if (behavior?.presentation) presentation = evaluate(field.key, (draft, value) => behavior.presentation!({ draft, value, context }))
      const renderer = presentation?.renderer === undefined ? field.renderer : presentation.renderer ?? undefined
      let props = renderer && options.resolveBaseProps ? options.resolveBaseProps(field, renderer) : field.props
      if (behavior?.props) props = { ...props, ...evaluate(field.key, (draft, value) => behavior.props!({ draft, value, context })) }
      if (presentation?.props === null) props = {}
      else if (presentation?.props) props = { ...props, ...presentation.props }
      if (shallowEqual(props, lastProps)) props = lastProps
      else lastProps = props
      const state: FieldBehaviorState = { visible, disabled, props }
      if (presentation?.label !== undefined) state.label = presentation.label
      if (presentation?.renderer !== undefined) state.renderer = presentation.renderer
      if (presentation?.span !== undefined) state.span = presentation.span
      if (behavior?.derived) state.derived = evaluate(field.key, (draft, value) => behavior.derived!({ draft, value, context }), true)
      if (lastState && lastState.visible === state.visible && lastState.disabled === state.disabled && lastState.label === state.label && lastState.renderer === state.renderer && lastState.props === state.props && lastState.span === state.span && Object.is(lastState.derived, state.derived)) return lastState
      lastState = state
      return state
    }))
  }
  const state = (key: string) => {
    const found = states.get(key)
    if (!found) throw new Error(`[loom] No behavior state for field "${key}".`)
    return found
  }
  const visibleKeys = computed(() => options.fields.filter((field) => state(field.key).value.visible).map((field) => field.key))
  const visibleDraft = computed(() => {
    const result: Record<string, unknown> = {}
    const visible = new Set(visibleKeys.value)
    for (const [key, value] of Object.entries(options.draft)) if (!options.fields.some((field) => field.key === key) || visible.has(key)) result[key] = value
    return result as Partial<TDraft>
  })

  let write: ((key: string, value: unknown) => void) | undefined
  const settle = () => {
    if (!write) return
    for (const field of options.fields) {
      if (!field.behavior?.derived) continue
      const value = state(field.key).value.derived
      if (!Object.is(options.draft[field.key], value)) write(field.key, value)
    }
  }
  const connect = (nextWrite: (key: string, value: unknown) => void): WatchStopHandle => {
    write = nextWrite
    const stops: WatchStopHandle[] = []
    for (const field of options.fields) {
      const behavior = field.behavior
      if (behavior?.derived) stops.push(watch(() => [state(field.key).value.derived, options.draft[field.key]], ([value]) => {
        if (!Object.is(options.draft[field.key], value)) nextWrite(field.key, value)
      }, { immediate: true, flush: 'sync' }))
      if (behavior?.resetWhen) stops.push(watch(() => evaluate(field.key, (draft, value) => behavior.resetWhen!({ draft, value, context }), true), (next, previous) => {
        if (!Object.is(next, previous)) nextWrite(field.key, undefined)
      }, { flush: 'sync' }))
    }
    return () => { write = undefined; stops.forEach((stop) => stop()) }
  }
  return { state, visibleKeys, visibleDraft, connect, settle }
}
