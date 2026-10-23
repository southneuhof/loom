<script setup lang="ts" generic="TRecord extends object = Record<string, unknown>, TQuery extends object = Record<string, unknown>">
import { computed, onBeforeUpdate, toRaw, useAttrs, useSlots } from 'vue'
import type { CollectionSlotProps, QueryValues, SubmitError, TreeRowContext, TreeTableContentProps } from '../../contracts'
import type { ResolvedDisplayField } from '../../display/resolveDisplay'
import DisplayValue from '../../display/DisplayValue.vue'
import Icon from '../base/Icon.vue'
import TableContent from './TableContent.vue'
import { buildTreeTableIndex, useTreeTableState } from './useTreeTableState'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<TreeTableContentProps<TRecord, TQuery>>(), {
  searchParameters: () => ({}),
  pagination: false,
  pageSizeOptions: () => [10, 25, 50, 100],
  defaultPageSize: 10,
  minColumnWidth: 96,
})

const emit = defineEmits<{
  (event: 'update:expandedKeys', keys: string[]): void
  (event: 'update:query', query: QueryValues): void
  (event: 'update:visibleColumns', columns: string[]): void
  (event: 'update:columnSizing', sizes: Record<string, number>): void
  (event: 'row-click', record: TRecord, index: number): void
}>()

type RowScope = { record: TRecord; index: number; tree: TreeRowContext }
type CellScope = RowScope & { value: unknown; field: ResolvedDisplayField<TRecord> }

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
const treeSlotName = computed(() => `cell:${props.treeColumn}`)
const forwardedSlotNames = computed(() => Object.keys(slots).filter((name) => name !== 'collection' && name !== treeSlotName.value))
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

const visibleRows = computed(() => {
  const index = treeIndex.value
  const expandedKeys = new Set(state.expandedKeys.value)
  const rows: { record: TRecord; tree: TreeRowContext }[] = []

  function visit(records: readonly TRecord[], parentKey: string | null, depth: number) {
    for (const record of records) {
      const key = index.keyFor(record)
      const children = index.childrenFor(record)
      const expanded = expandedKeys.has(key)
      rows.push({
        record,
        tree: { key, parentKey, depth, hasChildren: children.length > 0, expanded },
      })
      if (expanded && children.length > 0) visit(children, key, depth + 1)
    }
  }

  visit(props.records, null, 0)
  return rows
})

const rowContexts = computed(() => new Map(visibleRows.value.map((row) => [toRaw(row.record), row.tree])))
const tableProps = computed(() => {
  const { children: _children, treeColumn: _treeColumn, expandedKeys: _expandedKeys, defaultExpandedKeys: _defaultExpandedKeys, ...table } = props
  return { ...table, records: visibleRows.value.map((row) => row.record), rowKey: treeIndex.value.keyFor }
})

function treeFor(record: TRecord): TreeRowContext {
  return rowContexts.value.get(toRaw(record))!
}

function withTree(scope: Record<string, unknown> | undefined) {
  if (!scope || !scope.record || typeof scope.record !== 'object') return scope ?? {}
  return { ...scope, tree: treeFor(scope.record as TRecord) }
}

function treeActionLabel(value: unknown, tree: TreeRowContext) {
  const label = typeof value === 'string' || typeof value === 'number' ? String(value) : 'row'
  return `${tree.expanded ? 'Collapse' : 'Expand'} ${label || 'row'}`
}

function updateExpandedKeys(keys: string[]) {
  emit('update:expandedKeys', state.setExpandedKeys(keys))
}

function toggle(key: string) {
  const next = new Set(state.expandedKeys.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  updateExpandedKeys([...next])
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

defineExpose({ expandAll, collapseAll, reveal })
</script>

<template>
  <TableContent
    v-bind="tableProps"
    @update:query="emit('update:query', $event)"
    @update:visible-columns="emit('update:visibleColumns', $event)"
    @update:column-sizing="emit('update:columnSizing', $event)"
    @row-click="(record, index) => emit('row-click', record, index)"
  >
    <template v-if="$slots.collection" #collection="scope">
      <slot name="collection" v-bind="scope" :records="props.records" />
    </template>
    <template v-for="name in forwardedSlotNames" :key="name" #[name]="scope">
      <slot :name="name" v-bind="withTree(scope)" />
    </template>
    <template #[treeSlotName]="cell">
      <span
        class="is-tree-table-cell inline-flex min-w-0 items-stretch"
        :style="{ paddingInlineStart: `${treeFor(cell.record).depth * 2.5}rem` }"
      >
        <button
          v-if="treeFor(cell.record).hasChildren"
          type="button"
          class="inline-flex size-6 shrink-0 items-center justify-center rounded overlay after:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary focus-visible:after:bg-primary-active active:after:bg-primary-active"
          :aria-label="treeActionLabel(cell.value, treeFor(cell.record))"
          :aria-expanded="treeFor(cell.record).expanded"
          @click.stop="toggle(treeFor(cell.record).key)"
        >
          <Icon name="arrow-right-s" :class="{ 'rotate-90': treeFor(cell.record).expanded }" />
        </button>
        <span v-else class="inline-block size-6 shrink-0" aria-hidden="true" />
        <span class="is-tree-table-label min-w-0 truncate">
          <slot :name="treeSlotName" v-bind="withTree(cell)">
            <DisplayValue :value="cell.value" :record="cell.record" :field="cell.field" :index="cell.index" />
          </slot>
        </span>
      </span>
    </template>
  </TableContent>
</template>
