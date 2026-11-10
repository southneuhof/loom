import type { ExportCell, ExportDocument } from '@southneuhof/spool'
import type { ResolvedExportField } from './resolveExportFields'
import { displayFieldForRecord, formatDisplayValue, readDisplayValue } from '../display/resolveDisplay'

export interface ExportEntry<TRecord extends object, TContext extends object> {
  record: TRecord
  field: ResolvedExportField<TRecord, TContext>
  value: unknown
  rawValue: unknown
  mapped: boolean
  context: TContext
}
export interface ViewExportSnapshot<TRecord extends object = object, TContext extends object = object> {
  document: ExportDocument
  entries: readonly (readonly ExportEntry<TRecord, TContext>[])[]
  rows: readonly TRecord[]
  record?: TRecord
  context: TContext
  config: object
}
function cell<TRecord extends object, TContext extends object>(entry: ExportEntry<TRecord, TContext>): ExportCell {
  const value = entry.field.format && !entry.field.xlsx ? entry.value : entry.rawValue
  const presentation = { numberFormat: entry.field.xlsx?.numberFormat, hyperlink: entry.field.xlsx?.hyperlink, class: entry.field.class, align: entry.field.align }
  const xlsx = entry.field.xlsx
  if (xlsx) {
    const typedValue = typeof xlsx.value === 'function' ? xlsx.value({ record: entry.record, context: entry.context, value }) : xlsx.value
    if (typedValue !== undefined) return { ...presentation, value: typedValue, numberFormat: xlsx.numberFormat, hyperlink: xlsx.hyperlink }
    if (entry.field.renderer) return { ...presentation, numberFormat: xlsx.numberFormat, hyperlink: xlsx.hyperlink }
  }
  if (entry.mapped) return { ...presentation, value: entry.value instanceof Date || typeof entry.value === 'string' || typeof entry.value === 'number' || typeof entry.value === 'boolean' ? entry.value : null }
  if (entry.field.renderer) return presentation
  if (value === null || value === undefined) return { ...presentation, value: null }
  if (value instanceof Date || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return { ...presentation, value, text: String(entry.value ?? '') }
  return { ...presentation, value: JSON.stringify(value) }
}
export function createExportSnapshot<TRecord extends object, TContext extends object>(options: {
  kind: 'table' | 'fields'
  title?: string
  sheetName?: string
  mapValue?: (scope: { record: TRecord; field: ResolvedExportField<TRecord, TContext>; value: unknown }) => unknown
  rows: readonly TRecord[]
  fields: (record?: TRecord) => readonly ResolvedExportField<TRecord, TContext>[]
  context: TContext
  config: object
}): ViewExportSnapshot<TRecord, TContext> {
  const entries = options.rows.map(record => options.fields(record).map(field => {
    const resolved = displayFieldForRecord(record, field, options.context)
    const sourceValue = readDisplayValue(record, resolved, options.context)
    const rawValue = options.mapValue ? options.mapValue({ record, field: resolved, value: sourceValue }) : sourceValue
    return { record, mapped: Boolean(options.mapValue), field: resolved, context: options.context, rawValue, value: options.mapValue ? (rawValue == null ? '' : typeof rawValue === 'object' && !(rawValue instanceof Date) ? JSON.stringify(rawValue) : rawValue) : formatDisplayValue(rawValue, resolved) }
  }))
  const document: ExportDocument = options.kind === 'table'
    ? { kind: 'table', title: options.title, sheetName: options.sheetName, columns: options.fields().map(field => ({ id: field.key, label: field.label, class: field.headerClass })), rows: entries.map(row => ({ cells: Object.fromEntries(row.map(entry => [entry.field.key, cell(entry)])) })) }
    : { kind: 'fields', title: options.title, sheetName: options.sheetName, fields: (entries[0] ?? []).map(entry => ({ id: entry.field.key, label: entry.field.label, ...cell(entry) })) }
  return { document, entries, rows: options.rows, record: options.kind === 'fields' ? options.rows[0] : undefined, context: options.context, config: options.config }
}
