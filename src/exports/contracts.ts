import type { CollectionLoadContext, CollectionResult, MaybePromise } from '../contracts'
import type { ResolvedDisplayField } from '../display/resolveDisplay'
import type { Component } from 'vue'
import type { ExportStyles, XlsxValue, PageOrientation } from '@southneuhof/spool'
import type { TableColumn, TableColumnContext } from '../contracts/tables'
import type { DetailField, DetailFieldContext } from '../contracts/details'
import type { DetailProps, TableProps } from '../contracts/components'
import type { DetailViewProps, ListViewProps } from '../contracts/views'

export type ExportFormat = 'xlsx' | 'pdf'
export interface ExportOptions {
  component?: Component
  formats?: readonly ExportFormat[]
  filename?: string
  styles?: ExportStyles
  orientation?: PageOrientation
}
export interface ExportValueConfiguration<TRecord extends object, TContext extends object> {
  value?: XlsxValue | ((scope: { record: TRecord; context: TContext; value: unknown }) => XlsxValue)
  numberFormat?: string
  hyperlink?: string
}
export type ExportTableColumnEntry<TRecord extends object, TContext extends object> =
  | (TableColumn<TRecord, unknown, TContext> & { xlsx?: ExportValueConfiguration<TRecord, TContext> })
  | ((scope: TableColumnContext<TContext>) => TableColumn<TRecord, unknown, TContext> & { xlsx?: ExportValueConfiguration<TRecord, TContext> })
export type ExportDetailFieldEntry<TRecord extends object, TContext extends object> =
  | (DetailField<TRecord> & { xlsx?: ExportValueConfiguration<TRecord, TContext> })
  | ((scope: DetailFieldContext<TRecord, TContext>) => DetailField<TRecord> & { xlsx?: ExportValueConfiguration<TRecord, TContext> })
export type ListExportConfiguration<TRecord extends object = Record<string, unknown>, TQuery extends object = Record<string, unknown>, TContext extends object = Readonly<Record<string, unknown>>> = Omit<ExportOptions, 'filename'> & Partial<Omit<ListViewProps<TRecord, TQuery, Partial<TQuery>, TContext>, 'export' | 'table'>> & {
  filename?: string | ((context: { query: TQuery }) => string)
  sheetName?: string
  pageSize?: number
  load?: (context: CollectionLoadContext<TQuery>) => MaybePromise<TRecord[] | CollectionResult<TRecord>>
  mapValue?: (scope: { record: TRecord; field: ResolvedDisplayField<TRecord, TContext>; value: unknown }) => unknown
  table?: Omit<Partial<TableProps<TRecord, TQuery, TContext>>, 'columns'> & { columns?: Readonly<Record<string, ExportTableColumnEntry<TRecord, TContext>>> }
}
export type DetailExportConfiguration<TRecord extends object = Record<string, unknown>, TContext extends object = Readonly<Record<string, unknown>>> = Omit<ExportOptions, 'formats'> & { formats?: readonly 'pdf'[] } & Partial<Omit<DetailViewProps<TRecord, TContext>, 'export' | 'detail'>> & {
  detail?: Omit<Partial<DetailProps<TRecord, TContext>>, 'fields'> & { fields?: Readonly<Record<string, ExportDetailFieldEntry<TRecord, TContext>>> }
}
export interface ExportControls {
  readonly available: boolean
  readonly disabled: boolean
  readonly pending: boolean
  readonly error: Error | undefined
  readonly formats: readonly ExportFormat[]
  openPreview(): Promise<void>
  printPdf(): Promise<void>
  downloadXlsx(): Promise<void>
}
