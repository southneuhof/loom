<script setup lang="ts" generic="TRecord extends object = Record<string, unknown>, TQuery extends object = Record<string, unknown>, TContext extends object = Readonly<Record<string, unknown>>">
/**
 * Loaded-row table presentation. Collection owns data loading and query state.
 */
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, toRef, useSlots, watch } from 'vue'
import { getCoreRowModel, getExpandedRowModel, useVueTable, type ColumnDef, type ColumnSizingState, type ExpandedState, type Row } from '@tanstack/vue-table'
import type { QueryValues, RowReorderPayload, TableContentProps, TreeRowContext } from '../../contracts'
import { createSchemaRuntime, schemaOutputKeys, schemaSortByValues } from '../../schemas/schemaRuntime'
import { displayFieldForRecord, readDisplayValue, resolveDisplayFields, resolveDisplayValue, type ResolvedDisplayField } from '../../display/resolveDisplay'
import DisplayValue from '../../display/DisplayValue.vue'

import { useRendererRegistry } from '../../renderers/registry'
import Button from '../base/Button.vue'
import Icon from '../base/Icon.vue'
import SelectInput from '../inputs/SelectInput.vue'
import { useTablePreferences } from './useTablePreferences'
import Draggable from 'vuedraggable'

interface TableTreeHierarchy<TRecord extends object> {
  children: (record: TRecord) => readonly TRecord[]
  keyFor: (record: TRecord) => string
  treeColumn: string
  expandedKeys: readonly string[]
  parentKeys: ReadonlyMap<string, string | null>
  onExpandedKeysChange: (keys: string[]) => void
}

type TableContentRendererProps<TRecord extends object, TQuery extends object, TContext extends object> = TableContentProps<TRecord, TQuery, TContext> & {
  /** @internal Supplied only by TreeTableContent for shared nested rendering. */
  hierarchy?: TableTreeHierarchy<TRecord>
}

const props = withDefaults(defineProps<TableContentRendererProps<TRecord, TQuery, TContext>>(), {
  searchParameters: () => ({}),
  pagination: 'always',
  pageSizeOptions: () => [10, 25, 50, 100],
  defaultPageSize: 10,
  minColumnWidth: 96,
  maxColumnWidth: 360,
})

const emit = defineEmits<{
  (event: 'update:query', query: QueryValues): void
  (event: 'update:visibleColumns', columns: string[]): void
  (event: 'update:columnSizing', sizes: ColumnSizingState): void
  (event: 'row-click', record: TRecord, index: number): void
  (event: 'row-reorder', payload: RowReorderPayload<TRecord>): void
}>()

const renderers = useRendererRegistry('display')
const slots = useSlots()
const activeQuery = computed(() => props.query as unknown as QueryValues)

const recordKeys = computed(() => schemaOutputKeys(props.schema))
const querySchemaRuntime = computed(() => (props.querySchema ? createSchemaRuntime(props.querySchema) : undefined))
const queryKeys = computed(() => querySchemaRuntime.value?.inputKeys)
const querySortKeys = computed(() => (props.querySchema ? schemaSortByValues(props.querySchema) : undefined))
const fields = computed(() => {
  const resolved = resolveDisplayFields({
    surface: 'table',
    entries: props.columns,
    labels: props.labels,
    context: (props.context ?? {}) as TContext,
    recordKeys: recordKeys.value,
    queryKeys: queryKeys.value,
    querySortKeys: querySortKeys.value,
  })
  for (const field of resolved) {
    if (field.renderer) renderers.require(field.renderer)
  }
  return resolved
})
const fieldKeys = computed(() => fields.value.map((field) => field.key))
const minimumColumnWidth = computed(() => (Number.isFinite(props.minColumnWidth) && props.minColumnWidth! > 0 ? props.minColumnWidth! : 96))
const maximumColumnWidth = computed(() => (Number.isFinite(props.maxColumnWidth) && props.maxColumnWidth! > 0 ? props.maxColumnWidth! : 360))
const preferences = useTablePreferences(
  toRef(() => props.namespace),
  fieldKeys,
  minimumColumnWidth
)
// Runtime VNode props can retain kebab-case names from templates.  Detecting
// control through that object made `:visible-columns` look uncontrolled until
// remount.  The resolved prop is stable for both template and render-function
// callers.
const hasVisibleColumns = props.visibleColumns !== undefined
const hasColumnSizing = props.columnSizing !== undefined
const visibleFields = computed(() => {
  const requested = hasVisibleColumns ? (props.visibleColumns ?? fieldKeys.value) : preferences.visibleKeys.value
  const visible = new Set(requested)
  if (props.hierarchy) visible.add(props.hierarchy.treeColumn)
  return fields.value.filter((field) => visible.has(field.key))
})
const columnSizing = ref<ColumnSizingState>({ ...(props.columnSizing ?? preferences.sizes.value) })
const headerElements = new Map<string, HTMLElement>()
const resizingColumn = ref<string>()
const resizeStartX = ref(0)
const resizeStartWidth = ref(0)
watch(
  () => props.columnSizing,
  (sizes) => {
    if (hasColumnSizing && !resizingColumn.value) columnSizing.value = { ...(sizes ?? {}) }
  }
)
watch(preferences.sizes, (sizes) => {
  if (!hasColumnSizing && !resizingColumn.value) columnSizing.value = { ...sizes }
})

const effectiveQuery = computed<QueryValues>(() => {
  if (!props.reorderable) return activeQuery.value
  const { page: _page, limit: _limit, sort_by: _sortBy, sort: _sort, ...filters } = activeQuery.value
  return filters
})

const rows = computed(() => props.records)
const orderedRows = shallowRef<TRecord[]>([])
const tableData = computed<TRecord[]>(() => (props.reorderable ? orderedRows.value : rows.value))
watch(
  rows,
  (next) => {
    orderedRows.value = [...next]
  },
  { immediate: true }
)
const meta = computed(() => props.meta)
const empty = computed(() => props.empty)
const totalPage = computed(() => meta.value?.totalPage)
const showPagination = computed(() => !props.reorderable && totalPage.value != null && props.pagination !== false && (props.pagination === 'always' || totalPage.value > 1))
const defaultPageSize = computed(() => (Number.isInteger(props.defaultPageSize) && props.defaultPageSize! > 0 ? props.defaultPageSize! : 10))
const pageSizeOptions = computed(() => {
  const values = props.pageSizeOptions!.filter((value) => Number.isInteger(value) && value > 0)
  const current = Number(activeQuery.value.limit ?? defaultPageSize.value)
  return [...new Set([...values, current])].sort((left, right) => left - right)
})
const pageSizeItems = computed(() => pageSizeOptions.value.map((value) => ({ id: String(value), name: String(value) })))
const pageStart = computed(() => {
  const total = meta.value?.total
  if (total == null || total === 0) return 0
  return pagination.value.pageIndex * pagination.value.pageSize + 1
})
const pageEnd = computed(() => {
  const total = meta.value?.total
  if (total == null || pageStart.value === 0) return 0
  return Math.min(total, pageStart.value + rows.value.length - 1)
})
const sorting = computed(() => {
  const { sort_by, sort } = activeQuery.value
  const field = fields.value.find((entry) => (entry.sortKey ?? entry.key) === String(sort_by))
  return field ? [{ id: field.key, desc: sort === 'desc' }] : []
})
const pagination = computed(() => ({
  pageIndex: Math.max(0, Number(activeQuery.value.page ?? 1) - 1),
  pageSize: Number(activeQuery.value.limit ?? defaultPageSize.value),
}))
const columns = computed<ColumnDef<TRecord>[]>(() =>
  fields.value.map((field) => ({
    id: field.key,
    accessorFn: (record) => readDisplayValue(record, field, (props.context ?? {}) as TContext),
    header: field.label,
    enableSorting: field.sortable === true && !props.reorderable,
    sortDescFirst: false,
  }))
)

function updateQuery(patch: QueryValues) {
  emit('update:query', { ...activeQuery.value, ...patch })
}

function refreshCollection() {
  return props.refresh?.() ?? Promise.resolve()
}

function setPageSize(value: unknown) {
  const limit = Number(value)
  if (!Number.isInteger(limit) || limit <= 0) return
  updateQuery({ limit, page: 1 })
}

function setVisibleColumns(next: readonly string[]) {
  const normalized = fieldKeys.value.filter((key) => next.includes(key))
  if (!slots['row-actions'] && normalized.length === 0 && fieldKeys.value.length) return
  if (!hasVisibleColumns) preferences.setVisible(normalized)
  emit('update:visibleColumns', normalized)
}

function normalizeColumnSizing(next: ColumnSizingState) {
  return Object.fromEntries(
    Object.entries(next)
      .filter(([key, value]) => fieldKeys.value.includes(key) && Number.isFinite(value))
      .map(([key, value]) => [key, Math.max(minimumColumnWidth.value, value)])
  )
}

function commitColumnSizing(next: ColumnSizingState) {
  const normalized = normalizeColumnSizing(next)
  columnSizing.value = normalized
  if (!hasColumnSizing) preferences.setSizes(normalized)
  emit('update:columnSizing', { ...normalized })
}

function resetColumns() {
  preferences.resetColumns()
  setVisibleColumns(fieldKeys.value)
  columnSizing.value = {}
}

function rowIdentity(record: TRecord) {
  if (props.hierarchy) return props.hierarchy.keyFor(record)
  if (!props.rowKey) throw new Error('[loom] Table reorderable mode requires rowKey.')
  const value = typeof props.rowKey === 'function' ? props.rowKey(record) : Reflect.get(record, props.rowKey)
  if (typeof value !== 'string' && typeof value !== 'number') throw new Error('[loom] Table rowKey must return a string or number.')
  return String(value)
}

watch(
  orderedRows,
  (next) => {
    if (!props.reorderable) return
    const identities = next.map(rowIdentity)
    if (new Set(identities).size !== identities.length) throw new Error('[loom] Table reorderable rows require unique rowKey values.')
  },
  { immediate: true }
)

function reorder(event: { oldIndex?: number; newIndex?: number }) {
  if (event.oldIndex == null || event.newIndex == null || event.oldIndex === event.newIndex) return
  emit('row-reorder', { rows: [...orderedRows.value], oldIndex: event.oldIndex, newIndex: event.newIndex, moved: orderedRows.value[event.newIndex], query: effectiveQuery.value })
}

const table = useVueTable<TRecord>({
  data: tableData,
  get columns() {
    return columns.value
  },
  get state() {
    const expanded: Record<string, boolean> = Object.fromEntries((props.hierarchy?.expandedKeys ?? []).map((key) => [key, true]))
    return { sorting: sorting.value, pagination: pagination.value, expanded }
  },
  get pageCount() {
    return totalPage.value ?? -1
  },
  getCoreRowModel: getCoreRowModel(),
  getExpandedRowModel: getExpandedRowModel(),
  getSubRows: (record) => (props.hierarchy ? [...props.hierarchy.children(record)] : undefined),
  autoResetExpanded: false,
  manualSorting: true,
  manualPagination: !props.reorderable,
  getRowId: props.rowKey !== undefined || props.hierarchy ? (record) => rowIdentity(record) : undefined,
  enableMultiSort: false,
  enableSortingRemoval: false,
  onSortingChange: (updater) => {
    const next = typeof updater === 'function' ? updater(sorting.value) : updater
    const sort = next[0]
    if (!sort) return
    const field = fields.value.find((entry) => entry.key === sort.id)
    updateQuery({ sort_by: field?.sortKey ?? field?.key ?? sort.id, sort: sort.desc ? 'desc' : 'asc', page: 1 })
  },
  onPaginationChange: (updater) => {
    const next = typeof updater === 'function' ? updater(pagination.value) : updater
    if (next.pageIndex < 0) return
    if (totalPage.value != null && next.pageIndex >= totalPage.value) return
    updateQuery({ page: next.pageIndex + 1, limit: next.pageSize })
  },
  onExpandedChange: (updater) => {
    const hierarchy = props.hierarchy
    if (!hierarchy) return
    const current: ExpandedState = Object.fromEntries(hierarchy.expandedKeys.map((key) => [key, true]))
    const next = typeof updater === 'function' ? updater(current) : updater
    hierarchy.onExpandedKeysChange(next === true ? [] : Object.keys(next).filter((key) => next[key]))
  },
})

const disclosureElements = new Map<string, HTMLButtonElement>()
const rootElement = ref<HTMLElement>()

function treeContext(row: Row<TRecord>): TreeRowContext | undefined {
  const hierarchy = props.hierarchy
  if (!hierarchy) return undefined
  return {
    key: row.id,
    depth: row.depth,
    parentKey: row.parentId ?? null,
    hasChildren: row.subRows.length > 0,
    expanded: row.getIsExpanded(),
    toggleExpanded: () => row.toggleExpanded(),
  }
}

function rowScope(row: Row<TRecord>, index: number) {
  const tree = treeContext(row)
  return { record: row.original, index, ...(tree ? { tree } : {}) }
}

function cellScope(row: Row<TRecord>, field: ResolvedDisplayField<TRecord, TContext>, index: number) {
  return { value: valueFor(row.original, field), ...rowScope(row, index), field: displayFieldFor(row.original, field) }
}

function setDisclosureElement(key: string, element: unknown) {
  const root = element && typeof element === 'object' && '$el' in element ? Reflect.get(element, '$el') : element
  if (root instanceof HTMLButtonElement) disclosureElements.set(key, root)
  else disclosureElements.delete(key)
}

function treeLabel(record: TRecord, field: ResolvedDisplayField<TRecord, TContext>) {
  const value = valueFor(record, field)
  return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined
}

watch(
  () => props.hierarchy?.expandedKeys,
  (nextKeys, previousKeys) => {
    const hierarchy = props.hierarchy
    if (!hierarchy || !nextKeys || !previousKeys || typeof document === 'undefined') return
    const active = document.activeElement
    if (!(active instanceof HTMLElement)) return
    const focusedRow = active.closest<HTMLTableRowElement>('tr[data-tree-key]')
    if (!focusedRow || !rootElement.value?.contains(focusedRow)) return
    const focusedKey = focusedRow?.dataset.treeKey
    if (!focusedKey) return

    const next = new Set(nextKeys)
    const previous = new Set(previousKeys)
    let candidate = hierarchy.parentKeys.get(focusedKey) ?? null
    let target: string | undefined
    while (candidate !== null) {
      if (previous.has(candidate) && !next.has(candidate)) {
        let visible = true
        let parent = hierarchy.parentKeys.get(candidate) ?? null
        while (parent !== null) {
          if (!next.has(parent)) {
            visible = false
            break
          }
          parent = hierarchy.parentKeys.get(parent) ?? null
        }
        if (visible) {
          target = candidate
          break
        }
      }
      candidate = hierarchy.parentKeys.get(candidate) ?? null
    }
    if (target) void nextTick(() => disclosureElements.get(target!)?.focus())
  },
  { flush: 'pre' }
)

// Let normal tables fill their container.  Column sizes remain a minimum, so
// resize state still controls overflow on narrow screens instead of shrinking
// every column into the left edge.
const tableMinimumWidth = computed(() => visibleFields.value.reduce((total, field) => total + sizeFor(field.key), slots['row-actions'] ? 64 : 0))

function setHeaderElement(key: string, element: unknown) {
  if (element instanceof HTMLElement) headerElements.set(key, element)
  else headerElements.delete(key)
}

function startResize(event: MouseEvent, columnKey: string) {
  if (event.button !== 0 || resizingColumn.value) return
  const header = headerElements.get(columnKey)
  resizeStartWidth.value = header?.getBoundingClientRect().width ?? columnSizing.value[columnKey] ?? table.getColumn(columnKey)?.getSize() ?? minimumColumnWidth.value
  resizeStartX.value = event.clientX
  resizingColumn.value = columnKey
  document.addEventListener('mousemove', resizeColumn)
  document.addEventListener('mouseup', stopResize)
}

function resizeColumn(event: MouseEvent) {
  const columnKey = resizingColumn.value
  if (!columnKey) return
  columnSizing.value[columnKey] = Math.max(minimumColumnWidth.value, resizeStartWidth.value + event.clientX - resizeStartX.value)
}

function stopResize() {
  if (!resizingColumn.value) return
  resizingColumn.value = undefined
  resizeStartX.value = 0
  document.removeEventListener('mousemove', resizeColumn)
  document.removeEventListener('mouseup', stopResize)
  commitColumnSizing(columnSizing.value)
}

function cancelResize() {
  resizingColumn.value = undefined
  resizeStartX.value = 0
  document.removeEventListener('mousemove', resizeColumn)
  document.removeEventListener('mouseup', stopResize)
}

onBeforeUnmount(cancelResize)

function valueFor(record: TRecord, field: ResolvedDisplayField<TRecord, TContext>) {
  return resolveDisplayValue(record, field, (props.context ?? {}) as TContext)
}

function displayFieldFor(record: TRecord, field: ResolvedDisplayField<TRecord, TContext>) {
  return displayFieldForRecord(record, field, (props.context ?? {}) as TContext)
}

function sizeFor(key: string) {
  return columnSizing.value[key] ?? table.getColumn(key)?.getSize() ?? minimumColumnWidth.value
}

// Long values keep the list comparable: a text value stays on one line and
// truncates with an ellipsis instead of widening the whole table, and its full
// text stays reachable through the native tooltip (`title`) on hover.  Renderer
// content is not plain text, so it wraps inside the same cap instead of losing
// chips, while a `cell:<key>` slot shares the cap but owns its own markup and
// its own tooltip.
// A resized column owns its own limit so an explicit width still shows more of
// the value.  The column cap arrives once per table as
// `--loom-table-cell-max-width`, so a cell only carries inline style when it
// deviates from that default.  Style objects are cached per column key so a
// re-render patches the same object instead of creating work for every cell of
// a large page.
const cellStyles = computed(() => {
  const styles = new Map<string, Record<string, string>>()
  for (const field of fields.value) {
    const style: Record<string, string> = {}
    const width = columnSizing.value[field.key]
    if (width != null) style.maxWidth = `${width}px`
    if (field.align === 'end') style.marginInlineStart = 'auto'
    if (field.align === 'center') style.marginInline = 'auto'
    if (Object.keys(style).length > 0) styles.set(field.key, style)
  }
  return styles
})

function cellContentStyle(field: ResolvedDisplayField<TRecord, TContext>): Record<string, string> | undefined {
  return cellStyles.value.get(field.key)
}

// The tooltip carries the text a clamped cell no longer shows, so it only
// applies to plain text: renderer content wraps instead of being clipped, and a
// slot cell owns both its markup and its tooltip.
function cellTitle(record: TRecord, field: ResolvedDisplayField<TRecord, TContext>): string | undefined {
  if (displayFieldFor(record, field).renderer || hasCellSlot(field.key)) return undefined
  const value = valueFor(record, field)
  return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined
}

function hasCellSlot(key: string): boolean {
  return Boolean(slots[`cell:${key}`])
}
</script>

<template>
  <div ref="rootElement" class="is-table flex flex-col gap-3 text-sm text-on-surface" :class="{ 'is-tree-table': Boolean(props.hierarchy) }">
    <div v-if="props.loading" class="flex min-h-40 items-center justify-center rounded-xl bg-surface-container px-6 py-10 text-on-surface-variant">
      <slot name="loading">
        <p role="status" aria-live="polite">Memuat…</p>
      </slot>
    </div>

    <div v-else-if="props.error && rows.length === 0" class="flex min-h-40 items-center justify-center rounded-xl px-6 py-10">
      <slot name="error" :error="props.error">
        <p role="alert">{{ props.error?.message }}</p>
      </slot>
    </div>

    <div v-else-if="empty" class="flex min-h-40 items-center justify-center rounded-xl px-6 py-10">
      <slot name="empty">
        <p>No data</p>
      </slot>
    </div>

    <template v-else>
      <div v-if="props.error" class="rounded-xl bg-error-container px-4 py-3 text-on-error-container">
        <slot name="error" :error="props.error">
          <p role="alert">{{ props.error.message }}</p>
        </slot>
      </div>
      <slot
        v-if="$slots.collection"
        name="collection"
        :records="props.records"
        :meta="props.meta"
        :context="props.resultContext"
        :loading="false"
        :error="props.error"
        :empty="false"
        :query="props.query"
        :refresh="refreshCollection"
        :update-query="props.updateQuery ?? updateQuery"
      />
      <div v-else class="overflow-x-auto rounded-xl">
        <table class="w-full border-collapse table-auto" :style="{ minWidth: `${tableMinimumWidth}px`, '--loom-table-cell-max-width': `${maximumColumnWidth}px` }">
          <colgroup>
            <col v-if="$slots['row-prefix']" style="width: 1%" />
            <col v-for="field in visibleFields" :key="field.key" :style="columnSizing[field.key] == null ? undefined : { width: `${columnSizing[field.key]}px` }" />
            <col v-if="$slots['row-actions']" style="width: 1%" />
          </colgroup>
          <thead class="bg-surface-container-high text-on-surface-variant">
            <tr>
              <th v-if="$slots['row-prefix']" scope="col" class="w-px whitespace-nowrap border-b border-outline-variant bg-surface-container-high px-3 py-2" style="width: 1%" />
              <th
                v-for="field in visibleFields"
                :key="field.key"
                :ref="(element) => setHeaderElement(field.key, element)"
                scope="col"
                :style="{ textAlign: field.align }"
                :class="field.headerClass"
                class="relative whitespace-nowrap text-start border-b border-outline-variant px-4 py-2 text-xs font-semibold"
              >
                <button
                  v-if="field.sortable && !props.reorderable"
                  type="button"
                  class="overlay -mx-2 inline-flex rounded-md px-2 font-semibold after:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary focus-visible:after:bg-primary-active active:after:bg-primary-active"
                  @click="table.getColumn(field.key)?.toggleSorting()"
                >
                  {{ field.label }}
                </button>
                <template v-else>{{ field.label }}</template>
                <button
                  type="button"
                  class="absolute inset-y-0 right-0 w-3 cursor-col-resize opacity-0 hover:opacity-100 focus-visible:opacity-100"
                  aria-label="Resize column"
                  role="separator"
                  aria-orientation="vertical"
                  :class="{ 'opacity-100': resizingColumn === field.key }"
                  @mousedown.prevent="startResize($event, field.key)"
                />
              </th>
              <th
                v-if="$slots['row-actions']"
                scope="col"
                class="sticky right-0 z-10 w-px whitespace-nowrap border-b border-outline-variant bg-surface-container-high px-4 py-2 text-right text-xs font-semibold"
              />
            </tr>
          </thead>
          <Draggable v-if="props.reorderable" v-model="orderedRows" tag="tbody" :item-key="rowIdentity" class="divide-y divide-outline/[12%]" @end="reorder">
            <template #item="{ element: record, index }">
              <tr class="group transition-none hover:bg-primary-hover focus-within:bg-primary-active active:bg-primary-active" @click="emit('row-click', record, index)">
                <td v-if="$slots['row-prefix']" class="w-px whitespace-nowrap px-3 py-2" style="width: 1%" @click.stop>
                  <slot name="row-prefix" :record="record" :index="index" />
                </td>
                <td v-for="field in visibleFields" :key="field.key" :style="{ textAlign: field.align }" :class="field.class" class="whitespace-nowrap px-4 py-3.5 text-on-surface">
                  <div class="is-table-cell-value" :class="{ 'is-table-cell-value--rich': displayFieldFor(record, field).renderer }" :style="cellContentStyle(field)" :title="cellTitle(record, field)">
                    <slot v-if="hasCellSlot(field.key)" :name="`cell:${field.key}`" :value="valueFor(record, field)" :record="record" :field="displayFieldFor(record, field)" :index="index" />
                    <DisplayValue v-else :value="valueFor(record, field)" :record="record" :field="displayFieldFor(record, field)" :index="index" />
                  </div>
                </td>
                <td
                  v-if="$slots['row-actions']"
                  class="is-table-row-action sticky right-0 z-10 w-px whitespace-nowrap px-3 py-2 text-right transition-none before:pointer-events-none before:absolute before:inset-y-0 before:content-['']"
                  @click.stop
                >
                  <slot name="row-actions" :record="record" :index="index" />
                </td>
              </tr>
            </template>
          </Draggable>
          <tbody v-else class="divide-y divide-outline/[12%]">
            <tr
              v-for="(row, index) in table.getRowModel().rows"
              :key="row.id"
              v-bind="props.hierarchy ? { 'data-tree-key': row.id } : {}"
              class="group transition-none hover:bg-primary-hover focus-within:bg-primary-active active:bg-primary-active"
              @click="emit('row-click', row.original, index)"
            >
              <td v-if="$slots['row-prefix']" class="w-px whitespace-nowrap pr-0 pl-3 py-2" style="width: 1%" @click.stop>
                <slot name="row-prefix" v-bind="rowScope(row, index)" />
              </td>
              <td
                v-for="field in visibleFields"
                :key="field.key"
                :style="{ textAlign: field.align }"
                class="px-4 py-3.5 text-on-surface"
                :class="[props.hierarchy && field.key === props.hierarchy.treeColumn ? 'whitespace-normal' : 'whitespace-nowrap', field.class]"
              >
                <template v-if="props.hierarchy && field.key === props.hierarchy.treeColumn">
                  <div class="is-tree-table-cell flex min-w-0 items-start gap-2" :style="{ '--loom-tree-depth': row.depth }">
                    <Button
                      v-if="row.getCanExpand()"
                      :ref="(element) => setDisclosureElement(row.id, element)"
                      kind="icon"
                      variant="standard"
                      type="button"
                      class="is-tree-table-disclosure h-8 w-8 min-w-8 shrink-0 aspect-square p-1"
                      :ariaLabel="`${row.getIsExpanded() ? 'Ciutkan' : 'Luaskan'} ${treeLabel(row.original, field) ?? 'baris'}`"
                      v-bind="{ 'aria-expanded': String(row.getIsExpanded()) }"
                      @click.stop="row.toggleExpanded()"
                    >
                      <template #icon><Icon :name="row.getIsExpanded() ? 'arrow-down-s' : 'arrow-right-s'" size="base" /></template>
                    </Button>
                    <span v-else aria-hidden="true" class="is-tree-table-disclosure-spacer inline-block h-8 w-8 shrink-0" />
                    <span class="is-tree-table-label min-w-0 flex-1 whitespace-normal">
                      <div
                        class="is-table-cell-value"
                        :class="{ 'is-table-cell-value--rich': displayFieldFor(row.original, field).renderer }"
                        :style="cellContentStyle(field)"
                        :title="cellTitle(row.original, field)"
                      >
                        <slot v-if="hasCellSlot(field.key)" :name="`cell:${field.key}`" v-bind="cellScope(row, field, index)" />
                        <DisplayValue v-else :value="valueFor(row.original, field)" :record="row.original" :field="displayFieldFor(row.original, field)" :index="index" />
                      </div>
                    </span>
                  </div>
                </template>
                <template v-else>
                  <div
                    class="is-table-cell-value"
                    :class="{ 'is-table-cell-value--rich': displayFieldFor(row.original, field).renderer }"
                    :style="cellContentStyle(field)"
                    :title="cellTitle(row.original, field)"
                  >
                    <slot v-if="hasCellSlot(field.key)" :name="`cell:${field.key}`" v-bind="cellScope(row, field, index)" />
                    <DisplayValue v-else :value="valueFor(row.original, field)" :record="row.original" :field="displayFieldFor(row.original, field)" :index="index" />
                  </div>
                </template>
              </td>
              <td
                v-if="$slots['row-actions']"
                class="is-table-row-action sticky right-0 z-10 w-px whitespace-nowrap px-3 py-2 text-right transition-none before:pointer-events-none before:absolute before:inset-y-0 before:content-['']"
                @click.stop
              >
                <slot name="row-actions" v-bind="rowScope(row, index)" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <nav v-if="showPagination" class="flex flex-wrap items-center justify-between gap-3 px-1 pt-1" aria-label="Pagination">
        <div class="flex items-center gap-1">
          <Button kind="icon" variant="standard" ariaLabel="Previous page" :disabled="!table.getCanPreviousPage()" @click="table.previousPage()">
            <template #icon><Icon name="arrow-left-s" /></template>
          </Button>
          <span class="min-w-8 rounded-md text-center text-xs font-medium tabular-nums text-muted"> {{ pagination.pageIndex + 1 }} / {{ totalPage }} </span>
          <Button kind="icon" variant="standard" ariaLabel="Next page" :disabled="!table.getCanNextPage()" @click="table.nextPage()">
            <template #icon><Icon name="arrow-right-s" /></template>
          </Button>
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <slot name="pagination-summary" :start="pageStart" :end="pageEnd" :total="meta?.total" :query="activeQuery">
            <span v-if="meta?.total != null" class="text-xs text-on-surface-variant">Showing data {{ pageStart }}–{{ pageEnd }} out of {{ meta.total }}</span>
          </slot>
          <slot name="page-size-control" :options="pageSizeOptions" :limit="pagination.pageSize" :set-page-size="setPageSize">
            <SelectInput :model-value="String(pagination.pageSize)" :data="pageSizeItems" :searchable="false" :clearable="false" @update:model-value="setPageSize" />
          </slot>
        </div>
      </nav>
    </template>
  </div>
</template>

<style scoped>
/* Keeps a long value from widening the list: one line, clipped with an
   ellipsis, and the full text stays available through the cell tooltip.  A
   `cell:<key>` slot shares the cap; declaring `white-space: normal` on its
   content (or on the wrapper below) restores multi-line rendering there. */
.is-table-cell-value {
  display: block;
  max-width: var(--loom-table-cell-max-width, 360px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Renderer content is chips and previews rather than text, so it wraps inside
   the same cap instead of being clipped away. */
.is-table-cell-value--rich {
  overflow-wrap: anywhere;
  white-space: normal;
}

.is-tree-table-cell {
  min-width: 0;
  padding-inline-start: calc(var(--loom-tree-indent, 1rem) * var(--loom-tree-depth, 0));
}

.is-tree-table-label {
  overflow-wrap: anywhere;
}

.is-table-row-action {
  --is-table-row-surface: rgb(var(--md-sys-color-surface-container));
  --is-table-row-layer: transparent;
  background-color: transparent;
  transition: none;
}

.is-table-row-action::before {
  left: -2.5rem;
  width: calc(100% + 2.5rem);
  background-image:
    linear-gradient(to left, var(--is-table-row-layer) 0%, var(--is-table-row-layer) 80%, transparent 100%),
    linear-gradient(to left, var(--is-table-row-surface) 0%, var(--is-table-row-surface) 80%, transparent 100%);
  opacity: 1;
  z-index: 0;
  transition: none;
}

.is-table-row-action > * {
  position: relative;
  z-index: 1;
}

.group:hover .is-table-row-action {
  --is-table-row-layer: var(--md-sys-color-primary-hover);
}

.group:focus-within .is-table-row-action,
.group:active .is-table-row-action {
  --is-table-row-layer: var(--md-sys-color-primary-active);
}
</style>
