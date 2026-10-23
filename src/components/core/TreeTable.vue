<script setup lang="ts" generic="TRecord extends object = Record<string, unknown>, TQuery extends object = Record<string, unknown>">
import { computed, getCurrentInstance, onBeforeUpdate, ref, useSlots } from 'vue'
import type { CollectionLoadContext, CollectionProps, CollectionResult, CollectionSlotProps, QueryValues, RowReorderPayload, SubmitError, TreeRowContext, TreeTableProps } from '../../contracts'
import { createSchemaRuntime } from '../../schemas/schemaRuntime'
import type { ResolvedDisplayField } from '../../display/resolveDisplay'
import Collection from './Collection.vue'
import TreeTableContent from './TreeTableContent.vue'
import { assertSingleDataSource } from './useCoreData'

const props = withDefaults(defineProps<TreeTableProps<TRecord, TQuery>>(), {
  searchParameters: () => ({}),
  pagination: false,
  pageSizeOptions: () => [10, 25, 50, 100],
  defaultPageSize: 10,
  minColumnWidth: 96,
  maxColumnWidth: 360,
})

assertSingleDataSource('TreeTable', props.data, props.load)
const instance = getCurrentInstance()
const hasControlledQuery = ref(hasQueryProp())
const hasControlledExpansion = ref(hasVnodeProp('expandedKeys', 'expanded-keys'))
const hasDefaultExpansion = ref(hasVnodeProp('defaultExpandedKeys', 'default-expanded-keys'))
const emit = defineEmits<{
  (event: 'update:expandedKeys', keys: string[]): void
  (event: 'update:query', query: QueryValues): void
  (event: 'update:visibleColumns', columns: string[]): void
  (event: 'update:columnSizing', sizes: Record<string, number>): void
  (event: 'row-click', record: TRecord, index: number): void
  (event: 'row-reorder', payload: RowReorderPayload<TRecord>): void
}>()

type TreeRowScope = { record: TRecord; index: number; tree: TreeRowContext }
type TreeCellScope = TreeRowScope & { value: unknown; field: ResolvedDisplayField<TRecord> }

defineSlots<{
  collection?: (scope: CollectionSlotProps<TRecord, TQuery>) => unknown
  loading?: () => unknown
  error?: (scope: { error?: SubmitError }) => unknown
  empty?: () => unknown
  'row-prefix'?: (scope: TreeRowScope) => unknown
  'row-actions'?: (scope: TreeRowScope) => unknown
  'pagination-summary'?: (scope: { start: number; end: number; total?: number; query: QueryValues }) => unknown
  'page-size-control'?: (scope: { options: number[]; limit: number; setPageSize: (value: unknown) => void }) => unknown
  [name: `cell:${string}`]: (scope: TreeCellScope) => unknown
}>()

const slots = useSlots()
const querySchemaRuntime = computed(() => (props.querySchema ? createSchemaRuntime(props.querySchema) : undefined))
const forwardedSlots = computed(() => Object.fromEntries(Object.entries(slots).filter(([name]) => name !== 'collection')))
const collectionRef = ref<{
  refresh: () => Promise<void>
  query: QueryValues
  updateQuery: (patch: QueryValues) => void
  replaceQuery: (values: QueryValues) => void
}>()
const contentRef = ref<{ expandAll: () => void; collapseAll: () => void; reveal: (keys: readonly string[]) => void }>()
const expansionProps = computed(() => ({
  ...(hasControlledExpansion.value ? { expandedKeys: props.expandedKeys } : {}),
  ...(hasDefaultExpansion.value ? { defaultExpandedKeys: props.defaultExpandedKeys } : {}),
}))

onBeforeUpdate(() => {
  assertSingleDataSource('TreeTable', props.data, props.load)
  hasControlledQuery.value = hasQueryProp()
  hasControlledExpansion.value = hasVnodeProp('expandedKeys', 'expanded-keys')
  hasDefaultExpansion.value = hasVnodeProp('defaultExpandedKeys', 'default-expanded-keys')
})

const collectionProps = computed<CollectionProps<TRecord, TQuery>>(() => {
  const options = {
    resource: props.resource,
    searchParameters: props.searchParameters,
    namespace: props.namespace,
    pagination: props.pagination,
    pageSizeOptions: props.pageSizeOptions,
    defaultPageSize: props.defaultPageSize,
    ...(props.meta !== undefined ? { meta: props.meta } : {}),
    ...(hasControlledQuery.value ? { query: props.query as TQuery } : {}),
  }
  if (props.data !== undefined) return { ...options, data: props.data }
  const load = props.load
  return {
    ...options,
    load: async (context: CollectionLoadContext<TQuery>): Promise<CollectionResult<TRecord>> => {
      if (!load) throw new Error('[loom] No TreeTable loader supplied.')
      const runtime = querySchemaRuntime.value
      if (!runtime) return load(context)
      const result = await runtime.parseAsync(context.query)
      if (!result.success) {
        const issue = result.issues[0]
        const path = issue ? issue.path.map(String).join('.') || '$' : '$'
        throw new Error(`[loom][SURFACE_OPTION_INVALID] TreeTable query does not match querySchema at "${path}".`)
      }
      const query = {
        ...(Object.hasOwn(context.query, 'page') && !Object.hasOwn(result.data, 'page') ? { page: Reflect.get(context.query, 'page') } : {}),
        ...(Object.hasOwn(context.query, 'limit') && !Object.hasOwn(result.data, 'limit') ? { limit: Reflect.get(context.query, 'limit') } : {}),
        ...result.data,
      }
      return load({ ...context, query })
    },
  }
})

function refresh() {
  return collectionRef.value?.refresh() ?? Promise.resolve()
}

function updateQuery(patch: QueryValues) {
  collectionRef.value?.updateQuery(patch)
}

function replaceQuery(values: QueryValues) {
  collectionRef.value?.replaceQuery(values)
}

function expandAll() {
  contentRef.value?.expandAll()
}

function collapseAll() {
  contentRef.value?.collapseAll()
}

function reveal(keys: readonly string[]) {
  contentRef.value?.reveal(keys)
}

function rowClick(record: TRecord, index: number) {
  emit('row-click', record, index)
}

function rowReorder(payload: RowReorderPayload<TRecord>) {
  emit('row-reorder', payload)
}

const query = computed<QueryValues>(() => collectionRef.value?.query ?? {})
defineExpose({ refresh, query, updateQuery, replaceQuery, expandAll, collapseAll, reveal })

function hasQueryProp(): boolean {
  const vnodeProps = instance?.vnode.props ?? {}
  return Object.hasOwn(vnodeProps, 'query') || Object.hasOwn(vnodeProps, 'query-value')
}

function hasVnodeProp(camel: string, kebab: string): boolean {
  const vnodeProps = instance?.vnode.props ?? {}
  return Object.hasOwn(vnodeProps, camel) || Object.hasOwn(vnodeProps, kebab)
}
</script>

<template>
  <Collection ref="collectionRef" v-bind="collectionProps" @update:query="emit('update:query', $event)">
    <template #default="collection">
      <TreeTableContent
        ref="contentRef"
        :schema="props.schema"
        :query-schema="props.querySchema"
        :columns="props.columns"
        :labels="props.labels"
        :row-key="props.rowKey"
        :children="props.children"
        :tree-column="props.treeColumn"
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
        v-bind="expansionProps"
        @update:expanded-keys="emit('update:expandedKeys', $event)"
        @update:query="collection.updateQuery"
        @update:visible-columns="emit('update:visibleColumns', $event)"
        @update:column-sizing="emit('update:columnSizing', $event)"
        @row-click="rowClick"
        @row-reorder="rowReorder"
      >
        <template v-if="$slots.collection" #collection="slotProps">
          <slot name="collection" v-bind="slotProps" />
        </template>
        <template v-for="(_, name) in forwardedSlots" :key="name" #[name]="slotProps">
          <slot :name="name" v-bind="slotProps ?? {}" />
        </template>
      </TreeTableContent>
    </template>
  </Collection>
</template>
