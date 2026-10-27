import { computed, getCurrentInstance, toRef, toValue, watch, type MaybeRefOrGetter } from 'vue'
import type { CollectionResult, OptionLoad, OptionLoadContext, QueryNamespace } from '../../contracts'
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

export function useOptionSource<TOption extends object>(
  props: OptionSourceProps<TOption>,
  searchParameters: MaybeRefOrGetter<Record<string, unknown>> = () => props.searchParameters ?? {},
) {
  const instance = getCurrentInstance()
  const owner = `option-${instance?.uid ?? Math.random().toString(36).slice(2)}`
  const source = useLoader<OptionLoadContext, readonly TOption[] | CollectionResult<TOption>>({
    key: computed(() => {
      const identity = resourceLoaderIdentity(props.load)
      const resource = resourceLoaderOwner(props.load, props.resource, owner)
      const parameters = resourceLoaderParameters(props.load, toValue(searchParameters))
      return identity || props.resource !== undefined
        ? resourceOptionsKey({
          resource,
          namespace: props.namespace ?? identity?.operation ?? owner,
          searchParameters: parameters,
        })
        : ['option-source', props.namespace ?? owner, stableValue(parameters)]
    }),
    context: computed(() => ({
      query: {},
      searchParameters: resourceLoaderParameters(props.load, toValue(searchParameters)),
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
    externalContext: computed(() => ({
      load: props.load,
      namespace: props.namespace,
      resource: props.resource,
      searchParameters: stableValue(toValue(searchParameters)),
    })),
    options: computed<readonly TOption[]>(() => {
      const value = source.data.value
      return Array.isArray(value) ? value : (value as CollectionResult<TOption> | undefined)?.data ?? []
    }),
    error: source.error,
    loading: source.loading,
    refresh: source.refresh,
  }
}
