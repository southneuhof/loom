/** URL prefix distinguishing one table's query from its siblings. */
export type QueryNamespace = string

export type QueryValues = Record<string, unknown>

export interface QueryLocationAdapter {
  read: (namespace: QueryNamespace) => QueryValues
  write: (namespace: QueryNamespace, values: QueryValues) => void
  watch: (namespace: QueryNamespace, onChange: (values: QueryValues) => void) => () => void
}

/** Internal cache identity. Never authored by application developers. */
export type QueryKey = readonly unknown[]
