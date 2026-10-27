import { describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, shallowRef, type ComponentPropsOptions, type VNodeChild } from 'vue'
import { z } from 'zod/v4'
import type { CollectionProps, CollectionResult, DetailProps } from '../../../contracts'
import { defineResource } from '../../../resources/defineResource'
import { mountCore, flush, deferred } from './harness'
import { useCollection, type CollectionReader } from '../useCollection'
import { useRecord, type RecordReader } from '../useRecord'

type RecordRow = { id: number; name: string }
type Query = { status: string }

const recordSchema = z.object({ id: z.number(), name: z.string() })
const detailFields = { name: { label: 'Name' } }
const querySchema = z.object({ status: z.enum(['active']) })

function mountReader(
  setup: () => () => VNodeChild,
  options: { componentProps?: ComponentPropsOptions; mountProps?: Record<string, unknown> } = {},
) {
  return mountCore(defineComponent({ props: options.componentProps, setup }), options.mountProps ?? {})
}

describe('shared resource readers', () => {
  it('reads the configured record source from a custom page with an unrelated data prop', async () => {
    const load = vi.fn(async () => ({ name: 'Loaded record' }))
    const view = mountReader(() => {
      const reader = useRecord(() => ({ schema: z.object({ name: z.string() }), fields: {}, load }))
      return () => h('p', reader.record.value?.name)
    }, {
      componentProps: { data: String },
      mountProps: { data: 'Page metadata' },
    })
    await flush()

    expect(view.text()).toContain('Loaded record')
    view.unmount()
  })

  it('reads the configured collection source from a custom page with an unrelated load prop', async () => {
    const view = mountReader(() => {
      const reader = useCollection(() => ({ data: [{ name: 'Local row' }] }))
      return () => h('p', reader.records.value[0]?.name)
    }, {
      componentProps: { load: String },
      mountProps: { load: 'Page operation' },
    })
    await flush()

    expect(view.text()).toContain('Local row')
    view.unmount()
  })

  it('switches between supplied record data and a loader without fetching in data mode', async () => {
    const localRecord = { id: 1, name: 'Local' }
    const replacementRecord = { id: 3, name: 'Replacement' }
    const load = vi.fn(async () => ({ id: 2, name: 'Remote' }))
    const source = shallowRef<DetailProps<RecordRow>>({ schema: recordSchema, fields: detailFields, data: localRecord })
    let reader: RecordReader<RecordRow> | undefined
    const view = mountReader(() => {
      reader = useRecord(() => source.value)
      return () => h('p', reader?.record.value?.name ?? 'Loading')
    })
    await flush()

    expect(view.text()).toContain('Local')
    expect(load).not.toHaveBeenCalled()

    source.value = { schema: recordSchema, fields: detailFields, id: 2, load }
    await flush(12)

    expect(view.text()).toContain('Remote')
    expect(load).toHaveBeenCalledOnce()

    source.value = { schema: recordSchema, fields: detailFields, data: replacementRecord }
    await flush()
    await reader!.refresh()

    expect(view.text()).toContain('Replacement')
    expect(load).toHaveBeenCalledOnce()
    view.unmount()
  })

  it('accepts equivalent bound composite identities with reordered keys', async () => {
    const compositeSchema = z.object({ id: z.object({ left: z.number(), right: z.number() }), name: z.string() })
    const boundId = { left: 1, right: 2 }
    const resource = defineResource({
      key: 'pairs',
      identity: (record: { id: typeof boundId }) => record.id,
      detail: {
        permission: null,
        detail: ({ id }) => ({
          schema: compositeSchema,
          fields: { name: {} },
          load: async () => ({ id, name: 'Composite' }),
        }),
      },
    })
    const source: DetailProps<{ id: typeof boundId; name: string }> = {
      ...resource.detail({ id: boundId }).detail,
      id: { right: 2, left: 1 },
    }
    const view = mountReader(() => {
      const reader = useRecord(() => source)
      return () => h('p', reader.record.value?.name ?? 'Loading')
    })
    await flush()

    expect(view.text()).toContain('Composite')
    view.unmount()
  })

  it('keeps a loaded record visible and reports a failed background refresh', async () => {
    const record = { id: 1, name: 'Current' }
    const load = vi.fn()
      .mockResolvedValueOnce(record)
      .mockRejectedValueOnce(new Error('Refresh failed'))
    const source = shallowRef<DetailProps<RecordRow>>({ schema: recordSchema, fields: detailFields, id: 1, load })
    let reader: RecordReader<RecordRow> | undefined
    const view = mountReader(() => {
      reader = useRecord(() => source.value)
      return () => h('p', reader?.record.value?.name ?? 'Loading')
    })

    await flush()
    expect(view.text()).toContain('Current')

    await expect(reader!.refresh()).rejects.toThrow('Refresh failed')
    await flush()

    expect(view.text()).toContain('Current')
    expect(reader?.error.value?.message).toBe('Refresh failed')
    expect(reader?.loading.value).toBe(false)
    expect(reader?.empty.value).toBe(false)
    view.unmount()
  })

  it('keeps the current identity when an older record load resolves late', async () => {
    const late = deferred<RecordRow>()
    const source = shallowRef<DetailProps<RecordRow>>({
      schema: recordSchema,
      fields: detailFields,
      id: 1,
      load: () => late.promise,
    })
    let reader: RecordReader<RecordRow> | undefined
    const view = mountReader(() => {
      reader = useRecord(() => source.value)
      return () => h('p', reader?.record.value?.name ?? 'Loading')
    })
    await flush()

    source.value = {
      schema: recordSchema,
      fields: detailFields,
      id: 2,
      load: async () => ({ id: 2, name: 'Current identity' }),
    }
    await flush()
    expect(view.text()).toContain('Current identity')

    late.resolve({ id: 1, name: 'Late identity' })
    await flush()

    expect(reader?.record.value).toEqual({ id: 2, name: 'Current identity' })
    expect(view.text()).toContain('Current identity')
    expect(view.text()).not.toContain('Late identity')
    view.unmount()
  })

  it('validates controlled query updates and returns collection result context', async () => {
    const calls: Query[] = []
    const updates: Array<Record<string, unknown>> = []
    const controlledQuery = shallowRef<Query>({ status: 'active' })
    const source = computed<CollectionProps<RecordRow, Query>>(() => ({
      query: controlledQuery.value,
      querySchema,
      load: async ({ query }): Promise<CollectionResult<RecordRow>> => {
        calls.push(query)
        return { data: [{ id: 1, name: 'Current' }], meta: { total: 1 }, context: { source: 'shared-reader' } }
      },
    }))
    let reader: CollectionReader<RecordRow, Query> | undefined
    const view = mountReader(() => {
      reader = useCollection(() => source.value, {
        queryControlled: () => true,
        onUpdateQuery: (query) => {
          updates.push(query)
          controlledQuery.value = { status: String(query.status) }
        },
      })
      return () => h('p', reader?.records.value[0]?.name ?? 'Loading')
    })

    await flush()
    expect(view.text()).toContain('Current')
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({ status: 'active', page: 1, limit: 10 })
    expect(reader?.context.value).toEqual({ source: 'shared-reader' })

    reader!.updateQuery({ status: 'invalid' })
    await flush(12)

    expect(updates).toHaveLength(1)
    expect(controlledQuery.value.status).toBe('invalid')
    expect(reader?.error.value?.message).toContain('Collection query does not match querySchema')
    expect(calls).toHaveLength(1)
    expect(reader?.records.value).toEqual([])
    view.unmount()
  })
})
