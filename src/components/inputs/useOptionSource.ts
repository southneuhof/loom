import { computed, getCurrentInstance, toRef, toValue, type MaybeRefOrGetter } from 'vue'
import type { CollectionResult, OptionLoad, OptionLoadContext, QueryNamespace } from '../../contracts'
import { useLoader } from '../../query/loader'
import { stableValue } from '../../query/keys'

export interface OptionSourceProps<TOption extends object> {
  data?: readonly TOption[]
  load?: OptionLoad<TOption>
  searchParameters?: Record<string, unknown>
  namespace?: QueryNamespace
}

export function useOptionSource<TOption extends object>(
  props: OptionSourceProps<TOption>,
  searchParameters: MaybeRefOrGetter<Record<string, unknown>> = () => props.searchParameters ?? {},
) {
  const instance = getCurrentInstance()
  const owner = props.namespace ?? `option-${instance?.uid ?? Math.random().toString(36).slice(2)}`
  const source = useLoader<OptionLoadContext, readonly TOption[] | CollectionResult<TOption>>({
    key: computed(() => ['option-source', props.namespace ?? owner, stableValue(toValue(searchParameters))]),
    context: computed(() => ({
      query: {},
      searchParameters: toValue(searchParameters),
    })),
    data: toRef(props, 'data'),
    load: toRef(props, 'load'),
  })

  return {
    options: computed<readonly TOption[]>(() => {
      const value = source.data.value
      return Array.isArray(value) ? value : (value as CollectionResult<TOption> | undefined)?.data ?? []
    }),
    error: source.error,
    loading: source.loading,
    refresh: source.refresh,
  }
}
