<script setup lang="ts" generic="TRecord extends object = Record<string, unknown>, TQuery extends object = Record<string, unknown>, TContext extends object = Readonly<Record<string, unknown>>">
import { computed, onBeforeUpdate, useAttrs, useSlots } from 'vue'
import type { CollectionSlotProps, QueryValues, RowReorderPayload, SubmitError, TreeRowContext, TreeTableContentProps } from '../../contracts'
import type { ResolvedDisplayField } from '../../display/resolveDisplay'
import TableContent from './TableContent.vue'
import { buildTreeTableIndex, useTreeTableState } from './useTreeTableState'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<TreeTableContentProps<TRecord, TQuery, TContext>>(), {
  searchParameters: () => ({}),
  pagination: false,
  pageSizeOptions: () => [10, 25, 50, 100],
  defaultPageSize: 10,
  minColumnWidth: 96,
  maxColumnWidth: 360,
})

const emit = defineEmits<{
  (event: 'update:expandedKeys', keys: string[]): void
  (event: 'update:query', query: QueryValues): void
  (event: 'update:visibleColumns', columns: string[]): void
  (event: 'update:columnSizing', sizes: Record<string, number>): void
  (event: 'row-click', record: TRecord, index: number): void
  (event: 'row-reorder', payload: RowReorderPayload<TRecord>): void
}>()

type RowScope = { record: TRecord; index: number; tree: TreeRowContext }
type CellScope = RowScope & { value: unknown; field: ResolvedDisplayField<TRecord, TContext> }

defineSlots<{
  collection?: (scope: CollectionSlotProps<TRecord, TQuery>) => unknown
  loading?: () => unknown
  error?: (scope: { error?: SubmitError }) => unknown
  empty?: () => unknown
  'row-prefix'?: (scope: RowScope) => unknown
  'row-actions'?: (scope: RowScope) => unknown
  'pagination-summary'?: (scope: { start: number; end: number; total?: number; query: QueryValues }) => unknown
  'page-size-control'?: (scope: { options: number[]; limit: number; setPageSize: (value: unknown) => void }) => unknown
  [name: `cell:${string}`]: (scope: CellScope) => unknown
}>()

const slots = useSlots()
const attrs = useAttrs()
const forwardedSlotNames = computed(() => Object.keys(slots).filter((name) => name !== 'collection'))
const state = useTreeTableState(props)

function optionError(detail: string): never {
  throw new Error(`[loom][SURFACE_OPTION_INVALID] TreeTable ${detail}`)
}

function validateNoDataSourceAttrs() {
  if (Object.hasOwn(attrs, 'data') || Object.hasOwn(attrs, 'load') || Object.hasOwn(attrs, 'resourceLoader') || Object.hasOwn(attrs, 'resource-loader')) {
    optionError('content accepts loaded records and cannot receive data, load, or resourceLoader.')
  }
}

validateNoDataSourceAttrs()
onBeforeUpdate(validateNoDataSourceAttrs)

const treeIndex = computed(() => {
  if (typeof props.rowKey !== 'string' && typeof props.rowKey !== 'function') {
    optionError('requires rowKey as a property name or a function returning a string or number.')
  }
  if (typeof props.children !== 'function') optionError('requires children to return an array for every record.')
  if (typeof props.treeColumn !== 'string' || props.treeColumn.length === 0) optionError('requires a nonempty treeColumn.')
  if (!props.columns || !Object.hasOwn(props.columns, props.treeColumn)) {
    optionError(`treeColumn "${props.treeColumn}" must be declared in columns.`)
  }
  if (props.visibleColumns !== undefined && !props.visibleColumns.includes(props.treeColumn)) {
    optionError(`treeColumn "${props.treeColumn}" cannot be excluded from visibleColumns.`)
  }
  if (props.pagination !== false && props.pagination !== 'auto' && props.pagination !== 'always') {
    optionError('pagination must be false, "auto", or "always".')
  }
  return buildTreeTableIndex(props.records, props.rowKey, props.children)
})

const hierarchy = computed(() => {
  const index = treeIndex.value
  return {
    children: index.childrenFor,
    keyFor: index.keyFor,
    treeColumn: props.treeColumn,
    expandedKeys: state.expandedKeys.value,
    parentKeys: index.parentKeys,
    onExpandedKeysChange: updateExpandedKeys,
  }
})

function updateExpandedKeys(keys: string[]) {
  const next = state.setExpandedKeys(keys)
  emit('update:expandedKeys', next)
}

function expandAll() {
  updateExpandedKeys([...state.expandedKeys.value, ...treeIndex.value.branchKeys])
}

function collapseAll() {
  updateExpandedKeys([])
}

function reveal(keys: readonly string[]) {
  const next = new Set(state.expandedKeys.value)
  for (const key of keys) {
    for (const ancestor of treeIndex.value.ancestorsFor(key)) next.add(ancestor)
  }
  updateExpandedKeys([...next])
}

function updateQuery(patch: QueryValues) {
  emit('update:query', patch)
}

function rowClick(record: TRecord, index: number) {
  emit('row-click', record, index)
}

function rowReorder(payload: RowReorderPayload<TRecord>) {
  emit('row-reorder', payload)
}

defineExpose({ expandAll, collapseAll, reveal })
</script>

<template>
  <TableContent
    :schema="props.schema"
    :query-schema="props.querySchema"
    :columns="props.columns"
    :labels="props.labels"
    :context="props.context"
    :result-context="props.resultContext"
    :records="props.records"
    :meta="props.meta"
    :loading="props.loading"
    :error="props.error"
    :empty="props.empty"
    :query="props.query"
    :refresh="props.refresh"
    :update-query="props.updateQuery"
    :search-parameters="props.searchParameters"
    :namespace="props.namespace"
    :pagination="props.pagination"
    :page-size-options="props.pageSizeOptions"
    :default-page-size="props.defaultPageSize"
    :min-column-width="props.minColumnWidth"
    :max-column-width="props.maxColumnWidth"
    :visible-columns="props.visibleColumns"
    :column-sizing="props.columnSizing"
    :row-key="treeIndex.keyFor"
    :hierarchy="hierarchy"
    @update:query="updateQuery"
    @update:visible-columns="emit('update:visibleColumns', $event)"
    @update:column-sizing="emit('update:columnSizing', $event)"
    @row-click="rowClick"
    @row-reorder="rowReorder"
  >
    <template v-if="$slots.collection" #collection="scope">
      <slot name="collection" v-bind="scope" />
    </template>
    <template v-for="name in forwardedSlotNames" :key="name" #[name]="scope">
      <slot :name="name" v-bind="scope ?? {}" />
    </template>
  </TableContent>
</template>
