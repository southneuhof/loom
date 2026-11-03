import { afterEach, expect, it, vi } from 'vitest'
import { z } from 'zod/v4'
import TableInput from '../form-inputs/TableInput.vue'
import NumberInput from '../../inputs/NumberInput.vue'
import TextInput from '../../inputs/TextInput.vue'
import Form from '../../core/Form.vue'
import { deferred, flush, mountCore } from '../../core/__tests__/harness'

const mounted: Array<ReturnType<typeof mountCore>> = []
afterEach(() => mounted.splice(0).forEach((view) => view.unmount()))

function fixture() {
  const response = deferred<object>()
  const submit = vi.fn(() => response.promise)
  const view = mountCore(
    Form,
    {
      schema: z.object({ subjects: z.array(z.object({ name: z.string().min(1), risk: z.string().min(1) })) }),
      initialData: {
        subjects: [
          { name: 'Lifting', risk: 'Falling objects' },
          { name: 'Welding', risk: 'Sparks' },
        ],
      },
      fields: {
        subjects: {
          renderer: 'table',
          props: {
            mode: 'inline',
            reorderable: true,
            createRow: () => ({ name: '', risk: '' }),
            fields: { name: { renderer: 'text', label: 'Name' }, risk: { renderer: 'text', label: 'Risk' } },
          },
        },
      },
      normalizeError: () => ({ message: 'Rejected', issues: [{ path: ['subjects', 1, 'risk'], message: 'Server rejected risk' }] }),
      submit,
    },
    { renderers: { form: { table: TableInput, text: TextInput } } }
  )
  mounted.push(view)
  return { view, submit, response }
}

function change(view: ReturnType<typeof mountCore>, index: number, field: string, value: string) {
  const input = view.find<HTMLInputElement>(`[id$="-field-subjects.${index}.${field}"]`)
  if (!input) throw new Error('Missing inline control')
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
  return input
}

it('keeps the server error on its row through move, unrelated edit, correction and deletion', async () => {
  const { view, response } = fixture()
  view.find('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  await flush()
  expect(view.all('input').every((input) => input.hasAttribute('disabled'))).toBe(true)
  expect(view.find<HTMLButtonElement>('[aria-label="Move row up"]')?.disabled).toBe(true)
  response.reject(new Error('Rejected'))
  await flush(12)
  expect(document.activeElement?.id).toEqual(expect.stringContaining('-field-subjects.1.risk'))
  const originalRow = view.all('article')[1]
  view.all('[aria-label="Move row up"]')[1]?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  await flush()
  const moved = view.all('article')[0]!
  expect(moved).toBe(originalRow)
  expect(moved.textContent).toContain('Server rejected risk')
  expect(view.find<HTMLInputElement>('[id$="-field-subjects.0.name"]')?.value).toBe('Welding')
  change(view, 0, 'name', 'Welding renamed')
  await flush()
  expect(moved.textContent).toContain('Server rejected risk')
  change(view, 0, 'risk', 'Shield sparks')
  await flush()
  expect(view.text()).not.toContain('Server rejected risk')
  expect(view.find<HTMLInputElement>('[id$="-field-subjects.1.name"]')?.value).toBe('Lifting')
  view.all('[aria-label="Delete row"]')[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  await flush()
  expect(view.all('article')).toHaveLength(1)
  expect(view.find<HTMLInputElement>('[id$="-field-subjects.0.name"]')?.value).toBe('Lifting')
})

it('adds a row, validates through the parent schema and keeps touched errors aligned on removal', async () => {
  const { view, submit } = fixture()
  view.find<HTMLButtonElement>('[id$="-field-subjects-add"]')?.click()
  await flush()
  expect(view.all('article')).toHaveLength(3)
  expect(document.activeElement?.id).toEqual(expect.stringContaining('-field-subjects.2.name'))
  change(view, 2, 'risk', '')
  await flush()
  expect(view.all('article')[2]?.textContent).toContain('Too small')
  view.all('[aria-label="Delete row"]')[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  await flush()
  expect(view.all('article')[1]?.textContent).toContain('Too small')
  view.find('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  await flush()
  expect(submit).not.toHaveBeenCalled()
  expect(document.activeElement?.id).toEqual(expect.stringContaining('-field-subjects.1.name'))
})

it('resets a malformed nested number even when its stored value did not change', async () => {
  const view = mountCore(
    Form,
    {
      schema: z.object({ rows: z.array(z.object({ count: z.number() })) }),
      initialData: { rows: [{ count: 5 }] },
      fields: { rows: { renderer: 'table', props: { mode: 'inline', createRow: () => ({ count: 0 }), fields: { count: { renderer: NumberInput, label: 'Count' } } } } },
      submit: async () => undefined,
    },
    { renderers: { form: { table: TableInput } } }
  )
  mounted.push(view)
  const input = view.find<HTMLInputElement>('input')!
  input.value = 'not-a-number'
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await flush()
  view.find('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  await flush()
  expect(view.text()).toContain('Enter a valid number.')
  const reset = view.exposed().reset
  if (typeof reset !== 'function') throw new Error('Missing Form reset')
  reset()
  await flush()
  expect(view.find<HTMLInputElement>('input')?.value).toBe('5')
  expect(view.text()).not.toContain('Enter a valid number.')
})
