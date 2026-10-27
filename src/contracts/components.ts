/**
 * Core component prop contracts.
 *
 * `Table`, `Detail`, and `Form` are resource-agnostic: they own data and field
 * orchestration only. Cards, headings, toolbars, and page actions belong
 * to the view shells (plan 005). Form owns draft state, rendering, validation,
 * and submission — it never learns whether it creates or updates.
 *
 * Plan 004 implements the components against exactly these props.
 *
 * `data` and `load` are alternatives: `data` means the caller controls the
 * data, `load` means the component owns loading. Supplying both is a
 * development error reported at runtime.
 */

import type { CollectionLoadContext, Load, RecordIdentity, RecordLoadContext } from './load'
import type { RawSchema } from './schema'
import type { CollectionMeta, CollectionResult, RecordResult } from './results'
import type { QueryNamespace, QueryValues } from './query'
import type { DetailDefinition, DetailFieldEntry } from './details'
import type { TableColumnEntry, TableDefinition } from './tables'
import type { SubmitError } from './results'

interface CollectionOptions<TQuery extends object> {
  meta?: CollectionMeta
  searchParameters?: Record<string, unknown>
  resource?: string
  namespace?: QueryNamespace
  query?: TQuery
  querySchema?: RawSchema<object, TQuery>
  pagination?: 'auto' | 'always' | false
  pageSizeOptions?: readonly number[]
  defaultPageSize?: number
  reorderable?: boolean
}

type CollectionSource<TRecord extends object = Record<string, unknown>, TQuery extends object = Record<string, unknown>> =
  | { data: TRecord[]; load?: never }
  | { load: Load<CollectionLoadContext<TQuery>, CollectionResult<TRecord>>; data?: never }

export type CollectionProps<TRecord extends object = Record<string, unknown>, TQuery extends object = Record<string, unknown>> = CollectionOptions<TQuery> & CollectionSource<TRecord, TQuery>

export interface CollectionSlotProps<TRecord extends object = Record<string, unknown>, TQuery extends object = Record<string, unknown>> {
  records: TRecord[]
  meta?: CollectionMeta
  /** Query-specific auxiliary data returned with the cached collection. */
  context?: unknown
  loading: boolean
  error?: SubmitError
  empty: boolean
  query: TQuery
  refresh: () => Promise<void>
  updateQuery: (patch: QueryValues) => void
}

interface TableOptions<
  TRecord extends object = Record<string, unknown>,
  TQuery extends object = Record<string, unknown>,
  TContext extends object = Readonly<Record<string, unknown>>,
> extends CollectionOptions<TQuery>, TableDefinition<TRecord, Readonly<Record<string, TableColumnEntry<TRecord, TContext>>>, TContext> {
  /** Minimum resizable width in pixels. */
  minColumnWidth?: number
  /**
   * Maximum rendered width in pixels for a data column value. Longer text stays
   * on one line and truncates with an ellipsis, and the full value remains
   * available through the cell tooltip. Defaults to 360.
   */
  maxColumnWidth?: number
  /** Controlled visible data-column keys. */
  visibleColumns?: readonly string[]
  /** Controlled data-column widths in pixels. */
  columnSizing?: Readonly<Record<string, number>>
  rowKey?: string | ((record: TRecord) => string | number)
}

export type TableProps<
  TRecord extends object = Record<string, unknown>,
  TQuery extends object = Record<string, unknown>,
  TContext extends object = Readonly<Record<string, unknown>>,
> = TableOptions<TRecord, TQuery, TContext> & CollectionSource<TRecord, TQuery>

export interface TreeRowContext {
  key: string
  depth: number
  parentKey: string | null
  hasChildren: boolean
  expanded: boolean
  toggleExpanded: () => void
}

type TreeExpansionOptions = {
  expandedKeys?: readonly string[]
  defaultExpandedKeys?: readonly string[]
}

export type TreePresentationOptions<TRecord extends object> = {
  rowKey: string | ((record: TRecord) => string | number)
  children: (record: TRecord) => readonly TRecord[]
  treeColumn: string
} & TreeExpansionOptions

export type TreeTableProps<TRecord extends object = Record<string, unknown>, TQuery extends object = Record<string, unknown>, TContext extends object = Readonly<Record<string, unknown>>> = Omit<TableOptions<TRecord, TQuery, TContext>, 'reorderable' | 'rowKey'> &
  CollectionSource<TRecord, TQuery> &
  TreePresentationOptions<TRecord>

export interface TableContentProps<TRecord extends object = Record<string, unknown>, TQuery extends object = Record<string, unknown>, TContext extends object = Readonly<Record<string, unknown>>> extends Omit<TableOptions<TRecord, TQuery, TContext>, 'query'> {
  records: TRecord[]
  meta?: CollectionMeta
  /** Query-specific auxiliary data returned with the cached collection. */
  resultContext?: unknown
  loading: boolean
  error?: SubmitError
  empty: boolean
  query: TQuery
  /** Collection refresh action exposed to a ready custom collection slot. */
  refresh?: () => Promise<void>
  /** Collection query action exposed to a ready custom collection slot. */
  updateQuery?: (patch: QueryValues) => void
}

export type TreeTableContentProps<TRecord extends object = Record<string, unknown>, TQuery extends object = Record<string, unknown>, TContext extends object = Readonly<Record<string, unknown>>> = Omit<
  TableContentProps<TRecord, TQuery, TContext>,
  'reorderable' | 'rowKey'
> &
  TreePresentationOptions<TRecord>

export interface RowReorderPayload<TRecord extends object = Record<string, unknown>> {
  rows: TRecord[]
  oldIndex: number
  newIndex: number
  moved: TRecord
  query: QueryValues
}

interface DetailOptions<TRecord extends object, TContext extends object> extends DetailDefinition<TRecord, Readonly<Record<string, DetailFieldEntry<TRecord, TContext>>>, TContext> {
  id?: RecordIdentity
  searchParameters?: Record<string, unknown>
  resource?: string
  /** View identity below the resource and record cache owner. */
  namespace?: QueryNamespace
}

type DetailSource<TRecord extends object> = { data: TRecord; load?: never } | { load: Load<RecordLoadContext, RecordResult<TRecord>>; data?: never }

export type DetailProps<TRecord extends object = Record<string, unknown>, TContext extends object = Readonly<Record<string, unknown>>> = DetailOptions<TRecord, TContext> & DetailSource<TRecord>
