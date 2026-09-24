import { h } from 'vue'
import { describe, expect, it } from 'vitest'
import { z } from 'zod/v4'
import TableInput from '../form-inputs/TableInput.vue'
import { flush, mountCore } from '../../core/__tests__/harness'
import { defineForm } from '../../../forms/defineForm'
import { defineTable } from '../../../tables/defineTable'

const first = { id: 'one', name: 'First' }
const second = { id: 'two', name: 'Second' }
const rowSchema = z.object({ id: z.string(), name: z.string() })
const inputSchema = z.object({ id: z.string().default('generated'), label: z.string() }).transform(({ id, label }) => ({ id, name: label }))
const table = defineTable({ schema: rowSchema, columns: { name: {} } })
const form = defineForm({ schema: inputSchema, fields: { label: { renderer: 'text', initialValue: () => 'Draft row' } } })
const toDraft = (row: typeof first) => ({ id: row.id, label: row.name })

describe('TableInput surface', () => {
  it('renders rows and mutation controls through core components', () => {
    const view = mountCore(TableInput, { table, form, toDraft, modelValue: [first, second] })

    expect(view.text()).toContain('First')
    expect(view.text()).toContain('Second')
    expect(view.text()).toContain('Tambah')
    expect(view.all('[aria-label="Edit row"]')).toHaveLength(2)
    expect(view.all('[aria-label="Delete row"]')).toHaveLength(2)
    expect(view.all('[aria-label="Row actions"]')).toHaveLength(2)
    expect(view.all('[aria-label="Row actions"]')[0].className).toContain('justify-end')
    expect(view.all('[aria-label="Row actions"]')[0].className).toContain('gap-1')
    expect(view.text()).not.toContain('DataCloneError')
    view.unmount()
  })

  it('uses the row form input factory for a new row', async () => {
    const view = mountCore(TableInput, { table, form, toDraft, modelValue: [] })
    const createButton = view.all('button').find((button) => button.textContent?.includes('Tambah'))

    createButton?.click()
    await flush()

    expect(document.body.querySelector<HTMLInputElement>('[role="dialog"] input')?.value).toBe('Draft row')
    view.unmount()
  })

  it('maps stored rows to form input and replaces rows with parsed output', async () => {
    let emittedRows: unknown
    const view = mountCore(TableInput, {
      table,
      form,
      toDraft,
      modelValue: [first, second],
      'onUpdate:modelValue': (rows: unknown) => { emittedRows = rows },
    })
    const editButton = view.all('button').find((button) => button.getAttribute('aria-label') === 'Edit row')

    editButton?.click()
    await flush()

    const label = document.body.querySelector<HTMLInputElement>('[role="dialog"] input')
    expect(label?.value).toBe('First')
    if (!label) throw new Error('Edit form input was not mounted.')
    label.value = 'Changed'
    label.dispatchEvent(new Event('input', { bubbles: true }))
    await flush()
    document.body.querySelector<HTMLButtonElement>('[role="dialog"] button[type="submit"]')?.click()
    await flush(10)

    expect(emittedRows).toEqual([{ id: 'one', name: 'Changed' }, second])
    expect((emittedRows as typeof first[])[0]).not.toBe(first)
    expect(first).toEqual({ id: 'one', name: 'First' })
    view.unmount()
  })

  it('hides mutation controls and reordering while disabled', () => {
    const view = mountCore(TableInput, {
      table,
      form,
      toDraft,
      modelValue: [first],
      disabled: true,
      reorderable: true,
      rowKey: 'id',
    })

    expect(view.text()).not.toContain('Tambah')
    expect(view.find('[aria-label="Edit row"]')).toBeNull()
    expect(view.find('[aria-label="Delete row"]')).toBeNull()
    expect(view.find('.sortable-chosen')).toBeNull()
    view.unmount()
  })

  it('requires rowKey when reordering is enabled', () => {
    expect(() => mountCore(TableInput, { table, form, toDraft, modelValue: [first], reorderable: true })).toThrow(
      '[loom] TableInput reorderable mode requires rowKey.',
    )
  })

  it('rejects table-owned data and loader bindings', () => {
    expect(() => mountCore(TableInput, { table: { ...table, data: [first] }, modelValue: [] })).toThrow(
      '[loom][COMPOSITE_BINDING_CONFLICT] TableInput table.data is owned by TableInput.',
    )
    expect(() => mountCore(TableInput, { table: { ...table, load: () => ({ data: [first] }) }, modelValue: [] })).toThrow(
      '[loom][COMPOSITE_BINDING_CONFLICT] TableInput table.load is owned by TableInput.',
    )
  })

  it('rejects row form submit, loader, and model bindings', () => {
    expect(() => mountCore(TableInput, { table, form: { ...form, submit: () => first }, toDraft, modelValue: [] })).toThrow(
      '[loom][COMPOSITE_BINDING_CONFLICT] TableInput form.submit is owned by TableInput.',
    )
    expect(() => mountCore(TableInput, { table, form: { ...form, load: () => ({ name: 'First' }) }, toDraft, modelValue: [] })).toThrow(
      '[loom][COMPOSITE_BINDING_CONFLICT] TableInput form.load is owned by TableInput.',
    )
    expect(() => mountCore(TableInput, { table, form: { ...form, modelValue: { name: 'First' } }, toDraft, modelValue: [] })).toThrow(
      '[loom][COMPOSITE_BINDING_CONFLICT] TableInput form.modelValue is owned by TableInput.',
    )
  })

  it('keeps read-only rows free of editor and reorder controls', () => {
    const view = mountCore(TableInput, { table, modelValue: [first] })

    expect(view.text()).toContain('First')
    expect(view.text()).not.toContain('Tambah')
    expect(view.find('[aria-label="Edit row"]')).toBeNull()
    expect(view.find('[aria-label="Delete row"]')).toBeNull()
    view.unmount()

    expect(() => mountCore(TableInput, { table, modelValue: [first], reorderable: true, rowKey: 'id' })).toThrow(
      '[loom][COMPOSITE_BINDING_CONFLICT] TableInput read-only mode cannot reorder rows.',
    )

    expect(() => mountCore(TableInput, { table, modelValue: [first], rowKey: 'id' })).toThrow(
      '[loom][COMPOSITE_BINDING_CONFLICT] TableInput read-only mode cannot reorder rows.',
    )
  })

  it('preserves create-button and table customization slots', () => {
    const view = mountCore(
      TableInput,
      { table, form, toDraft, modelValue: [first] },
      {
        slots: {
          'create-button': () => h('span', { 'data-custom-create': '' }, 'Custom create'),
          table: ({ data }) => h('div', { 'data-custom-table': '' }, `${(data as unknown[]).length} custom row`),
        },
      },
    )

    expect(view.find('[data-custom-create]')?.textContent).toBe('Custom create')
    expect(view.find('[data-custom-table]')?.textContent).toBe('1 custom row')
    view.unmount()
  })
})
