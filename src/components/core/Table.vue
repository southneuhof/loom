<script setup lang="ts" generic="TRecord extends object = Record<string, unknown>, TQuery extends object = Record<string, unknown>, TContext extends object = Readonly<Record<string, unknown>>">
import { computed, getCurrentInstance, onBeforeUpdate, ref, useSlots } from 'vue'
import type { CollectionProps, CollectionSlotProps, QueryValues, RowReorderPayload, TableProps } from '../../contracts'
import Collection from './Collection.vue'
import TableContent from './TableContent.vue'
import { assertSingleDataSource } from './useCoreData'

const props = withDefaults(defineProps<TableProps<TRecord, TQuery, TContext>>(), {
  searchParameters: () => ({}),
  pagination: 'auto',
  pageSizeOptions: () => [10, 25, 50, 100],
  defaultPageSize: 10,
  minColumnWidth: 96,
  maxColumnWidth: 360,
})

const instance = getCurrentInstance()
assertSingleDataSource('Table', props.data, props.load, 'collection', instance?.vnode.props ?? {})
const hasControlledQuery = ref(hasQueryProp())

const emit = defineEmits<{
  (event: 'update:query', query: QueryValues): void
  (event: 'update:visibleColumns', columns: string[]): void
  (event: 'update:columnSizing', sizes: Record<string, number>): void
  (event: 'row-click', record: TRecord, index: number): void
  (event: 'row-reorder', payload: RowReorderPayload<TRecord>): void
}>()

defineSlots<{
  collection?: (props: import('../../contracts').CollectionSlotProps<TRecord, TQuery>) => unknown
  [name: string]: unknown
}>()
const slots = useSlots()
const forwardedSlots = computed(() => Object.fromEntries(
  Object.entries(slots).filter(([name]) => name !== 'collection'),
))
const collectionRef = ref<Pick<CollectionSlotProps<TRecord, TQuery>, 'context' | 'loading' | 'error'> & {
  refresh: () => Promise<void>
  query: QueryValues
  updateQuery: (patch: QueryValues) => void
  replaceQuery: (values: QueryValues) => void
  readReady: boolean
}>()

onBeforeUpdate(() => {
  assertSingleDataSource('Table', props.data, props.load, 'collection', instance?.vnode.props ?? {})
  hasControlledQuery.value = hasQueryProp()
})

const collectionProps = computed<CollectionProps<TRecord, TQuery>>(() => {
  const options = {
    resource: props.resource,
    searchParameters: props.searchParameters,
    namespace: props.namespace,
    querySchema: props.querySchema,
    pagination: props.pagination,
    pageSizeOptions: props.pageSizeOptions,
    defaultPageSize: props.defaultPageSize,
    reorderable: props.reorderable,
    ...(props.meta !== undefined ? { meta: props.meta } : {}),
    ...(hasControlledQuery.value ? { query: props.query as TQuery } : {}),
  }
  if (props.data !== undefined) return { ...options, data: props.data }
  if (!props.load) throw new Error('[loom] No Table loader supplied.')
  return { ...options, load: props.load }
})

function updateQuery(patch: QueryValues) {
  collectionRef.value?.updateQuery(patch)
}

function replaceQuery(values: QueryValues) {
  collectionRef.value?.replaceQuery(values)
}

function refresh() {
  return collectionRef.value?.refresh() ?? Promise.resolve()
}

function rowClick(record: TRecord, index: number) {
  emit('row-click', record, index)
}

function rowReorder(payload: RowReorderPayload<TRecord>) {
  emit('row-reorder', payload)
}

const exposedQuery = computed<QueryValues>(() => collectionRef.value?.query ?? {})
const exposedContext = computed(() => collectionRef.value?.context)
const exposedLoading = computed(() => collectionRef.value?.loading ?? false)
const exposedError = computed(() => collectionRef.value?.error)

defineExpose({
  refresh,
  query: exposedQuery,
  context: exposedContext,
  loading: exposedLoading,
  error: exposedError,
  updateQuery,
  replaceQuery,
  readReady: computed(() => collectionRef.value?.readReady ?? false),
})

function hasQueryProp(): boolean {
  const vnodeProps = instance?.vnode.props ?? {}
  return Object.hasOwn(vnodeProps, 'query') || Object.hasOwn(vnodeProps, 'query-value')
}
</script>

<template>
  <Collection ref="collectionRef" v-bind="collectionProps" @update:query="emit('update:query', $event)">
    <template #default="collection">
      <TableContent
        :schema="props.schema"
        :query-schema="props.querySchema"
        :columns="props.columns"
        :labels="props.labels"
        :context="props.context"
        :result-context="collection.context"
        :records="collection.records"
        :meta="collection.meta"
        :loading="collection.loading"
        :error="collection.error"
        :empty="collection.empty"
        :query="collection.query"
        :refresh="collection.refresh"
        :update-query="collection.updateQuery"
        :search-parameters="props.searchParameters"
        :namespace="props.namespace"
        :pagination="props.pagination"
        :page-size-options="props.pageSizeOptions"
        :default-page-size="props.defaultPageSize"
        :min-column-width="props.minColumnWidth"
        :max-column-width="props.maxColumnWidth"
        :visible-columns="props.visibleColumns"
        :column-sizing="props.columnSizing"
        :reorderable="props.reorderable"
        :row-key="props.rowKey"
        @update:query="collection.updateQuery"
        @update:visible-columns="emit('update:visibleColumns', $event)"
        @update:column-sizing="emit('update:columnSizing', $event)"
        @row-click="rowClick"
        @row-reorder="rowReorder"
      >
        <template v-if="$slots.collection" #collection="slotProps">
          <slot name="collection" v-bind="slotProps" />
        </template>
        <template v-for="(_, name) in forwardedSlots" #[name]="slotProps" :key="name">
          <slot :name="name" v-bind="slotProps ?? {}" />
        </template>
      </TableContent>
    </template>
  </Collection>
</template>
