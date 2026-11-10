import { resolveDisplayFields, type ResolvedDisplayField } from '../display/resolveDisplay'
import type { TableColumnEntry } from '../contracts/tables'
import type { DetailFieldEntry } from '../contracts/details'
import type { LabelDictionary } from '../contracts'
import type { ExportValueConfiguration } from './contracts'

export interface ResolvedExportField<TRecord extends object, TContext extends object> extends ResolvedDisplayField<TRecord, TContext> {
  xlsx?: ExportValueConfiguration<TRecord, TContext>
}
export function resolveExportFields<TRecord extends object, TContext extends object>(options: {
  surface: 'table' | 'detail'
  entries: Readonly<Record<string, unknown>>
  labels?: LabelDictionary
  context: TContext
  record?: TRecord
}): readonly ResolvedExportField<TRecord, TContext>[] {
  const metadata = new Map<string, ExportValueConfiguration<TRecord, TContext>>()
  const entries = Object.fromEntries(Object.entries(options.entries).map(([key, configured]) => {
    const entry: unknown = typeof configured === 'function' ? configured({ context: options.context, record: options.record }) : configured
    if (!entry || typeof entry !== 'object') return [key, entry]
    const { xlsx, ...display } = entry as Record<string, unknown>
    if (xlsx !== undefined) {
      if (!xlsx || typeof xlsx !== 'object' || Array.isArray(xlsx)) throw new Error(`[loom] Export field "${key}" xlsx must be an object.`)
      metadata.set(key, xlsx as ExportValueConfiguration<TRecord, TContext>)
    }
    return [key, display]
  }))
  const resolved = options.surface === 'table'
    ? resolveDisplayFields<TRecord, TContext>({ ...options, surface: 'table', entries: entries as Readonly<Record<string, TableColumnEntry<TRecord, TContext>>> })
    : resolveDisplayFields<TRecord, TContext>({ ...options, surface: 'detail', record: options.record!, entries: entries as Readonly<Record<string, DetailFieldEntry<TRecord, TContext>>> })
  return resolved.map(field => ({ ...field, xlsx: metadata.get(field.key) }))
}
