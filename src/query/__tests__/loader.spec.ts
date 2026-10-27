import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import { useLoader } from '../loader'
import { collectionKey, recordKey } from '../keys'
import { createFrameworkQueryClient, invalidateResourceData } from '../client'
import { withWriteRefreshFeedbackSuppressed } from '../feedback'
import { recordCacheKey } from '../../components/core/useCoreData'
import type { CollectionLoadContext, CollectionResult, RecordLoadContext } from '../../contracts'
import { deferred, flush, withApp } from './harness'

afterEach(() => vi.restoreAllMocks())

interface Role extends Record<string, unknown> {
  id: number
  name: string
}

const context = { query: {}, searchParameters: {} }

describe('internal loader', () => {
  it('accepts synchronous, offline values through the same contract', async () => {
    const { result, app } = withApp(() =>
      useLoader<CollectionLoadContext, CollectionResult<Role>>({
        key: collectionKey({ resource: 'roles' }),
        context,
        load: () => ({ data: [{ id: 1, name: 'Admin' }] }),
      }),
    )
    await flush()

    expect(result.data.value?.data).toEqual([{ id: 1, name: 'Admin' }])
    app.unmount()
  })

  it('deduplicates loads that share a key even when the closure differs', async () => {
    const load = vi.fn(async () => ({ data: [{ id: 1, name: 'Admin' }] }))
    const queryClient = createFrameworkQueryClient()

    const { app } = withApp(
      () => ({
        first: useLoader<CollectionLoadContext, CollectionResult<Role>>({
          key: collectionKey({ resource: 'roles', query: { page: 1 } }),
          context,
          load: (loadContext) => load(loadContext),
        }),
        second: useLoader<CollectionLoadContext, CollectionResult<Role>>({
          key: collectionKey({ resource: 'roles', query: { page: 1 } }),
          context,
          load: (loadContext) => load(loadContext),
        }),
      }),
      { queryClient },
    )
    await flush(8)

    expect(load).toHaveBeenCalledTimes(1)
    app.unmount()
  })

  it('separates caches for different keys', async () => {
    const load = vi.fn(async ({ query }: CollectionLoadContext) => ({ data: [{ id: Number(query.page), name: 'Role' }] }))
    const queryClient = createFrameworkQueryClient()

    const { app } = withApp(
      () => ({
        first: useLoader<CollectionLoadContext, CollectionResult<Role>>({
          key: collectionKey({ resource: 'roles', query: { page: 1 } }),
          context: { query: { page: 1 }, searchParameters: {} },
          load,
        }),
        second: useLoader<CollectionLoadContext, CollectionResult<Role>>({
          key: collectionKey({ resource: 'roles', query: { page: 2 } }),
          context: { query: { page: 2 }, searchParameters: {} },
          load,
        }),
      }),
      { queryClient },
    )
    await flush(8)

    expect(load).toHaveBeenCalledTimes(2)
    app.unmount()
  })

  it('forwards an abort signal and cancels when the key changes', async () => {
    const page = ref(1)
    const pending = deferred<CollectionResult<Role>>()
    const signals: (AbortSignal | undefined)[] = []
    const toastError = vi.spyOn(toast, 'error').mockImplementation(() => '')
    const queryClient = createFrameworkQueryClient()

    const { result, app } = withApp(
      () =>
        useLoader<CollectionLoadContext, CollectionResult<Role>>({
          key: computed(() => collectionKey({ resource: 'roles', query: { page: page.value } })),
          context: computed(() => ({ query: { page: page.value }, searchParameters: {} })),
          load: ({ signal }) => {
            signals.push(signal)
            return page.value === 1 ? pending.promise : Promise.resolve({ data: [] })
          },
        }),
      { queryClient },
    )
    await flush(6)

    expect(signals[0]).toBeInstanceOf(AbortSignal)
    expect(signals[0]?.aborted).toBe(false)

    page.value = 2
    await flush(6)

    expect(signals[0]?.aborted).toBe(true)
    pending.reject(new Error('The old page failed.'))
    await flush(8)
    expect(result.data.value?.data).toEqual([])
    expect(result.error.value).toBeUndefined()
    expect(toastError).not.toHaveBeenCalled()
    app.unmount()
  })

  it('keeps a shared read relevant to the observer that still owns its key', async () => {
    const page = ref(1)
    const pending = deferred<CollectionResult<Role>>()
    const toastError = vi.spyOn(toast, 'error').mockImplementation(() => '')
    const queryClient = createFrameworkQueryClient({ retry: 0 })
    const load = vi.fn(({ query }: CollectionLoadContext) => query.page === 1
      ? pending.promise
      : Promise.resolve({ data: [{ id: 2, name: 'Current' }] }))
    const { result, app } = withApp(() => ({
      current: useLoader<CollectionLoadContext, CollectionResult<Role>>({
        key: computed(() => collectionKey({ resource: 'roles', query: { page: page.value } })),
        context: computed(() => ({ query: { page: page.value }, searchParameters: {} })),
        load,
      }),
      shared: useLoader<CollectionLoadContext, CollectionResult<Role>>({
        key: collectionKey({ resource: 'roles', query: { page: 1 } }),
        context: { query: { page: 1 }, searchParameters: {} },
        load,
      }),
    }), { queryClient })
    await flush(8)

    page.value = 2
    await flush(8)
    pending.reject(new Error('The shared page failed.'))
    await vi.waitFor(() => expect(result.shared.error.value?.message).toBe('The shared page failed.'))

    expect(result.current.data.value?.data).toEqual([{ id: 2, name: 'Current' }])
    expect(result.current.error.value).toBeUndefined()
    expect(toastError).toHaveBeenCalledOnce()
    expect(toastError).toHaveBeenCalledWith('The shared page failed.')
    app.unmount()
  })

  it('does not report a failed record read after its identity changes', async () => {
    const id = ref('old')
    const pending = deferred<Role | undefined>()
    const signals: (AbortSignal | undefined)[] = []
    const toastError = vi.spyOn(toast, 'error').mockImplementation(() => '')
    const { result, app } = withApp(() => useLoader<RecordLoadContext, Role | undefined>({
      key: computed(() => recordKey({ resource: 'roles', id: id.value, variant: 'display' })),
      context: computed(() => ({ id: id.value, searchParameters: {} })),
      load: ({ id: currentId, signal }) => {
        signals.push(signal)
        return currentId === 'old' ? pending.promise : Promise.resolve({ id: 'new', name: 'Current' })
      },
    }))
    await flush(8)

    id.value = 'new'
    await flush(8)
    pending.reject(new Error('The old record failed.'))
    await flush(8)

    expect(signals[0]?.aborted).toBe(true)
    expect(result.data.value).toEqual({ id: 'new', name: 'Current' })
    expect(result.error.value).toBeUndefined()
    expect(toastError).not.toHaveBeenCalled()
    app.unmount()
  })

  it('does not report a rejected read after its last observer unmounts', async () => {
    const pending = deferred<CollectionResult<Role>>()
    const signals: (AbortSignal | undefined)[] = []
    const toastError = vi.spyOn(toast, 'error').mockImplementation(() => '')
    const { app } = withApp(() => useLoader<CollectionLoadContext, CollectionResult<Role>>({
      key: collectionKey({ resource: 'roles' }),
      context,
      load: ({ signal }) => {
        signals.push(signal)
        return pending.promise
      },
    }))
    await flush(6)

    app.unmount()
    pending.reject(new Error('The abandoned page failed.'))
    await flush(8)

    expect(signals[0]?.aborted).toBe(true)
    expect(toastError).not.toHaveBeenCalled()
  })

  it('normalizes failures through the data adapter', async () => {
    const { result, app } = withApp(
      () =>
        useLoader<CollectionLoadContext, CollectionResult<Role>>({
          key: collectionKey({ resource: 'roles' }),
          context,
          load: async () => {
            throw { message: 'Backend refused.' }
          },
        }),
      {
        queryClient: createFrameworkQueryClient({ retry: 0 }),
        adapters: { data: { normalizeError: (error) => ({ message: `normalized: ${(error as { message: string }).message}` }) } },
      },
    )
    await flush(10)

    expect(result.error.value?.message).toBe('normalized: Backend refused.')
    app.unmount()
  })

  it('reports one normalized terminal failure for observers that share a read', async () => {
    const load = vi.fn(async () => {
      throw new Error('Backend refused.')
    })
    const toastError = vi.spyOn(toast, 'error').mockImplementation(() => '')
    const queryClient = createFrameworkQueryClient({ retry: 1 })
    queryClient.setDefaultOptions({ queries: { retry: 1, retryDelay: 0, retryOnMount: false } })
    const adapters = {
      data: { normalizeError: (error: unknown) => ({ message: `normalized: ${error instanceof Error ? error.message : String(error)}` }) },
    }
    const first = withApp(
      () => ({
        first: useLoader<CollectionLoadContext, CollectionResult<Role>>({
          key: collectionKey({ resource: 'roles' }),
          context,
          load,
        }),
        second: useLoader<CollectionLoadContext, CollectionResult<Role>>({
          key: collectionKey({ resource: 'roles' }),
          context,
          load,
        }),
      }),
      { queryClient, adapters },
    )
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(2))

    expect(load).toHaveBeenCalledTimes(2)
    expect(first.result.first.error.value?.message).toBe('normalized: Backend refused.')
    expect(first.result.second.error.value?.message).toBe('normalized: Backend refused.')
    expect(toastError).toHaveBeenCalledOnce()
    expect(toastError).toHaveBeenCalledWith('normalized: Backend refused.')
    first.app.unmount()

    const remounted = withApp(() => useLoader<CollectionLoadContext, CollectionResult<Role>>({
      key: collectionKey({ resource: 'roles' }),
      context,
      load,
    }), { queryClient, adapters })
    await flush(8)

    expect(load).toHaveBeenCalledTimes(2)
    expect(remounted.result.error.value?.message).toBe('normalized: Backend refused.')
    expect(toastError).toHaveBeenCalledOnce()

    await expect(remounted.result.refresh()).rejects.toThrow('Backend refused.')
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(4))
    expect(toastError).toHaveBeenCalledTimes(2)
    expect(toastError).toHaveBeenLastCalledWith('normalized: Backend refused.')
    remounted.app.unmount()
  })

  it('does not dispatch a disabled read and reports it after enabling', async () => {
    const enabled = ref(false)
    const load = vi.fn(async () => {
      throw new Error('Backend refused.')
    })
    const toastError = vi.spyOn(toast, 'error').mockImplementation(() => '')
    const queryClient = createFrameworkQueryClient({ retry: 0 })
    const { result, app } = withApp(() => useLoader<CollectionLoadContext, CollectionResult<Role>>({
      key: collectionKey({ resource: 'roles' }),
      context,
      enabled,
      load,
    }), { queryClient })
    await flush(8)

    expect(load).not.toHaveBeenCalled()
    expect(toastError).not.toHaveBeenCalled()

    enabled.value = true
    await vi.waitFor(() => expect(load).toHaveBeenCalledOnce())
    await vi.waitFor(() => expect(result.error.value?.message).toBe('Backend refused.'))

    expect(toastError).toHaveBeenCalledOnce()
    app.unmount()
  })

  it('does not report a failed request after its last observer becomes inactive', async () => {
    const enabled = ref(true)
    const pending = deferred<CollectionResult<Role>>()
    const load = vi.fn((_loadContext: CollectionLoadContext) => {
      return pending.promise
    })
    const toastError = vi.spyOn(toast, 'error').mockImplementation(() => '')
    const { result, app } = withApp(() => useLoader<CollectionLoadContext, CollectionResult<Role>>({
      key: collectionKey({ resource: 'roles', namespace: 'inactive-read' }),
      context,
      enabled,
      load,
    }), { queryClient: createFrameworkQueryClient({ retry: 0 }) })
    await vi.waitFor(() => expect(load).toHaveBeenCalledOnce())

    enabled.value = false
    await flush(6)
    pending.reject(new Error('The inactive read failed.'))
    await flush(8)

    expect(result.error.value).toBeUndefined()
    expect(toastError).not.toHaveBeenCalled()
    app.unmount()
  })

  it('does not load when data is supplied externally', async () => {
    const load = vi.fn(async () => ({ data: [] }))
    const { result, app } = withApp(() =>
      useLoader<CollectionLoadContext, CollectionResult<Role>>({
        key: collectionKey({ resource: 'roles' }),
        context,
        load: undefined,
        data: { data: [{ id: 9, name: 'Static' }] },
      }),
    )
    await flush()

    expect(load).not.toHaveBeenCalled()
    expect(result.data.value?.data).toEqual([{ id: 9, name: 'Static' }])
    app.unmount()
  })

  it('reports terminal failures on the framework-created query client', async () => {
    const load = vi.fn(async () => {
      throw new Error('Created client read failed.')
    })
    const toastError = vi.spyOn(toast, 'error').mockImplementation(() => '')
    const { result, app } = withApp(() => useLoader<CollectionLoadContext, CollectionResult<Role>>({
      key: collectionKey({ resource: 'created-client' }),
      context,
      load,
    }), { adapters: { queryDefaults: { retry: 0 } } })
    await vi.waitFor(() => expect(result.error.value?.message).toBe('Created client read failed.'))

    expect(toastError).toHaveBeenCalledOnce()
    expect(toastError).toHaveBeenCalledWith('Created client read failed.')
    app.unmount()
  })

  it('rejects supplying both data and load', () => {
    expect(() =>
      withApp(() =>
        useLoader<CollectionLoadContext, CollectionResult<Role>>({
          key: collectionKey({ resource: 'roles' }),
          context,
          load: () => ({ data: [] }),
          data: { data: [] },
        }),
      ),
    ).toThrow('`data` and `load` are alternatives')
  })

  it('invalidates by resource semantics without exposing keys', async () => {
    const load = vi.fn(async () => ({ data: [{ id: 1, name: 'Admin' }] }))
    const unrelated = vi.fn(async () => ({ data: [] }))
    const queryClient = createFrameworkQueryClient({ staleTime: 0 })

    const { app } = withApp(
      () => ({
        roles: useLoader<CollectionLoadContext, CollectionResult<Role>>({
          key: collectionKey({ resource: 'roles' }),
          context,
          load,
        }),
        users: useLoader<CollectionLoadContext, CollectionResult<Role>>({
          key: collectionKey({ resource: 'users' }),
          context,
          load: unrelated,
        }),
      }),
      { queryClient },
    )
    await flush(8)
    expect(load).toHaveBeenCalledTimes(1)

    await invalidateResourceData(queryClient, { resource: 'roles' })
    await flush(8)

    expect(load).toHaveBeenCalledTimes(2)
    expect(unrelated).toHaveBeenCalledTimes(1)
    app.unmount()
  })

  it('reports a failed active sibling read when another invalidated read is canceled', async () => {
    const queryClient = createFrameworkQueryClient({ retry: 0, staleTime: 0 })
    const pendingList = deferred<CollectionResult<Role>>()
    let listCalls = 0
    let detailCalls = 0
    let listSignal: AbortSignal | undefined
    const listKey = collectionKey({ resource: 'roles' })
    const detailKey = recordCacheKey('roles', 1, 'display', undefined, {})
    const { app } = withApp(
      () => ({
        list: useLoader<CollectionLoadContext, CollectionResult<Role>>({
          key: listKey,
          context,
          load: ({ signal }) => {
            listCalls += 1
            if (listCalls === 1) return { data: [] }
            listSignal = signal
            return pendingList.promise
          },
        }),
        detail: useLoader<RecordLoadContext, Role | undefined>({
          key: detailKey,
          context: { id: 1, searchParameters: {} },
          load: async () => {
            detailCalls += 1
            if (detailCalls > 1) throw new Error('The detail read failed.')
            return { id: 1, name: 'Admin' }
          },
        }),
      }),
      { queryClient },
    )
    await flush(8)

    const invalidation = invalidateResourceData(queryClient, { resource: 'roles' }).then(
      () => ({ status: 'resolved' as const }),
      (error: unknown) => ({ status: 'rejected' as const, error }),
    )
    await vi.waitFor(() => expect(detailCalls).toBe(2))
    await queryClient.cancelQueries({ queryKey: listKey, exact: true })
    pendingList.resolve({ data: [] })

    const result = await invalidation
    expect(result.status).toBe('rejected')
    if (result.status !== 'rejected') throw new Error('Resource invalidation hid a failed active read.')
    expect(result.error).toBeInstanceOf(Error)
    if (!(result.error instanceof Error)) throw new Error('Resource invalidation returned a non-error failure.')
    expect(result.error.message).toBe('The detail read failed.')
    expect(listSignal?.aborted).toBe(true)
    app.unmount()
  })

  it('waits for every same-prefix refresh and suppresses the later sibling failure', async () => {
    const queryClient = createFrameworkQueryClient({ retry: 0, staleTime: 0 })
    const firstRefresh = deferred<CollectionResult<Role>>()
    const secondRefresh = deferred<CollectionResult<Role>>()
    const firstKey = collectionKey({ resource: 'roles', namespace: 'first' })
    let firstCalls = 0
    let secondCalls = 0
    let firstSignal: AbortSignal | undefined
    const firstLoad = vi.fn(({ signal }: CollectionLoadContext) => {
      firstCalls += 1
      if (firstCalls === 1) return Promise.resolve({ data: [{ id: 1, name: 'First' }] })
      firstSignal = signal
      return firstRefresh.promise
    })
    const secondLoad = vi.fn(() => {
      secondCalls += 1
      if (secondCalls === 1) return Promise.resolve({ data: [{ id: 2, name: 'Second' }] })
      return secondRefresh.promise
    })
    const toastError = vi.spyOn(toast, 'error').mockImplementation(() => '')
    const { result, app } = withApp(() => ({
      first: useLoader<CollectionLoadContext, CollectionResult<Role>>({
        key: firstKey,
        context,
        load: firstLoad,
      }),
      second: useLoader<CollectionLoadContext, CollectionResult<Role>>({
        key: collectionKey({ resource: 'roles', namespace: 'second' }),
        context,
        load: secondLoad,
      }),
    }), { queryClient })
    await vi.waitFor(() => {
      expect(result.first.data.value?.data[0]?.name).toBe('First')
      expect(result.second.data.value?.data[0]?.name).toBe('Second')
    })

    let settled = false
    const refresh = withWriteRefreshFeedbackSuppressed(queryClient, 'roles', undefined, () =>
      invalidateResourceData(queryClient, { resource: 'roles' }),
    ).then(
      () => ({ status: 'resolved' as const }),
      (error: unknown) => ({ status: 'rejected' as const, error }),
    ).finally(() => { settled = true })
    await vi.waitFor(() => {
      expect(firstCalls).toBe(2)
      expect(secondCalls).toBe(2)
    })

    await queryClient.cancelQueries({ queryKey: firstKey, exact: true })
    firstRefresh.resolve({ data: [] })
    await flush(6)
    expect(firstSignal?.aborted).toBe(true)
    expect(settled).toBe(false)
    expect(toastError).not.toHaveBeenCalled()

    secondRefresh.reject(new Error('The second refreshed list failed.'))
    const refreshResult = await refresh
    expect(refreshResult.status).toBe('rejected')
    if (refreshResult.status !== 'rejected') throw new Error('Resource refresh completed before its same-prefix sibling.')
    expect(refreshResult.error).toBeInstanceOf(Error)
    if (!(refreshResult.error instanceof Error)) throw new Error('Resource refresh returned a non-error failure.')
    expect(refreshResult.error.message).toBe('The second refreshed list failed.')
    expect(toastError).not.toHaveBeenCalled()
    app.unmount()
  })

  it('invalidates the keys used by table and detail cores', async () => {
    const listLoad = vi.fn(async () => ({ data: [{ id: 1, name: 'Admin' }] }))
    const detailLoad = vi.fn(async () => ({ id: 1, name: 'Admin' }))
    const queryClient = createFrameworkQueryClient({ staleTime: 0 })

    const { app } = withApp(
      () => ({
        list: useLoader<CollectionLoadContext, CollectionResult<Role>>({
          key: collectionKey({ resource: 'roles', query: {}, searchParameters: {} }),
          context,
          load: listLoad,
        }),
        detail: useLoader({
          key: recordCacheKey('roles', 1, 'display', undefined, {}),
          context: { id: 1, searchParameters: {} },
          load: detailLoad,
        }),
      }),
      { queryClient },
    )
    await flush(8)
    expect(listLoad).toHaveBeenCalledTimes(1)
    expect(detailLoad).toHaveBeenCalledTimes(1)

    await invalidateResourceData(queryClient, { resource: 'roles' })
    await flush(8)

    expect(listLoad).toHaveBeenCalledTimes(2)
    expect(detailLoad).toHaveBeenCalledTimes(2)

    await invalidateResourceData(queryClient, { resource: 'roles', id: 1 })
    await flush(8)

    expect(listLoad).toHaveBeenCalledTimes(3)
    expect(detailLoad).toHaveBeenCalledTimes(3)
    app.unmount()
  })

  it('refetches active orientation records and collections through base resource owners', async () => {
    const categoryResource = 'my-syllabus-categories'
    const categoryId = 'category-1'
    const syllabusResource = 'my-syllabi.category-1'
    const syllabusId = 'syllabus-1'
    const materialResource = 'my-learning-materials.category-1.syllabus-1'
    const materialId = 'material-1'
    const categoryLoad = vi.fn(async () => ({ id: categoryId, name: 'Orientation' }))
    const historyLoad = vi.fn(async () => [{ id: syllabusId, name: 'Syllabus' }])
    const syllabusLoad = vi.fn(async () => ({ id: syllabusId, name: 'Syllabus' }))
    const materialLoad = vi.fn(async () => ({ data: [{ id: materialId, name: 'Material' }] }))
    const actionNamespaceLoad = vi.fn(async () => ({ id: syllabusId, name: 'Private action query' }))
    const queryClient = createFrameworkQueryClient({ staleTime: 0 })

    const { app } = withApp(
      () => ({
        category: useLoader({
          key: recordCacheKey(categoryResource, categoryId, 'display', undefined, { categoryId }),
          context: { id: categoryId, searchParameters: { categoryId } },
          load: categoryLoad,
        }),
        histories: useLoader({
          key: collectionKey({ resource: categoryResource, namespace: `histories.${categoryId}`, searchParameters: { categoryId } }),
          context: { query: {}, searchParameters: { categoryId } },
          load: historyLoad,
        }),
        syllabus: useLoader({
          key: recordCacheKey(syllabusResource, syllabusId, 'display', undefined, { categoryId, syllabusId }),
          context: { id: syllabusId, searchParameters: { categoryId, syllabusId } },
          load: syllabusLoad,
        }),
        materials: useLoader({
          key: collectionKey({ resource: materialResource, query: { page: 1, limit: 100 }, searchParameters: { categoryId, syllabusId } }),
          context: { query: { page: 1, limit: 100 }, searchParameters: { categoryId, syllabusId } },
          load: materialLoad,
        }),
        privateActionQuery: useLoader({
          key: recordCacheKey(syllabusResource, syllabusId, 'display', `${syllabusResource}.detail.${syllabusId}`, { categoryId, syllabusId }),
          context: { id: syllabusId, searchParameters: { categoryId, syllabusId } },
          load: actionNamespaceLoad,
        }),
      }),
      { queryClient },
    )
    await flush(10)

    expect(categoryLoad).toHaveBeenCalledTimes(1)
    expect(historyLoad).toHaveBeenCalledTimes(1)
    expect(syllabusLoad).toHaveBeenCalledTimes(1)
    expect(materialLoad).toHaveBeenCalledTimes(1)
    expect(actionNamespaceLoad).toHaveBeenCalledTimes(1)

    await Promise.all([
      invalidateResourceData(queryClient, { resource: categoryResource, id: categoryId }),
      invalidateResourceData(queryClient, { resource: syllabusResource, id: syllabusId }),
      invalidateResourceData(queryClient, { resource: materialResource, id: materialId }),
    ])
    await flush(10)

    expect(categoryLoad).toHaveBeenCalledTimes(2)
    expect(historyLoad).toHaveBeenCalledTimes(2)
    expect(syllabusLoad).toHaveBeenCalledTimes(2)
    expect(materialLoad).toHaveBeenCalledTimes(2)
    expect(actionNamespaceLoad).toHaveBeenCalledTimes(2)
    app.unmount()
  })
})
