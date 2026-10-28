import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod/v4'
import Form from '../../components/core/Form.vue'
import { flush, mountCore } from '../../components/core/__tests__/harness'

const mounted: Array<ReturnType<typeof mountCore>> = []

afterEach(() => {
  for (const view of mounted.splice(0)) view.unmount()
})

describe('defineForm', () => {
  it('isolates literal defaults between sessions and keeps them for reset', async () => {
    const values = { tags: ['one'], enabled: false }
    const date = new Date('2026-01-01')
    const schema = z.object({ text: z.string(), amount: z.number(), active: z.boolean(), nullable: z.string().nullable(), values: z.object({ tags: z.array(z.string()), enabled: z.boolean() }), date: z.date() })
    const fields = {
      text: { renderer: 'text', initialValue: '' },
      amount: { renderer: 'number', initialValue: 0 },
      active: { renderer: 'switch', initialValue: false },
      nullable: { renderer: 'text', initialValue: null },
      values: { renderer: 'text', initialValue: values },
      date: { renderer: 'text', initialValue: date },
    }
    const submit = vi.fn()
    const slots = { 'input:values': () => null, 'input:date': () => null }
    const first = mountCore(Form, { schema, fields, submit }, { slots })
    const second = mountCore(Form, { schema, fields, submit }, { slots })
    mounted.push(first, second)
    await flush()
    const expected = { text: '', amount: 0, active: false, nullable: null, values: { tags: ['one'], enabled: false }, date: new Date('2026-01-01') }
    values.tags.push('external')
    date.setFullYear(2030)
    await (first.exposed().submit as () => Promise<void>)()
    expect(submit).toHaveBeenLastCalledWith(expected)
    const draft = second.exposed().draft as { date: Date }
    draft.date.setFullYear(2040)
    await (second.exposed().submit as () => Promise<void>)()
    expect(submit).toHaveBeenLastCalledWith(expected)
    first.find<HTMLInputElement>('input')!.value = 'changed'
    first.find<HTMLInputElement>('input')!.dispatchEvent(new Event('input', { bubbles: true }))
    await flush()
    const reset = first.exposed().reset as () => void
    reset()
    await (first.exposed().submit as () => Promise<void>)()
    expect(submit).toHaveBeenLastCalledWith(expected)
  })
})
