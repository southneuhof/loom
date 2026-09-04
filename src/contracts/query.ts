/**
 * Query state and query runtime contracts.
 *
 * Each table owns an independent query under a URL namespace. Core components
 * never import the router: URL reading and writing arrive through the location
 * adapter. Caching, deduplication, cancellation, and invalidation stay internal
 * to the framework's TanStack Query runtime — public APIs expose `load`,
 * `submit`, and namespaces, never query keys or options.
 */

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
