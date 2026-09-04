/**
 * Namespaced query ownership.
 *
 * Each table owns an independent query stored under a URL namespace, so two
 * tables in one route never fight over `page`. The default namespace derives
 * from the resource key; `namespace` is the public override, required only when
 * one resource appears twice in a single view. A local query object bypasses
 * URL persistence entirely.
 *
 * Core components never import the router: reading and writing the URL happens
 * through the project query adapter.
 */
import { onScopeDispose, ref, toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue'
import type { QueryNamespace, QueryValues } from '../contracts'
import { useFrameworkAdapters } from '../adapters/projectAdapters'

/** `incident-actions` -> `incident-actions.page` */
export function namespaceFromResourceKey(key: string): QueryNamespace {
  return key
}

function coerceValue(raw: unknown, fallback: unknown): unknown {
  if (raw === undefined || raw === null || raw === '') return fallback
  if (typeof fallback === 'number') {
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : fallback
  }
  if (typeof fallback === 'boolean') {
    if (raw === true || raw === 'true') return true
    if (raw === false || raw === 'false') return false
    return fallback
  }
  if (Array.isArray(fallback)) return Array.isArray(raw) ? raw : [raw]
  return raw
}

/** Applies defaults and repairs malformed URL values without throwing. */
export function coerceQueryValues(raw: QueryValues, defaults: QueryValues): QueryValues {
  const result: QueryValues = { ...defaults }
  for (const [key, value] of Object.entries(raw)) {
    result[key] = coerceValue(value, defaults[key])
  }
  return result
}

function serialize(values: QueryValues): string {
  return JSON.stringify(
    Object.keys(values)
      .sort()
      .map((key) => [key, values[key]]),
  )
}

export interface NamespacedQueryOptions {
  namespace: MaybeRefOrGetter<QueryNamespace>
  defaults?: MaybeRefOrGetter<QueryValues>
  /** Externally controlled query state; when present the URL is not touched. */
  local?: Ref<QueryValues>
}

export interface NamespacedQuery {
  values: Ref<QueryValues>
  update: (patch: QueryValues) => void
  /** Sets the whole query, discarding keys absent from `values`. */
  replace: (values: QueryValues) => void
  reset: () => void
}

export function useNamespacedQuery(options: NamespacedQueryOptions): NamespacedQuery {
  const adapters = useFrameworkAdapters()
  const readDefaults = () => ({ ...(toValue(options.defaults) ?? {}) })

  if (options.local) {
    const local = options.local
    local.value = coerceQueryValues(local.value, readDefaults())
    return {
      values: local,
      update: (patch) => {
        local.value = { ...local.value, ...patch }
      },
      replace: (values) => {
        local.value = coerceQueryValues(values, readDefaults())
      },
      reset: () => {
        local.value = readDefaults()
      },
    }
  }

  const values = ref<QueryValues>(coerceQueryValues(adapters.query.read(toValue(options.namespace)), readDefaults()))
  let applied = serialize(values.value)

  const pull = (incoming: QueryValues) => {
    const next = coerceQueryValues(incoming, readDefaults())
    const serialized = serialize(next)
    if (serialized === applied) return
    applied = serialized
    values.value = next
  }

  const push = (next: QueryValues) => {
    const serialized = serialize(next)
    if (serialized === applied) return
    applied = serialized
    adapters.query.write(toValue(options.namespace), next)
  }

  let unwatchLocation = adapters.query.watch(toValue(options.namespace), pull)

  const stopNamespaceWatch = watch(
    () => toValue(options.namespace),
    (namespace) => {
      unwatchLocation()
      unwatchLocation = adapters.query.watch(namespace, pull)
      applied = ''
      pull(adapters.query.read(namespace))
    },
  )

  onScopeDispose(() => {
    unwatchLocation()
    stopNamespaceWatch()
  })

  return {
    values,
    update: (patch) => {
      const next = { ...values.value, ...patch }
      values.value = next
      push(next)
    },
    replace: (next) => {
      const coerced = coerceQueryValues(next, readDefaults())
      values.value = coerced
      push(coerced)
    },
    reset: () => {
      const next = readDefaults()
      values.value = next
      push(next)
    },
  }
}
