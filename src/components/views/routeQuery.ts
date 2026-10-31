import type { LocationQuery, RouteLocationRaw, Router } from 'vue-router'
import type { RouteTarget } from '../../contracts/views'

export function withCurrentQuery(target: RouteTarget, currentQuery: LocationQuery, router: Router): RouteTarget {
  if (Object.keys(currentQuery).length === 0) return target

  if (typeof target !== 'string') {
    return {
      ...target,
      query: { ...currentQuery, ...(target.query ?? {}) },
    }
  }

  const resolved = router.resolve(target as RouteLocationRaw)
  return {
    path: resolved.path,
    query: { ...currentQuery, ...resolved.query },
    hash: resolved.hash,
  }
}
