import { afterEach, describe, expect, it } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref, type App } from 'vue'
import { z } from 'zod/v4'
import { FrameworkPlugin } from '../../../adapters/plugin'
import { createFrameworkQueryClient } from '../../../query'
import { defineForm } from '../../../forms/defineForm'
import { defineTable } from '../../../tables/defineTable'
import TableInput from '../form-inputs/TableInput.vue'

type Row = { id: string; name: string }

const apps: App[] = []
const rowSchema = z.object({ id: z.string(), name: z.string() })
const inputSchema = z.object({ id: z.string(), label: z.string() }).transform(({ id, label }) => ({ id, name: label }))
const table = defineTable({ schema: rowSchema, columns: { name: { label: 'Name' } } })
const form = defineForm({ schema: inputSchema, fields: { label: { renderer: 'text', label: 'Row name' } } })
const toDraft = (row: Row) => ({ id: row.id, label: row.name })

async function frame(times = 4) {
  for (let attempt = 0; attempt < times; attempt += 1) {
    await Promise.resolve()
    await nextTick()
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    await nextTick()
  }
}

afterEach(() => {
  apps.splice(0).forEach((app) => app.unmount())
  document.body.innerHTML = ''
})

describe('TableInput row editor', () => {
  it('keeps row edit sessions separate and commits parsed output to the matching row', async () => {
    const first: Row = { id: 'one', name: 'First' }
    const second: Row = { id: 'two', name: 'Second' }
    const rows = ref<Row[]>([first, second])
    const disabled = ref(false)
    const host = document.createElement('div')
    document.body.append(host)
    const app = createApp(defineComponent({
      setup: () => () => h(TableInput, {
        table,
        form,
        toDraft,
        modelValue: rows.value,
        disabled: disabled.value,
        'onUpdate:modelValue': (value: Row[]) => { rows.value = value },
      }),
    }))
    app.use(FrameworkPlugin, { queryClient: createFrameworkQueryClient({ retry: 0, staleTime: 0 }) })
    app.mount(host)
    apps.push(app)

    await frame()
    expect(host.textContent).toContain('First')
    expect(host.textContent).toContain('Second')

    host.querySelectorAll<HTMLButtonElement>('[aria-label="Edit row"]')[0]!.click()
    await frame()
    const firstDialog = document.body.querySelector<HTMLElement>('[role="dialog"]')!
    const firstInput = firstDialog.querySelector<HTMLInputElement>('input')!
    expect(firstInput.value).toBe('First')
    firstInput.value = 'Changed first'
    firstInput.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: 'Changed first' }))
    await frame()
    firstDialog.querySelector<HTMLButtonElement>('button[type="submit"]')!.click()
    await frame()

    expect(rows.value).toEqual([{ id: 'one', name: 'Changed first' }, second])
    expect(host.textContent).toContain('Changed first')

    host.querySelectorAll<HTMLButtonElement>('[aria-label="Edit row"]')[1]!.click()
    await frame()
    const secondDialog = document.body.querySelector<HTMLElement>('[role="dialog"]')!
    expect(secondDialog.querySelector<HTMLInputElement>('input')?.value).toBe('Second')

    disabled.value = true
    await frame()
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
    expect(host.querySelector('[aria-label="Edit row"]')).toBeNull()
    expect(host.querySelector('[aria-label="Delete row"]')).toBeNull()
    expect(rows.value).toEqual([{ id: 'one', name: 'Changed first' }, second])
  })
})
