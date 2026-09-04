import type { CollectionResult } from '../contracts'
import type { ResolvedSurfaceField } from '../fields/resolve'
import { createWorkbook, downloadWorkbook, type ListExportOptions } from './excel'

export interface ExportRequest<TRecord extends object, TQuery extends object> {
  /** Query without paging keys; the export loop pages internally. */
  activeQuery: TQuery
  searchParameters: Record<string, unknown>
  data?: readonly TRecord[]
  /** Table loader; always collection-shaped. Paging is applied here. */
  load?: (context: { query: Record<string, unknown>; searchParameters: Record<string, unknown> }) => Promise<CollectionResult<TRecord>>
  fields: ResolvedSurfaceField[]
  options?: ListExportOptions<TRecord, TQuery>
  fallbackNamespace?: string
}

const MAX_EXPORT_PAGES = 10_000
const DEFAULT_EXPORT_PAGE_SIZE = 500

/** Fetches every row through one of `options.load`, static `data`, or paged `load`. */
async function collectRows<TRecord extends object, TQuery extends object>(
  request: ExportRequest<TRecord, TQuery>,
): Promise<TRecord[]> {
  const { options = {}, activeQuery, searchParameters } = request
  if (options.load) {
    const result = await options.load({ query: activeQuery, searchParameters })
    return (Array.isArray(result) ? result : (result as CollectionResult<TRecord>).data) as TRecord[]
  }
  if (request.data) return [...request.data]
  if (!request.load) return []
  const pageSize = Number.isInteger(options.pageSize) && options.pageSize! > 0 ? options.pageSize! : DEFAULT_EXPORT_PAGE_SIZE
  const rows: TRecord[] = []
  let page = 1
  const seen = new Set<string>()
  while (page <= MAX_EXPORT_PAGES) {
    const result = await request.load({
      query: { ...activeQuery, page, limit: pageSize },
      searchParameters,
    })
    const batch = result.data ?? []
    const signature = JSON.stringify(batch.map((row) => row))
    if (seen.has(signature)) throw new Error('[loom] Export loader repeated a page.')
    seen.add(signature)
    rows.push(...(batch as TRecord[]))
    const meta = result.meta
    if (meta?.totalPage != null) {
      if (meta.totalPage < 0 || page >= meta.totalPage) break
    } else if (meta?.total != null) {
      if (meta.total < 0 || rows.length >= meta.total) break
    } else if (batch.length < pageSize) break
    page += 1
  }
  return rows
}

/**
 * Builds the visible-column workbook and triggers the browser download.
 * Throws on any failure so the owning view can surface it.
 */
export async function exportTableRows<TRecord extends object, TQuery extends object>(
  request: ExportRequest<TRecord, TQuery>,
): Promise<void> {
  const { options = {} } = request
  const rows = await collectRows(request)
  const fields = request.fields
  if (!fields.length) throw new Error('[loom] Export requires one visible column.')
  const workbook = createWorkbook(
    rows as Record<string, unknown>[],
    fields,
    options as Pick<ListExportOptions, 'sheetName' | 'mapValue'>,
  )
  const fallback = `${request.fallbackNamespace ?? 'export'}-${Date.now()}`.replace(/[^a-zA-Z0-9._-]/g, '-')
  const filename = typeof options.filename === 'function' ? options.filename({ query: request.activeQuery }) : (options.filename ?? fallback)
  downloadWorkbook(workbook, filename)
}
