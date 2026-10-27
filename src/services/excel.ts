import * as XLSX from 'xlsx'
import type { CollectionResult, MaybePromise } from '../contracts'
import { displayFieldForRecord, formatDisplayValue, readDisplayValue, type ResolvedDisplayField } from '../display/resolveDisplay'

export interface ListExportOptions<TRecord extends object = Record<string, unknown>, TQuery extends object = Record<string, unknown>, TContext extends object = {}> {
  load?: (context: { query: TQuery; searchParameters: Record<string, unknown>; signal?: AbortSignal }) => MaybePromise<TRecord[] | CollectionResult<TRecord>>
  filename?: string | ((context: { query: TQuery }) => string)
  sheetName?: string
  pageSize?: number
  mapValue?: (context: { record: TRecord; field: ResolvedDisplayField<TRecord, TContext>; value: unknown }) => unknown
}

function valueFor<TRecord extends object, TContext extends object>(
  record: TRecord,
  field: ResolvedDisplayField<TRecord, TContext>,
  context: TContext,
  mapValue?: ListExportOptions<TRecord, Record<string, unknown>, TContext>['mapValue']
) {
  const displayField = displayFieldForRecord(record, field, context)
  const value = readDisplayValue(record, displayField, context)
  const mapped = mapValue ? mapValue({ record, field: displayField, value }) : formatDisplayValue(value, displayField)
  if (mapped == null) return ''
  if (mapped instanceof Date || typeof mapped === 'string' || typeof mapped === 'number' || typeof mapped === 'boolean') return mapped
  return JSON.stringify(mapped)
}

export function createWorkbook<TRecord extends object, TQuery extends object = Record<string, unknown>, TContext extends object = {}>(
  rows: readonly TRecord[],
  columns: readonly ResolvedDisplayField<TRecord, TContext>[],
  options: Pick<ListExportOptions<TRecord, TQuery, TContext>, 'sheetName' | 'mapValue'> = {},
  context: TContext = {} as TContext
) {
  const matrix = [columns.map((column) => column.label), ...rows.map((record) => columns.map((column) => valueFor(record, column, context, options.mapValue)))]
  const sheet = XLSX.utils.aoa_to_sheet(matrix)
  sheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(0, matrix.length - 1), c: Math.max(0, columns.length - 1) } }) }
  sheet['!freeze'] = { xSplit: 0, ySplit: 1 }
  sheet['!cols'] = columns.map((column, index) => ({ wch: Math.min(40, Math.max(10, String(matrix[0][index]).length + 2)) }))
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, (options.sheetName ?? 'Data').slice(0, 31))
  return workbook
}

export function downloadWorkbook(workbook: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(workbook, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`)
}
