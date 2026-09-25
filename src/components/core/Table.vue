<script setup lang="ts" generic="TRecord extends object = Record<string, unknown>, TQuery extends object = Record<string, unknown>">
import { computed, getCurrentInstance, onBeforeUpdate, ref, useSlots } from 'vue'
import type { CollectionLoadContext, CollectionProps, CollectionResult, QueryValues, RowReorderPayload, TableProps } from '../../contracts'
import { compileSchema } from '../../schemas/compileSchema'
import Collection from './Collection.vue'
import TableContent from './TableContent.vue'
import { assertSingleDataSource } from './useCoreData'

const props = withDefaults(defineProps<TableProps<TRecord, TQuery>>(), {
  searchParameters: () => ({}),
  pagination: 'auto',
  pageSizeOptions: () => [10, 25, 50, 100],
  defaultPageSize: 10,
  minColumnWidth: 96,
})

assertSingleDataSource('Table', props.data, props.load)
const instance = getCurrentInstance()
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
const compiledQuerySchema = computed(() => props.querySchema ? compileSchema(props.querySchema) : undefined)
const forwardedSlots = computed(() => Object.fromEntries(
  Object.entries(slots).filter(([name]) => name !== 'collection'),
))
const collectionRef = ref<{ refresh: () => Promise<void>; query: QueryValues; updateQuery: (patch: QueryValues) => void; replaceQuery: (values: QueryValues) => void }>()

onBeforeUpdate(() => {
  hasControlledQuery.value = hasQueryProp()
})

const collectionProps = computed<CollectionProps<TRecord, TQuery>>(() => {
  const value: CollectionProps<TRecord, TQuery> = {
    resource: props.resource,
    searchParameters: props.searchParameters,
    namespace: props.namespace,
    pagination: props.pagination,
    pageSizeOptions: props.pageSizeOptions,
    defaultPageSize: props.defaultPageSize,
    reorderable: props.reorderable,
  }
  if (props.meta !== undefined) value.meta = props.meta
  if (props.data !== undefined) value.data = props.data
  else {
    const load = props.load
    if (load !== undefined) value.load = async (context: CollectionLoadContext<TQuery>): Promise<CollectionResult<TRecord>> => {
      const compiled = compiledQuerySchema.value
      if (!compiled) return load(context)
      const result = await compiled.parseAsync(context.query)
      if (!result.success) {
        const issue = result.issues[0]
        const path = issue ? issue.path.map(String).join('.') || '$' : '$'
        throw new Error(`[loom][SURFACE_OPTION_INVALID] Table query does not match querySchema at "${path}".`)
      }
      const query = {
        ...(Object.hasOwn(context.query, 'page') && !Object.hasOwn(result.data, 'page') ? { page: Reflect.get(context.query, 'page') } : {}),
        ...(Object.hasOwn(context.query, 'limit') && !Object.hasOwn(result.data, 'limit') ? { limit: Reflect.get(context.query, 'limit') } : {}),
        ...result.data,
      }
      return load({ ...context, query })
    }
  }
  if (hasControlledQuery.value) value.query = props.query as TQuery
  return value
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

defineExpose({ refresh, query: exposedQuery, updateQuery, replaceQuery })

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
