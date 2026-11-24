import type { App } from 'vue'
import { isCancelledError, type QueryClient } from '@tanstack/vue-query'
import { toast } from 'vue-sonner'
import type { RecordIdentity } from '../contracts/load'
import type { SubmitError } from '../contracts/results'
import { selectResourceQueries } from './client'

export const readFailureFeedbackMetaKey = 'loomReadFailureFeedback'

export interface ReadFailureFeedbackMeta {
  normalizeError: (error: unknown) => SubmitError
}

interface FeedbackOwner {
  appCount: number
  unsubscribe?: () => void
  suppressedQueries: Map<object, number>
}

const owners = new WeakMap<QueryClient, FeedbackOwner>()

function ownerFor(client: QueryClient): FeedbackOwner {
  const existing = owners.get(client)
  if (existing) return existing
  const owner: FeedbackOwner = { appCount: 0, suppressedQueries: new Map() }
  owners.set(client, owner)
  return owner
}

function readFeedbackMeta(value: unknown): ReadFailureFeedbackMeta | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const normalizeError = Reflect.get(value, 'normalizeError')
  return typeof normalizeError === 'function' ? { normalizeError } : undefined
}

function startOwner(client: QueryClient, owner: FeedbackOwner): void {
  if (owner.unsubscribe) return
  owner.unsubscribe = client.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated' || event.action.type !== 'error') return
    if (isCancelledError(event.action.error) || !event.query.isActive() || event.query.isStatic()) return
    if (owner.suppressedQueries.has(event.query)) return
    const meta = readFeedbackMeta(event.query.meta?.[readFailureFeedbackMetaKey])
    if (!meta) return
    toast.error(meta.normalizeError(event.action.error).message)
  })
}

export function installReadFailureFeedback(app: App, client: QueryClient): void {
  const owner = ownerFor(client)
  owner.appCount += 1
  startOwner(client, owner)
  let active = true
  app.onUnmount(() => {
    if (!active) return
    active = false
    owner.appCount -= 1
    if (owner.appCount !== 0) return
    owner.unsubscribe?.()
    owners.delete(client)
  })
}

export async function withWriteRefreshFeedbackSuppressed<TResult>(
  client: QueryClient,
  resource: string,
  id: RecordIdentity | undefined,
  operation: () => Promise<TResult>,
): Promise<TResult> {
  const owner = ownerFor(client)
  const queries = selectResourceQueries(client, resource, id).queries
    .filter((query) => query.isActive() && !query.isStatic())
  for (const query of queries) owner.suppressedQueries.set(query, (owner.suppressedQueries.get(query) ?? 0) + 1)
  try {
    return await operation()
  } finally {
    for (const query of queries) {
      const count = owner.suppressedQueries.get(query) ?? 0
      if (count <= 1) owner.suppressedQueries.delete(query)
      else owner.suppressedQueries.set(query, count - 1)
    }
  }
}
