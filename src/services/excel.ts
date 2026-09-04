import * as XLSX from 'xlsx'
import { parse } from '@southneuhof/utilities/parse'
import type { CollectionResult, MaybePromise } from '../contracts'
import type { ResolvedSurfaceField } from '../fields/resolve'

export interface ListExportOptions<TRecord extends object = Record<string, unknown>, TQuery extends object = Record<string, unknown>> {
  load?: (context: { query: TQuery; searchParameters: Record<string, unknown>; signal?: AbortSignal }) => MaybePromise<TRecord[] | CollectionResult<TRecord>>
  filename?: string | ((context: { query: TQuery }) => string)
  sheetName?: string
  pageSize?: number
  mapValue?: (context: { record: TRecord; field: ResolvedSurfaceField; value: unknown }) => unknown
}

function valueFor(record: Record<string, unknown>, field: ResolvedSurfaceField, mapValue?: ListExportOptions['mapValue']) {
  const value = field.read ? field.read(record, {}) : record[field.key]
  const mapped = mapValue ? mapValue({ record, field, value }) : field.format ? parse(field.format, value) : value
  if (mapped == null) return ''
  if (mapped instanceof Date || typeof mapped === 'string' || typeof mapped === 'number' || typeof mapped === 'boolean') return mapped
  return JSON.stringify(mapped)
}

export function createWorkbook(rows: Record<string, unknown>[], fields: ResolvedSurfaceField[], options: Pick<ListExportOptions, 'sheetName' | 'mapValue'> = {}) {
  const matrix = [fields.map((field) => field.label ?? field.key), ...rows.map((record) => fields.map((field) => valueFor(record, field, options.mapValue)))]
  const sheet = XLSX.utils.aoa_to_sheet(matrix)
  sheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(0, matrix.length - 1), c: Math.max(0, fields.length - 1) } }) }
  sheet['!freeze'] = { xSplit: 0, ySplit: 1 }
  sheet['!cols'] = fields.map((field, index) => ({ wch: Math.min(40, Math.max(10, String(matrix[0][index]).length + 2)) }))
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, (options.sheetName ?? 'Data').slice(0, 31))
  return workbook
}

export function downloadWorkbook(workbook: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(workbook, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`)
}
