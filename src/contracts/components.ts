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
import type { DetailDefinition } from './details'
import type { TableDefinition } from './tables'
import type { SubmitError } from './results'

interface CollectionOptions<TQuery extends object> {
  meta?: CollectionMeta
  searchParameters?: Record<string, unknown>
  resource?: string
  namespace?: QueryNamespace
  query?: TQuery
  pagination?: 'auto' | 'always' | false
  pageSizeOptions?: readonly number[]
  defaultPageSize?: number
  reorderable?: boolean
}

type CollectionSource<
  TRecord extends object = Record<string, unknown>,
  TQuery extends object = Record<string, unknown>,
> =
  | { data: TRecord[]; load?: never }
  | { load: Load<CollectionLoadContext<TQuery>, CollectionResult<TRecord>>; data?: never }

export type CollectionProps<
  TRecord extends object = Record<string, unknown>,
  TQuery extends object = Record<string, unknown>,
> = CollectionOptions<TQuery> & CollectionSource<TRecord, TQuery>

export interface CollectionSlotProps<
  TRecord extends object = Record<string, unknown>,
  TQuery extends object = Record<string, unknown>,
> {
  records: TRecord[]
  meta?: CollectionMeta
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
> extends CollectionOptions<TQuery>, TableDefinition<TRecord> {
  querySchema?: RawSchema<object, TQuery>
  /** Minimum resizable width in pixels. */
  minColumnWidth?: number
  /** Controlled visible data-column keys. */
  visibleColumns?: readonly string[]
  /** Controlled data-column widths in pixels. */
  columnSizing?: Readonly<Record<string, number>>
  rowKey?: string | ((record: TRecord) => string | number)
}

export type TableProps<
  TRecord extends object = Record<string, unknown>,
  TQuery extends object = Record<string, unknown>,
> = TableOptions<TRecord, TQuery> & CollectionSource<TRecord, TQuery>

export type TreeTableProps<
  TRecord extends object = Record<string, unknown>,
  TQuery extends object = Record<string, unknown>,
> = Omit<TableOptions<TRecord, TQuery>, 'reorderable'> & CollectionSource<TRecord, TQuery> & {
  children: (record: TRecord) => readonly TRecord[]
  treeColumn: string
}

export interface TableContentProps<
  TRecord extends object = Record<string, unknown>,
  TQuery extends object = Record<string, unknown>,
> extends Omit<TableOptions<TRecord, TQuery>, 'query'> {
  records: TRecord[]
  meta?: CollectionMeta
  loading: boolean
  error?: SubmitError
  empty: boolean
  query: TQuery
  /** Collection refresh action exposed to a ready custom collection slot. */
  refresh?: () => Promise<void>
  /** Collection query action exposed to a ready custom collection slot. */
  updateQuery?: (patch: QueryValues) => void
}

export interface RowReorderPayload<TRecord extends object = Record<string, unknown>> {
  rows: TRecord[]
  oldIndex: number
  newIndex: number
  moved: TRecord
  query: QueryValues
}

interface DetailOptions<TRecord extends object> extends DetailDefinition<TRecord> {
  id?: RecordIdentity
  searchParameters?: Record<string, unknown>
  resource?: string
  /** View identity below the resource and record cache owner. */
  namespace?: QueryNamespace
}

type DetailSource<TRecord extends object> =
  | { data: TRecord; load?: never }
  | { load: Load<RecordLoadContext, RecordResult<TRecord>>; data?: never }

export type DetailProps<TRecord extends object = Record<string, unknown>> = DetailOptions<TRecord> & DetailSource<TRecord>
