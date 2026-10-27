import { computed, type Ref } from 'vue'
import type { DetailProps, RecordLoadContext, RecordResult, SubmitError } from '../../contracts'
import { useLoader } from '../../query'
import { resourceLoaderOwner, resourceLoaderParameters } from '../../resources/loaderIdentity'
import { recordCacheKey, instanceIdentity, assertSingleDataSource } from './useCoreData'

export interface RecordReader<TRecord extends object> {
  readonly record: Ref<TRecord | undefined>
  readonly loading: Ref<boolean>
  readonly error: Ref<SubmitError | undefined>
  readonly empty: Ref<boolean>
  readonly refresh: () => Promise<void>
}

export function useRecord<TRecord extends object, TContext extends object = Readonly<Record<string, unknown>>>(
  sourceGetter: () => DetailProps<TRecord, TContext>,
): RecordReader<TRecord> {
  const source = computed(() => {
    const current = sourceGetter()
    assertSingleDataSource('Detail', current.data, current.load, 'record')
    return current
  })
  const fallbackOwner = instanceIdentity('detail')
  const owner = computed(() => source.value.data !== undefined
    ? fallbackOwner
    : resourceLoaderOwner(source.value.load, source.value.resource, source.value.namespace ?? fallbackOwner))
  const searchParameters = computed(() => resourceLoaderParameters(source.value.load, source.value.searchParameters))
  const loaded = useLoader<RecordLoadContext, RecordResult<TRecord>>({
    key: computed(() => recordCacheKey(owner.value, source.value.id, 'display', source.value.namespace, searchParameters.value, source.value.load)),
    context: computed(() => ({ id: source.value.id, searchParameters: searchParameters.value })),
    load: computed(() => source.value.load),
    data: computed(() => source.value.data),
  })
  const record = computed(() => loaded.data.value)
  const refresh = async (): Promise<void> => {
    if (source.value.data !== undefined) return
    await loaded.refresh()
  }

  return {
    record,
    loading: loaded.loading,
    error: loaded.error,
    empty: computed(() => !loaded.loading.value && !loaded.error.value && record.value === undefined),
    refresh,
  }
}
