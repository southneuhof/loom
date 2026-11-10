import type { RawSchema } from '../contracts/schema'
import { createSchemaRuntime } from '../schemas/schemaRuntime'
import type { SourceGuard } from '../resources/sourceGuard'
import type { CollectionLoadContext, CollectionResult, MaybePromise } from '../contracts'

export interface ExportCollection<TRecord extends object, TQuery extends object> {
  sourceGuard?: SourceGuard<TRecord, CollectionLoadContext<TQuery>>
  data?: readonly TRecord[]
  load?: (context: CollectionLoadContext<TQuery>) => MaybePromise<CollectionResult<TRecord>>
  query: TQuery
  searchParameters?: Record<string, unknown>
  signal?: AbortSignal
  pageSize?: number
  querySchema?: RawSchema<object, TQuery>
}

export async function collectExportRows<TRecord extends object, TQuery extends object>(source: ExportCollection<TRecord, TQuery>): Promise<TRecord[]> {
  source.signal?.throwIfAborted()
  if (source.data !== undefined) {
    source.sourceGuard?.beforeLoad({ query: source.query, searchParameters: source.searchParameters ?? {}, signal: source.signal })
    for (const record of source.data) source.sourceGuard?.record(record)
    return [...source.data]
  }
  if (!source.load) throw new Error('[loom] Export has no collection source.')
  const query = Object.fromEntries(Object.entries(source.query))
  delete query.page
  delete query.limit
  const currentLimit: unknown = Reflect.get(source.query, 'limit')
  if (source.pageSize !== undefined && (!Number.isInteger(source.pageSize) || source.pageSize <= 0)) throw new Error('[loom] Export pageSize must be a positive integer.')
  const limit = source.pageSize ?? (typeof currentLimit === 'number' && Number.isInteger(currentLimit) && currentLimit > 0 ? currentLimit : 500)
  const rows: TRecord[] = []
  const seen = new Set<string>()
  for (let page = 1; page <= 10_000; page++) {
    source.signal?.throwIfAborted()
    let pageQuery = { ...query, page, limit } as TQuery
    if (source.querySchema) {
      const parsed = await createSchemaRuntime(source.querySchema).parseAsync(pageQuery)
      if (!parsed.success) throw new Error('[loom] Export query does not match querySchema.')
      pageQuery = { page, limit, ...parsed.data } as TQuery
    }
    const context = { query: pageQuery, searchParameters: source.searchParameters ?? {}, signal: source.signal }
    source.sourceGuard?.beforeLoad(context)
    const result = await source.load(context)
    source.signal?.throwIfAborted()
    const batch = result.data
    for (const record of batch) source.sourceGuard?.record(record)
    if (!batch.length) {
      if ((result.meta?.total !== undefined && rows.length < result.meta.total) || (result.meta?.totalPage !== undefined && page < result.meta.totalPage)) throw new Error('[loom] Export collection is incomplete.')
      return rows
    }
    const signature = JSON.stringify(batch)
    if (seen.has(signature)) throw new Error('[loom] Export loader repeated a page.')
    seen.add(signature)
    rows.push(...batch)
    if (result.meta?.totalPage !== undefined && page >= result.meta.totalPage) {
      if (result.meta.total !== undefined && rows.length < result.meta.total) throw new Error('[loom] Export collection is incomplete.')
      return rows
    }
    if (result.meta?.total !== undefined && rows.length >= result.meta.total) return rows
    if (result.meta?.totalPage === undefined && result.meta?.total === undefined && batch.length < limit) return rows
  }
  throw new Error('[loom] Export stopped at the page safety limit.')
}
