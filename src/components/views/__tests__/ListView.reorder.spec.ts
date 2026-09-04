import { defineComponent, h, onMounted } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import type { RowReorderPayload } from '../../../contracts'
import { flush, mountCore } from '../../core/__tests__/harness'
import ListView from '../ListView.vue'

const tableState = vi.hoisted(() => ({
  props: undefined as
    | { reorderable?: boolean; rowKey?: string | ((record: unknown) => string | number) }
    | undefined,
  payload: {
    rows: [{ id: 'first', name: 'First' }],
    oldIndex: 0,
    newIndex: 1,
    moved: { id: 'first', name: 'First' },
    query: { state: 'active' },
  } satisfies RowReorderPayload<{ id: string; name: string }>,
}))

vi.mock('../../core/Table.vue', () => ({
  default: defineComponent({
    name: 'Table',
    props: {
      reorderable: Boolean,
      rowKey: [String, Function],
    },
    emits: ['row-reorder'],
    setup(props, { emit }) {
      tableState.props = {
        reorderable: props.reorderable,
        rowKey: props.rowKey,
      }

      onMounted(() => emit('row-reorder', tableState.payload))

      return () => h('div', { 'data-table-stub': true })
    },
  }),
}))

describe('ListView reorder forwarding', () => {
  it('forwards rowKey and the Table row-reorder event', async () => {
    const onRowReorder = vi.fn()
    const view = mountCore(ListView, {
      run: async () => ({ data: tableState.payload.rows }),
      fields: { name: { label: 'Name' } },
      namespace: 'list-reorder',
      reorderable: true,
      rowKey: 'id',
      onRowReorder,
    })

    await flush()

    expect(tableState.props).toEqual({ reorderable: true, rowKey: 'id' })
    expect(onRowReorder).toHaveBeenCalledOnce()
    expect(onRowReorder).toHaveBeenCalledWith(tableState.payload)

    view.unmount()
  })
})
