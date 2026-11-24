import { computed, getCurrentInstance, toRef, watch } from 'vue'
import type { OptionLoad, OptionLoadContext } from '../../contracts/load'
import type { QueryNamespace } from '../../contracts/query'
import type { CollectionResult } from '../../contracts/results'
import { normalizeQueryFilters } from '../../query/filters'
import { useLoader } from '../../query/loader'
import { resourceOptionsKey, stableValue } from '../../query/keys'
import { resourceLoaderIdentity, resourceLoaderOwner, resourceLoaderParameters } from '../../resources/loaderIdentity'

export interface OptionSourceProps<TOption extends object> {
  data?: readonly TOption[]
  load?: OptionLoad<TOption>
  resource?: string
  searchParameters?: Record<string, unknown>
  namespace?: QueryNamespace
}

type OptionSourceContext =
  | { mode: 'none' }
  | { mode: 'data'; identities: readonly unknown[] }
  | {
      mode: 'load'
      load: OptionLoad<object>
      resource?: string
      namespace?: QueryNamespace
      searchParameters: string | undefined
    }

export function sameOptionSourceContext(left: OptionSourceContext, right: OptionSourceContext): boolean {
  if (left.mode === 'data' && right.mode === 'data') {
    return left.identities.length === right.identities.length
      && left.identities.every((value, index) => Object.is(value, right.identities[index]))
  }
  if (left.mode === 'load' && right.mode === 'load') {
    return left.load === right.load
      && left.resource === right.resource
      && left.namespace === right.namespace
      && left.searchParameters === right.searchParameters
  }
  return left.mode === right.mode
}

export function useOptionSource<TOption extends object>(
  props: OptionSourceProps<TOption>,
  staticIdentities: (options: readonly TOption[]) => readonly unknown[],
) {
  const instance = getCurrentInstance()
  const owner = `option-${instance?.uid ?? Math.random().toString(36).slice(2)}`
  const searchParameters = () => resourceLoaderParameters(props.load, props.searchParameters)
  const source = useLoader<OptionLoadContext, readonly TOption[] | CollectionResult<TOption>>({
    key: computed(() => {
      const identity = resourceLoaderIdentity(props.load)
      const resource = resourceLoaderOwner(props.load, props.resource, owner)
      return identity || props.resource !== undefined
        ? resourceOptionsKey({
          resource,
          operation: identity?.operation,
          namespace: props.namespace ?? identity?.operation ?? owner,
          searchParameters: searchParameters(),
        })
        : ['option-source', props.namespace ?? owner, stableValue(searchParameters())]
    }),
    context: computed(() => ({
      query: {},
      searchParameters: searchParameters(),
    })),
    data: toRef(props, 'data'),
    load: toRef(props, 'load'),
  })

  watch([() => props.data, () => props.load], ([data, load]) => {
    if (data !== undefined && load) {
      throw new Error('[loom] `data` and `load` are alternatives; supply only one.')
    }
  })
  watch(() => props.load, (load, previousLoad) => {
    if (props.data === undefined && load && previousLoad) void source.refresh().catch(() => undefined)
  })

  return {
    externalContext: computed<OptionSourceContext>(() => {
      if (props.data !== undefined) return { mode: 'data', identities: staticIdentities(props.data ?? []) }
      if (!props.load) return { mode: 'none' }
      return {
        mode: 'load',
        load: props.load,
        namespace: props.namespace,
        resource: props.resource,
        searchParameters: JSON.stringify(stableValue(normalizeQueryFilters(props.searchParameters ?? {}))),
      }
    }),
    options: computed<readonly TOption[]>(() => {
      const value = source.data.value
      return Array.isArray(value) ? value : (value as CollectionResult<TOption> | undefined)?.data ?? []
    }),
    error: source.error,
    loading: source.loading,
    refresh: source.refresh,
  }
}
