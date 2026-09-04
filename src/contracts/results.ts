/**
 * Normalized results reaching core components. Backend envelopes and `Response`
 * objects are normalized by project adapters before they get here.
 */

/** Collection metadata, kept separate from the rows themselves. */
export interface CollectionMeta {
  total?: number
  totalPage?: number
  page?: number
  pageSize?: number
}

export interface CollectionResult<TRecord extends object = Record<string, unknown>> {
  data: TRecord[]
  meta?: CollectionMeta
}

export type RecordResult<TRecord extends object = Record<string, unknown>> = TRecord | undefined
