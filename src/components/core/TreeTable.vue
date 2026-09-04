<script setup lang="ts" generic="TRecord extends object = Record<string, unknown>, TQuery extends object = Record<string, unknown>">
import { computed, ref, shallowRef, toRaw, useSlots } from 'vue'
import type {
  CollectionLoadContext,
  CollectionResult,
  QueryValues,
  RowReorderPayload,
  TreeTableProps,
} from '../../contracts'
import type { ResolvedSurfaceField } from '../../fields'
import Table from './Table.vue'

type TreeRowMetadata = {
  depth: number
}

type FlatTreeRow<TRecord extends object> = {
  record: TRecord
  depth: number
}

type TreeCellScope<TRecord extends object> = {
  value: unknown
  record: TRecord
  field: ResolvedSurfaceField
  index: number
  depth: number
}

type TableExpose = {
  refresh: () => Promise<void>
  query: QueryValues
  updateQuery: (query: QueryValues) => void
}

const props = withDefaults(defineProps<TreeTableProps<TRecord, TQuery>>(), {
  searchParameters: () => ({}),
  pagination: 'always',
  pageSizeOptions: () => [10, 25, 50, 100],
  defaultPageSize: 10,
  minColumnWidth: 96,
})

const emit = defineEmits<{
  (event: 'update:query', query: QueryValues): void
  (event: 'update:visibleColumns', columns: string[]): void
  (event: 'update:columnSizing', sizes: Record<string, number>): void
  (event: 'row-click', record: Record<string, unknown>, index: number): void
  (event: 'row-reorder', payload: RowReorderPayload): void
}>()

const slots = useSlots()
const tableRef = ref<TableExpose>()
const loaderMetadata = shallowRef<Map<TRecord, TreeRowMetadata>>(new Map())

function originalRecord(record: TRecord): TRecord {
  return toRaw(record) as TRecord
}

function treeError(): Error {
  return new Error('[loom] TreeTable children must form a tree.')
}

function flattenTree(records: readonly TRecord[]) {
  const rows: FlatTreeRow<TRecord>[] = []
  const seen = new Set<TRecord>()

  function flatten(items: readonly TRecord[], depth: number): void {
    items.forEach((input) => {
      const record = originalRecord(input)
      if (seen.has(record)) throw treeError()
      seen.add(record)

      rows.push({ record, depth })
      flatten(props.children(record), depth + 1)
    })
  }

  flatten(records, 0)

  const metadata = new Map<TRecord, TreeRowMetadata>(rows.map((row) => [row.record, { depth: row.depth }]))

  return { records: rows.map((row) => row.record), metadata }
}

const dataTree = computed(() => props.data === undefined ? undefined : flattenTree(props.data))

async function loadTree(context: CollectionLoadContext<TQuery>): Promise<CollectionResult<TRecord>> {
  if (!props.load) throw new Error('[loom] No loader supplied.')
  const result = await props.load(context)
  const tree = flattenTree(result.data)
  loaderMetadata.value = tree.metadata
  return { ...result, data: tree.records }
}

const tableProps = computed(() => {
  const { children: _children, treeColumn: _treeColumn, data: _data, load: _load, ...ordinaryProps } = props
  return {
    ...ordinaryProps,
    data: dataTree.value?.records,
    load: props.load === undefined ? undefined : loadTree,
  }
})

const activeMetadata = computed(() => dataTree.value?.metadata ?? loaderMetadata.value)
const treeSlotName = computed(() => `cell:${props.treeColumn}`)
const forwardedSlotNames = computed(() => Object.keys(slots).filter((name) => name !== 'tree-cell' && name !== treeSlotName.value))

function metadataFor(record: Record<string, unknown>) {
  return activeMetadata.value.get(originalRecord(record as TRecord)) ?? { depth: 0 }
}

function treeCellScope(cell: {
  value: unknown
  record: Record<string, unknown>
  field: ResolvedSurfaceField
  index: number
}): TreeCellScope<TRecord> {
  return { ...cell, record: originalRecord(cell.record as TRecord), ...metadataFor(cell.record) }
}

function forwardedSlotProps(slotProps: Record<string, unknown> | undefined) {
  if (!slotProps || !('record' in slotProps) || !slotProps.record || typeof slotProps.record !== 'object') return slotProps ?? {}
  return { ...slotProps, record: originalRecord(slotProps.record as TRecord) }
}

const refresh = () => tableRef.value?.refresh() ?? Promise.resolve()
const query = computed(() => tableRef.value?.query ?? {})
const treeIndentationRem = 2.5
function updateQuery(next: QueryValues) {
  tableRef.value?.updateQuery(next)
}

function rowClick(record: Record<string, unknown>, index: number) {
  emit('row-click', originalRecord(record as TRecord) as Record<string, unknown>, index)
}

function rowReorder(payload: RowReorderPayload) {
  emit('row-reorder', payload)
}

defineExpose({ refresh, query, updateQuery })
</script>

<template>
  <Table
    ref="tableRef"
    v-bind="tableProps"
    @update:query="emit('update:query', $event)"
    @update:visible-columns="emit('update:visibleColumns', $event)"
    @update:column-sizing="emit('update:columnSizing', $event)"
    @row-click="rowClick"
    @row-reorder="rowReorder"
  >
    <template v-for="name in forwardedSlotNames" :key="name" #[name]="slotProps">
      <slot :name="name" v-bind="forwardedSlotProps(slotProps)" />
    </template>

    <template #[treeSlotName]="cell">
      <span class="is-tree-table-cell inline-flex min-w-0 items-stretch">
        <span
          class="is-tree-table-label min-w-0 truncate"
          :style="{ paddingInlineStart: `${metadataFor(cell.record).depth * treeIndentationRem}rem` }"
        >
          <slot name="tree-cell" v-bind="treeCellScope(cell)">{{ cell.value ?? '-' }}</slot>
        </span>
      </span>
    </template>
  </Table>
</template>
