import type { CollectionLoadContext, CollectionResult, MaybePromise } from '../contracts'
import type { ResolvedDisplayField } from '../display/resolveDisplay'
import { createWorkbook, downloadWorkbook, type ListExportOptions } from './excel'

export interface ExportRequest<TRecord extends object, TQuery extends object> {
  activeQuery: TQuery
  searchParameters: Record<string, unknown>
  data?: readonly TRecord[]
  load?: (context: CollectionLoadContext<TQuery>) => MaybePromise<CollectionResult<TRecord>>
  columns: readonly ResolvedDisplayField<TRecord>[]
  options?: ListExportOptions<TRecord, TQuery>
  fallbackNamespace?: string
}

const MAX_EXPORT_PAGES = 10_000
const DEFAULT_EXPORT_PAGE_SIZE = 500

async function collectRows<TRecord extends object, TQuery extends object>(
  request: ExportRequest<TRecord, TQuery>,
): Promise<TRecord[]> {
  const { options = {}, activeQuery, searchParameters } = request
  if (options.load) {
    const result = await options.load({ query: activeQuery, searchParameters })
    return Array.isArray(result) ? [...result] : [...result.data]
  }
  if (request.data !== undefined) return [...request.data]
  if (!request.load) return []
  const pageSize = Number.isInteger(options.pageSize) && options.pageSize! > 0 ? options.pageSize! : DEFAULT_EXPORT_PAGE_SIZE
  const rows: TRecord[] = []
  let page = 1
  let complete = false
  const seen = new Set<string>()
  while (page <= MAX_EXPORT_PAGES) {
    const result = await request.load({
      query: { ...activeQuery, page, limit: pageSize } as TQuery,
      searchParameters,
    })
    const batch = result.data
    const signature = JSON.stringify(batch)
    if (seen.has(signature)) throw new Error('[loom] Export loader repeated a page.')
    seen.add(signature)
    rows.push(...batch)
    const meta = result.meta
    if (meta?.totalPage != null) {
      if (meta.totalPage < 0 || page >= meta.totalPage) {
        complete = true
        break
      }
    } else if (meta?.total != null) {
      if (meta.total < 0 || rows.length >= meta.total) {
        complete = true
        break
      }
    } else if (batch.length < pageSize) {
      complete = true
      break
    }
    page += 1
  }
  if (!complete) throw new Error('[loom] Export stopped at the page safety limit.')
  return rows
}

export async function exportTableRows<TRecord extends object, TQuery extends object>(
  request: ExportRequest<TRecord, TQuery>,
): Promise<void> {
  const { options = {} } = request
  const rows = await collectRows(request)
  if (!request.columns.length) throw new Error('[loom] Export requires one visible column.')
  const workbook = createWorkbook(rows, request.columns, options)
  const fallback = `${request.fallbackNamespace ?? 'export'}-${Date.now()}`.replace(/[^a-zA-Z0-9._-]/g, '-')
  const filename = typeof options.filename === 'function' ? options.filename({ query: request.activeQuery }) : (options.filename ?? fallback)
  downloadWorkbook(workbook, filename)
}
