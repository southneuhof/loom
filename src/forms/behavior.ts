import { computed, watch, type WatchStopHandle } from 'vue'
import type { FormBehaviorContext, FormDraftSnapshot } from '../contracts/forms'
import { formFieldValue } from './fieldBinding'
import { snapshotEditable } from './draftValues'
import type { RuntimeFormField } from './definitionTypes'

export interface DerivedRuntimeOptions<
  TInput extends object,
  TKeys extends string = Extract<keyof TInput, string>,
> {
  fields: () => readonly RuntimeFormField<TInput, TKeys>[]
  draft: object
  context: () => Readonly<Record<string, unknown>>
  write: (key: string, value: unknown) => boolean
}

export interface DerivedRuntime {
  settle: () => void
  stop: () => void
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
  const callback = field.behavior?.derived
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
    value: formFieldValue(field.key, field, draft),
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

export function createDerivedRuntime<TInput extends object, TKeys extends string>(
  options: DerivedRuntimeOptions<TInput, TKeys>,
): DerivedRuntime {
  const results = computed<ReadonlyMap<string, unknown>>(() => {
    const fields = options.fields()
    const effectKeys = new Set<string>(fields.filter((field) => typeof field.behavior?.derived === 'function').map((field) => field.key))
    const dependenciesByKey = new Map<string, readonly string[]>()
    const derived = new Map<string, unknown>()
    for (const field of fields) {
      if (typeof field.behavior?.derived !== 'function') continue
      const dependencies = new Set<string>()
      const value = callbackResult(field, options.draft, options.context(), dependencies)
      dependenciesByKey.set(field.key, [...dependencies].filter((dependency) => effectKeys.has(dependency)))
      derived.set(field.key, value)
    }
    const cycle = cycleIn(dependenciesByKey)
    if (cycle) throw new Error(`[loom][SURFACE_OPTION_INVALID] Form behavior value-effect cycle: ${cycle.join(' -> ')}.`)
    return derived
  })

  const settle = () => {
    let changed: boolean
    do {
      changed = false
      for (const key of options.fields().map((field) => field.key)) {
        const field = options.fields().find((candidate) => candidate.key === key)
        if (!field || typeof field.behavior?.derived !== 'function') continue
        const current = results.value
        if (!current.has(key)) continue
        const value = current.get(key)
        if (Object.is(formFieldValue(key, field, options.draft), value)) continue
        const wrote = options.write(key, value)
        changed = wrote || changed
      }
    } while (changed)
  }

  const stop: WatchStopHandle = watch(results, settle, { immediate: true })

  return { settle, stop }
}
