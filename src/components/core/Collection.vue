<script setup lang="ts" generic="TRecord extends object = Record<string, unknown>, TQuery extends object = Record<string, unknown>">
import { computed, getCurrentInstance, nextTick, onBeforeUpdate, ref, toRef, watch } from 'vue'
import type { CollectionLoadContext, CollectionProps, CollectionResult, CollectionSlotProps, QueryValues } from '../../contracts'
import { coerceQueryValues, useLoader, useNamespacedQuery } from '../../query'
import { assertSingleDataSource, collectionCacheKey, instanceIdentity } from './useCoreData'

const props = withDefaults(defineProps<CollectionProps<TRecord, TQuery>>(), {
  searchParameters: () => ({}),
  pagination: 'always',
  pageSizeOptions: () => [10, 25, 50, 100],
  defaultPageSize: 10,
})

const emit = defineEmits<{
  (event: 'update:query', query: QueryValues): void
}>()

assertSingleDataSource('Collection', props.data, props.load)

const instance = getCurrentInstance()
const defaults = computed<QueryValues>(() => ({ page: 1, limit: props.defaultPageSize }))
const hasControlledQuery = ref(hasQueryProp())
const query = useNamespacedQuery({
  namespace: toRef(() => props.namespace ?? 'collection'),
  defaults,
})

const queryValues = computed<QueryValues>(() => {
  hasControlledQuery.value
  return hasQueryProp()
    ? coerceQueryValues((props.query ?? {}) as QueryValues, defaults.value)
    : query.values.value
})

onBeforeUpdate(() => {
  hasControlledQuery.value = hasQueryProp()
})

let namespaceChange = false
watch(() => props.namespace ?? 'collection', () => {
  namespaceChange = true
  void nextTick().then(() => { namespaceChange = false })
}, { flush: 'sync' })

watch(query.values, (value) => {
  if (!hasControlledQuery.value && !namespaceChange) emit('update:query', value)
}, { deep: true })

const fallbackOwner = instanceIdentity('collection')
const owner = computed(() => props.resource ?? props.namespace ?? fallbackOwner)
const effectiveQuery = computed<QueryValues>(() => {
  const values = queryValues.value
  if (!props.reorderable) return values
  const { page: _page, limit: _limit, sort_by: _sortBy, sort: _sort, ...filters } = values
  return filters
})
const loaded = useLoader<CollectionLoadContext<TQuery>, CollectionResult<TRecord>>({
  key: computed(() => collectionCacheKey(owner.value, props.namespace, effectiveQuery.value, props.searchParameters ?? {})),
  context: computed(() => ({ query: effectiveQuery.value as TQuery, searchParameters: props.searchParameters ?? {} })),
  load: computed(() => props.load),
  data: computed(() => (props.data !== undefined ? { data: props.data, meta: props.meta } : undefined)),
})

const records = computed(() => loaded.data.value?.data ?? [])
const meta = computed(() => loaded.data.value?.meta)
const empty = computed(() => !loaded.loading.value && !loaded.error.value && records.value.length === 0)

function updateQuery(patch: QueryValues) {
  if (hasControlledQuery.value) emit('update:query', { ...queryValues.value, ...patch })
  else query.update(patch)
}

function replaceQuery(values: QueryValues) {
  const next = coerceQueryValues(values, defaults.value)
  if (hasControlledQuery.value) emit('update:query', next)
  else query.replace(next)
}

const slotProps = computed<CollectionSlotProps<TRecord, TQuery>>(() => ({
  records: records.value,
  meta: meta.value,
  loading: loaded.loading.value,
  error: loaded.error.value,
  empty: empty.value,
  query: queryValues.value as TQuery,
  refresh: loaded.refresh,
  updateQuery,
}))

defineExpose({ refresh: loaded.refresh, query: queryValues, updateQuery, replaceQuery })

function hasQueryProp(): boolean {
  const vnodeProps = instance?.vnode.props ?? {}
  return Object.hasOwn(vnodeProps, 'query') || Object.hasOwn(vnodeProps, 'query-value')
}
</script>

<template>
  <slot v-bind="slotProps" />
</template>
