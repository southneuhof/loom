import { afterEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { z } from 'zod'
import Form from '../../components/core/Form.vue'
import { deferred, flush, mountCore } from '../../components/core/__tests__/harness'
import { defineForm } from '../defineForm'

const mounted: ReturnType<typeof mountCore>[] = []
const schema = z.object({ name: z.string(), latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) })
const binding = {
  keys: ['latitude', 'longitude'],
  read: ({ latitude, longitude }: { latitude?: number | null; longitude?: number | null }) => (latitude == null || longitude == null ? null : `${latitude},${longitude}`),
  write: (value: string) => {
    const [latitude, longitude] = value.split(',').map(Number)
    return { latitude, longitude }
  },
}
const fields = { name: { renderer: 'text' }, position: { renderer: 'text', binding } }

function position(view: ReturnType<typeof mountCore>) {
  const input = view.find<HTMLInputElement>('[id$="-field-position"]')
  if (!input) throw new Error('Position field did not render.')
  return input
}

function exposed(view: ReturnType<typeof mountCore>) {
  return view.exposed() as { submit: () => Promise<void>; reset: () => void }
}

afterEach(() => {
  for (const view of mounted.splice(0)) view.unmount()
})

describe('form field bindings', () => {
  it('loads a flat record, updates both keys once, submits flat values, and resets', async () => {
    const submit = vi.fn(async (values: z.output<typeof schema>) => values)
    const model = vi.fn()
    const view = mountCore(Form, { schema, fields, modelValue: { name: 'Harbor', latitude: 0, longitude: 0 }, 'onUpdate:modelValue': model, submit })
    mounted.push(view)
    await flush()
    expect(position(view).value).toBe('0,0')
    position(view).value = '-6,111'
    position(view).dispatchEvent(new Event('input', { bubbles: true }))
    await flush()
    expect(model.mock.calls).toEqual([[{ name: 'Harbor', latitude: -6, longitude: 111 }]])
    await exposed(view).submit()
    expect(submit).toHaveBeenCalledWith({ name: 'Harbor', latitude: -6, longitude: 111 })
    exposed(view).reset()
    await flush()
    expect(position(view).value).toBe('0,0')
  })

  it('shows coordinate errors on the bound field and retains edits during a late load', async () => {
    const loaded = deferred<{ name: string; latitude: number; longitude: number }>()
    let calls = 0
    const view = mountCore(Form, {
      schema,
      fields,
      initialData: { name: 'Harbor', latitude: 0, longitude: 0 },
      load: () => (++calls === 1 ? undefined : loaded.promise),
      submit: vi.fn(),
    })
    mounted.push(view)
    await flush(12)
    const refresh = view.exposed().refresh as () => Promise<void>
    const refreshing = refresh()
    position(view).value = '91,111'
    position(view).dispatchEvent(new Event('input', { bubbles: true }))
    await flush()
    loaded.resolve({ name: 'Loaded', latitude: 1, longitude: 2 })
    await refreshing
    await flush()
    expect(position(view).value).toBe('91,111')
    await exposed(view).submit()
    await flush()
    expect(position(view).getAttribute('aria-invalid')).toBe('true')
    expect(document.activeElement).toBe(position(view))
  })

  it.each([false, true])('clears all bound keys and lets the schema decide if null is valid: %s', async (nullable) => {
    const coordinate = nullable ? z.number().nullable() : z.number()
    const submit = vi.fn()
    const update = vi.fn()
    const view = mountCore(
      Form,
      {
        schema: z.object({ name: z.string(), latitude: coordinate, longitude: coordinate }),
        fields,
        modelValue: { name: 'Harbor', latitude: -6, longitude: 111 },
        'onUpdate:modelValue': update,
        submit,
      },
      { slots: { 'input:position': (scope) => h('button', { type: 'button', onClick: () => (scope.setValue as (value: null) => void)(null) }, 'Clear') } }
    )
    mounted.push(view)
    await flush()
    view.find<HTMLButtonElement>('button')!.click()
    await flush()
    expect(update.mock.calls).toEqual([[{ name: 'Harbor', latitude: null, longitude: null }]])
    await exposed(view).submit()
    if (nullable) expect(submit).toHaveBeenCalledWith({ name: 'Harbor', latitude: null, longitude: null })
    else {
      expect(submit).not.toHaveBeenCalled()
      expect(view.all('[role="alert"]')).toHaveLength(1)
    }
  })

  it('rejects an incomplete binding write without changing the draft', async () => {
    const update = vi.fn()
    let setValue: (value: string) => void = () => {
      throw new Error('Slot did not render.')
    }
    const view = mountCore(
      Form,
      {
        schema,
        fields: { ...fields, position: { renderer: 'text', binding: { ...binding, write: () => ({ latitude: 1 }) } } },
        modelValue: { name: 'Harbor', latitude: 0, longitude: 0 },
        'onUpdate:modelValue': update,
      },
      {
        slots: {
          'input:position': (scope) => {
            setValue = scope.setValue as (value: string) => void
            return h('span', 'Position')
          },
        },
      }
    )
    mounted.push(view)
    await flush()
    expect(() => setValue('1,2')).toThrow('FORM_BINDING_WRITE')
    expect(update).not.toHaveBeenCalled()
    expect(view.exposed().draft).toEqual({ name: 'Harbor', latitude: 0, longitude: 0 })
  })

  it.each([
    { ...fields, latitude: { renderer: 'number' } },
    { ...fields, other: { renderer: 'text', binding } },
  ])('rejects overlapping writers before mounting', (overlapping) => {
    expect(() => Reflect.apply(defineForm, undefined, [{ schema, fields: overlapping }])).toThrow('FORM_BINDING_OVERLAP')
  })
})
