import { describe, expect, it } from 'vitest'
import { defineComponent, h, ref, type Component } from 'vue'
import { z } from 'zod'
import Collection from '../Collection.vue'
import Detail from '../Detail.vue'
import Table from '../Table.vue'
import TreeTable from '../TreeTable.vue'
import { flush, mountCore } from './harness'

const loader = () => ({ data: [] })

const cases: { component: Component; name: string; props: Record<string, unknown> }[] = [
  { component: Collection, name: 'Collection', props: { data: [] } },
  {
    component: Table,
    name: 'Table',
    props: {
      schema: z.object({ name: z.string() }),
      columns: { name: { label: 'Name' } },
      data: [{ name: 'First' }],
    },
  },
  {
    component: TreeTable,
    name: 'TreeTable',
    props: {
      schema: z.object({ name: z.string(), children: z.array(z.unknown()) }),
      columns: { name: { label: 'Name' } },
      treeColumn: 'name',
      children: (record: { children: unknown[] }) => record.children,
      data: [{ name: 'First', children: [] }],
    },
  },
  {
    component: Detail,
    name: 'Detail',
    props: {
      schema: z.object({ name: z.string() }),
      fields: { name: { label: 'Name' } },
      data: { name: 'First' },
    },
  },
]

describe('surface data source ownership', () => {
  it.each(cases)('rejects a competing source added after $name mounts', async ({ component, name, props }) => {
    const source = ref<Record<string, unknown>>({ data: props.data })
    const Host = defineComponent(() => () => h(component, { ...props, ...source.value }))
    const view = mountCore(Host, {})
    const errors: unknown[] = []
    view.app.config.errorHandler = (error) => errors.push(error)

    source.value = { data: props.data, load: loader }
    await flush()

    expect(errors).toHaveLength(1)
    expect(errors[0]).toBeInstanceOf(Error)
    expect(errors[0]).toMatchObject({
      message: `[loom][SURFACE_DATA_SOURCE_INVALID] ${name} requires exactly one of "data" or "load".`,
    })
    view.unmount()
  })
})
