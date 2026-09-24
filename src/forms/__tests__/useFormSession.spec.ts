import { computed, defineComponent, h, ref, shallowRef } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import Form from '../../components/core/Form.vue'
import { deferred, flush, mountCore } from '../../components/core/__tests__/harness'

const mounted: Array<ReturnType<typeof mountCore>> = []

function mount(component: Parameters<typeof mountCore>[0], props: Record<string, unknown> = {}) {
  const view = mountCore(component, props)
  mounted.push(view)
  return view
}

function fieldInput(view: ReturnType<typeof mountCore>, key: string): HTMLInputElement {
  const input = view.find<HTMLInputElement>(`[id$="-field-${key}"]`)
  if (!input) throw new Error(`Form field "${key}" did not render.`)
  return input
}

function setText(view: ReturnType<typeof mountCore>, key: string, value: string): void {
  const input = fieldInput(view, key)
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

function callExposed(view: ReturnType<typeof mountCore>, name: string): void | Promise<void> {
  const method = view.exposed()[name]
  if (typeof method !== 'function') throw new Error(`Form does not expose ${name}().`)
  return method()
}

afterEach(() => {
  for (const view of mounted.splice(0)) view.unmount()
  document.body.innerHTML = ''
})

describe('useFormSession loading and identity', () => {
  it('applies a refreshed late load only to untouched keys and resets to the loaded baseline', async () => {
    const refreshResult = deferred<{ name: string; detail: string }>()
    let loadCalls = 0
    const load = vi.fn(() => {
      loadCalls += 1
      return loadCalls === 1 ? undefined : refreshResult.promise
    })
    const schema = z.object({ name: z.string(), detail: z.string() })
    const view = mount(Form, {
        schema,
        fields: { name: { renderer: 'text' }, detail: { renderer: 'text' } },
        load,
        submit: async () => 'saved',
    })
    await flush(12)

    expect(load).toHaveBeenCalledOnce()
    const refreshing = callExposed(view, 'refresh')
    setText(view, 'name', 'user edit')
    await flush()
    refreshResult.resolve({ name: 'loaded name', detail: 'loaded detail' })
    await refreshing
    await flush()

    expect(fieldInput(view, 'name').value).toBe('user edit')
    expect(fieldInput(view, 'detail').value).toBe('loaded detail')
    await callExposed(view, 'reset')
    await flush()
    expect(fieldInput(view, 'name').value).toBe('loaded name')
    expect(fieldInput(view, 'detail').value).toBe('loaded detail')
  })

  it('ignores an earlier identity response after the record changes', async () => {
    const first = deferred<{ name: string }>()
    const second = deferred<{ name: string }>()
    const id = ref<'first' | 'second'>('first')
    const schema = z.object({ name: z.string() })
    const load = vi.fn(({ id: recordId }: { id?: string }) => recordId === 'first' ? first.promise : second.promise)
    const Host = defineComponent({
      setup: () => () => h(Form, {
        schema,
        fields: { name: { renderer: 'text' } },
        id: id.value,
        load,
        submit: async () => 'saved',
      }),
    })
    const view = mount(Host)
    await flush()
    expect(load).toHaveBeenCalledTimes(1)

    id.value = 'second'
    await flush()
    expect(load).toHaveBeenCalledTimes(2)
    first.resolve({ name: 'stale record' })
    await flush()
    expect(view.text()).toContain('Loading')
    second.resolve({ name: 'current record' })
    await flush(12)

    expect(fieldInput(view, 'name').value).toBe('current record')
  })

  it('resets the session when schema identity changes and rejects stale validation', async () => {
    const validation = deferred<void>()
    const nameSchema = z.object({ name: z.string() })
    const ageSchema = z.object({ age: z.string() })
    const currentSchema = shallowRef(nameSchema)
    const currentFields = computed(() => currentSchema.value === nameSchema
      ? { name: { renderer: 'text' } }
      : { age: { renderer: 'text' } })
    const validator = vi.fn(async () => {
      await validation.promise
      return { path: ['name'], message: 'Stale validation result' }
    })
    const Host = defineComponent({
      setup: () => () => h(Form, {
        schema: currentSchema.value,
        fields: currentFields.value,
        initialData: currentSchema.value === nameSchema ? { name: 'before' } : { age: 'after' },
        validators: [{ validate: validator }],
        submit: async () => 'saved',
      }),
    })
    const view = mount(Host)
    await flush()

    const submit = view.find<HTMLFormElement>('form')
    if (!submit) throw new Error('Form did not render its root form.')
    submit.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await flush()
    expect(validator).toHaveBeenCalledOnce()

    currentSchema.value = ageSchema
    await flush()
    expect(fieldInput(view, 'age').value).toBe('after')
    validation.resolve()
    await flush()
    expect(view.text()).not.toContain('Stale validation result')
  })
})
