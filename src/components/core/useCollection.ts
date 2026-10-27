import { computed, nextTick, onBeforeUpdate, ref, toRef, watch, type Ref } from 'vue'
import type { CollectionLoadContext, CollectionMeta, CollectionProps, CollectionResult, QueryValues, SubmitError } from '../../contracts'
import { coerceQueryValues, useLoader, useNamespacedQuery } from '../../query'
import { collectionKey } from '../../query/keys'
import { instanceIdentity } from './useCoreData'
import { resourceLoaderOwner, resourceLoaderParameters } from '../../resources/loaderIdentity'
import { createSchemaRuntime } from '../../schemas/schemaRuntime'
import { assertSingleDataSource } from './useCoreData'

export interface UseCollectionOptions {
  onUpdateQuery?: (query: QueryValues) => void
  queryControlled?: () => boolean
}

export interface CollectionReader<TRecord extends object, TQuery extends object> {
  readonly records: Ref<TRecord[]>
  readonly meta: Ref<CollectionMeta | undefined>
  readonly context: Ref<unknown>
  readonly loading: Ref<boolean>
  readonly error: Ref<SubmitError | undefined>
  readonly empty: Ref<boolean>
  readonly query: Ref<TQuery>
  readonly refresh: () => Promise<void>
  readonly updateQuery: (patch: QueryValues) => void
  replaceQuery: (values: QueryValues) => void
  resetQuery: () => void
}

function queryError(component: string, issues: readonly { path: readonly (string | number)[] }[]): Error {
  const issue = issues[0]
  const path = issue ? issue.path.map(String).join('.') || '$' : '$'
  return new Error(`[loom][SURFACE_OPTION_INVALID] ${component} query does not match querySchema at "${path}".`)
}

export function useCollection<TRecord extends object, TQuery extends object>(
  sourceGetter: () => CollectionProps<TRecord, TQuery>,
  options: UseCollectionOptions = {},
): CollectionReader<TRecord, TQuery> {
  const source = computed(() => {
    const current = sourceGetter()
    assertSingleDataSource('Collection', current.data, current.load)
    return current
  })
  const defaults = computed<QueryValues>(() => ({ page: 1, limit: source.value.defaultPageSize ?? 10 }))
  const isControlledQuery = () => options.queryControlled?.() ?? Object.hasOwn(source.value, 'query')
  const hasControlledQuery = ref(isControlledQuery())
  const fallbackOwner = instanceIdentity('collection')
  const owner = computed(() => resourceLoaderOwner(source.value.load, source.value.resource, source.value.namespace ?? fallbackOwner))
  const searchParameters = computed(() => resourceLoaderParameters(source.value.load, source.value.searchParameters))
  const queryState = useNamespacedQuery({
    namespace: toRef(() => source.value.namespace ?? 'collection'),
    defaults,
  })
  const queryValues = computed<QueryValues>(() => {
    hasControlledQuery.value
    return isControlledQuery()
      ? coerceQueryValues((source.value.query ?? {}) as QueryValues, defaults.value)
      : queryState.values.value
  })

  onBeforeUpdate(() => {
    hasControlledQuery.value = isControlledQuery()
  })

  let namespaceChange = false
  watch(() => source.value.namespace ?? owner.value, () => {
    namespaceChange = true
    void nextTick().then(() => { namespaceChange = false })
  }, { flush: 'sync' })

  watch(queryState.values, (value) => {
    if (!hasControlledQuery.value && !namespaceChange) options.onUpdateQuery?.(value)
  }, { deep: true })

  const effectiveQuery = computed<QueryValues>(() => {
    const values = queryValues.value
    if (!source.value.reorderable) return values
    const { page: _page, limit: _limit, sort_by: _sortBy, sort: _sort, ...filters } = values
    return filters
  })
  const load = computed(() => {
    const currentSource = source.value
    if (!currentSource.load) return undefined
    const sourceLoad = currentSource.load
    if (!currentSource.querySchema) return sourceLoad
    const runtime = createSchemaRuntime(currentSource.querySchema)
    const validated = async (context: CollectionLoadContext<TQuery>): Promise<CollectionResult<TRecord>> => {
      const parsed = await runtime.parseAsync(context.query)
      if (!parsed.success) throw queryError('Collection', parsed.issues)
      const query = {
        ...(Object.hasOwn(context.query, 'page') && !Object.hasOwn(parsed.data, 'page') ? { page: Reflect.get(context.query, 'page') } : {}),
        ...(Object.hasOwn(context.query, 'limit') && !Object.hasOwn(parsed.data, 'limit') ? { limit: Reflect.get(context.query, 'limit') } : {}),
        ...parsed.data,
      } as TQuery
      return sourceLoad({ ...context, query })
    }
    return validated
  })
  const loaded = useLoader<CollectionLoadContext<TQuery>, CollectionResult<TRecord>>({
    key: computed(() => collectionKey({
      resource: owner.value,
      namespace: source.value.namespace,
      query: effectiveQuery.value,
      searchParameters: searchParameters.value,
    })),
    context: computed(() => ({
      query: effectiveQuery.value as TQuery,
      searchParameters: searchParameters.value,
    })),
    load,
    data: computed(() => source.value.data !== undefined
      ? { data: source.value.data, meta: source.value.meta }
      : undefined),
  })
  const records = computed(() => loaded.data.value?.data ?? [])
  const meta = computed(() => loaded.data.value?.meta)
  const context = computed(() => loaded.data.value?.context)
  const empty = computed(() => !loaded.loading.value && !loaded.error.value && records.value.length === 0)

  function publishQuery(values: QueryValues): void {
    if (hasControlledQuery.value) {
      if (!options.onUpdateQuery) throw new Error('[loom][SURFACE_CONTROLLED_QUERY_UPDATE_REQUIRED] A controlled collection needs onUpdateQuery.')
      options.onUpdateQuery(values)
    } else queryState.replace(values)
  }

  function updateQuery(patch: QueryValues): void {
    publishQuery({ ...queryValues.value, ...patch })
  }

  function replaceQuery(values: QueryValues): void {
    publishQuery(coerceQueryValues(values, defaults.value))
  }

  function resetQuery(): void {
    publishQuery(defaults.value)
  }

  return {
    records,
    meta,
    context,
    loading: loaded.loading,
    error: loaded.error,
    empty,
    query: queryValues as Ref<TQuery>,
    refresh: loaded.refresh,
    updateQuery,
    replaceQuery,
    resetQuery,
  }
}
