export {
  resourceKeyPrefix,
  stableValue,
  resourceKey,
  collectionKey,
  recordKey,
  isSameKey,
} from './keys'
export type { CollectionKeyInput, RecordKeyInput } from './keys'

export {
  frameworkQueryClientKey,
  createFrameworkQueryClient,
  useFrameworkQueryClient,
  invalidateResourceData,
} from './client'
export type { ResourceInvalidation } from './client'

export { namespaceFromResourceKey, coerceQueryValues, useNamespacedQuery } from './namespace'
export type { NamespacedQuery, NamespacedQueryOptions } from './namespace'

export { useLoader } from './loader'
export type { LoaderOptions, LoaderState } from './loader'
export {
  beginPageReadiness,
  markPageNavigationSettled,
  registerPageLoader,
  setPageReadinessError,
} from './readiness'
export type { PageReadinessState } from './readiness'
