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
  const method = exposedForm(view)[name]
  if (typeof method !== 'function') throw new Error(`Form does not expose ${name}().`)
  return method()
}

function exposedForm(view: ReturnType<typeof mountCore>): Record<string, unknown> {
  const exposed = view.exposed()
  const form = exposed.form
  return typeof form === 'object' && form !== null ? form as Record<string, unknown> : exposed
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

  it('recomputes derived fields from the current draft before submission', async () => {
    const submitResult = vi.fn(async (value: { name: string; slug: string }) => value)
    const view = mount(Form, {
      schema: z.object({ name: z.string(), slug: z.string() }),
      fields: {
        name: { renderer: 'text' },
        slug: { renderer: 'text', behavior: { derived: ({ draft }: { draft: { name?: string | null } }) => draft.name?.trim().toLowerCase() ?? '' } },
      },
      initialData: { name: 'Ada', slug: 'manual' },
      submit: submitResult,
    })
    await flush(12)

    expect(fieldInput(view, 'slug').value).toBe('ada')
    expect(fieldInput(view, 'slug').disabled).toBe(true)
    setText(view, 'name', ' Grace ')
    await flush()
    await callExposed(view, 'submit')

    expect(fieldInput(view, 'slug').value).toBe('grace')
    expect(submitResult).toHaveBeenCalledWith({ name: ' Grace ', slug: 'grace' })
  })

  it('blocks every submit entry after an uncertain post-write failure', async () => {
    const validate = vi.fn()
    const submit = vi.fn(async () => {
      throw Object.assign(new Error('The write may have completed.'), { postWrite: true })
    })
    const submitted = vi.fn()
    const actionScopes: Array<Record<string, unknown>> = []
    const view = mountCore(Form, {
      schema: z.object({ name: z.string().min(1) }),
      fields: { name: { renderer: 'text' } },
      initialData: { name: 'Ada' },
      validators: [{ validate }],
      submit,
      normalizeError: () => ({ message: 'Check the saved record.', postWrite: true }),
      onSubmitted: submitted,
    }, {
      slots: {
        actions: (scope) => {
          actionScopes.push(scope)
          return h('button', {
            type: 'button',
            'data-slot-submit': '',
            onClick: () => { void (scope.submit as () => Promise<void>)() },
          }, 'Save from slot')
        },
      },
    })
    mounted.push(view)
    await flush()

    const form = view.find<HTMLFormElement>('form')
    if (!form) throw new Error('Form did not render its root form.')
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await flush()
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await flush()
    await callExposed(view, 'submit')
    view.find<HTMLButtonElement>('[data-slot-submit]')?.click()
    await flush()

    expect(submit).toHaveBeenCalledOnce()
    expect(validate).toHaveBeenCalledOnce()
    expect(submitted).not.toHaveBeenCalled()
    expect(fieldInput(view, 'name').value).toBe('Ada')
    expect(view.exposed()).toHaveProperty('postWriteError', { message: 'Check the saved record.', postWrite: true })
    expect(actionScopes.at(-1)).toHaveProperty('postWriteError', { message: 'Check the saved record.', postWrite: true })
    expect(view.find('[role="alert"]')?.textContent).toContain('Check the record before starting another save.')
  })

  it('keeps ordinary submit failures retryable', async () => {
    const submit = vi.fn()
      .mockRejectedValueOnce(new Error('The request was rejected.'))
      .mockResolvedValueOnce('saved')
    const submitted = vi.fn()
    const errors: unknown[] = []
    const view = mount(Form, {
      schema: z.object({ name: z.string() }),
      fields: { name: { renderer: 'text' } },
      initialData: { name: 'Ada' },
      submit,
      onSubmitted: submitted,
      onError: (error: unknown) => errors.push(error),
    })
    await flush()

    await callExposed(view, 'submit')
    expect(view.exposed()).toHaveProperty('postWriteError', undefined)
    await callExposed(view, 'submit')

    expect(submit).toHaveBeenCalledTimes(2)
    expect(errors).toHaveLength(1)
    expect(submitted).toHaveBeenCalledOnce()
  })

  it('keeps the post-write block through same-target Form state changes', async () => {
    const schema = shallowRef(z.object({ name: z.string(), alias: z.string().optional() }))
    const fields = shallowRef<Record<string, unknown>>({ name: { renderer: 'text' } })
    const initialData = ref<Record<string, unknown>>({ name: 'Ada' })
    const id = ref<Record<string, string>>({ tenant: 'north', record: 'same-record' })
    const searchParameters = ref<Record<string, unknown>>({ query: 'first' })
    const namespace = ref('first-form')
    const refreshResult = deferred<{ name: string; alias: string }>()
    const load = vi.fn(({ searchParameters: currentSearch }: { searchParameters: Record<string, unknown> }) => {
      return currentSearch.query === 'second'
        ? refreshResult.promise
        : Promise.resolve({ name: 'Loaded', alias: 'Loaded alias' })
    })
    const submit = vi.fn(async (_value: { name: string; alias?: string }) => {
      throw Object.assign(new Error('The write may have completed.'), { postWrite: true })
    })
    const replacementSubmit = vi.fn(async () => 'saved')
    const submitTarget = shallowRef<(value: { name: string; alias?: string }) => Promise<unknown>>(submit)
    const Host = defineComponent({
      setup(_, { expose }) {
        const form = ref<Record<string, unknown> | null>(null)
        expose({ form })
        return () => h(Form, {
          ref: form,
          schema: schema.value,
          fields: fields.value,
          initialData: initialData.value,
          load,
          resource: 'users',
          id: id.value,
          namespace: namespace.value,
          searchParameters: searchParameters.value,
          submit: submitTarget.value,
        })
      },
    })
    const view = mount(Host)
    await flush(12)
    await callExposed(view, 'submit')
    expect(exposedForm(view).postWriteError).toMatchObject({ postWrite: true })

    const changes: Array<[string, () => void | Promise<unknown>]> = [
      ['edit', () => setText(view, 'name', 'Grace')],
      ['blur', () => fieldInput(view, 'name').dispatchEvent(new Event('blur'))],
      ['validation', () => callExposed(view, 'validate')],
      ['reset', () => callExposed(view, 'reset')],
      ['refresh', () => callExposed(view, 'refresh')],
      ['initial data', () => { initialData.value = { name: 'Updated baseline' } }],
      ['same composite identity', () => { id.value = { record: 'same-record', tenant: 'north' } }],
      ['schema', () => { schema.value = z.object({ name: z.string(), alias: z.string().optional() }) }],
      ['selected fields', () => { fields.value = { name: { renderer: 'text' }, alias: { renderer: 'text' } } }],
      ['submit function', () => { submitTarget.value = replacementSubmit }],
    ]

    for (const [change, applyChange] of changes) {
      await applyChange()
      await flush(12)
      await callExposed(view, 'submit')
      expect(exposedForm(view).postWriteError, change).toMatchObject({ postWrite: true })
    }

    searchParameters.value = { query: 'second' }
    await flush(12)
    expect(view.text()).toContain('Loading…')
    expect(view.find('[role="alert"]')?.textContent).toContain('Check the record before starting another save.')
    refreshResult.resolve({ name: 'Refreshed', alias: 'Refreshed alias' })
    await flush(12)
    await callExposed(view, 'submit')
    expect(exposedForm(view).postWriteError).toMatchObject({ postWrite: true })

    namespace.value = 'second-form'
    await flush(12)
    await callExposed(view, 'submit')
    expect(exposedForm(view).postWriteError).toMatchObject({ postWrite: true })

    namespace.value = 'second-form'
    await flush(12)
    await callExposed(view, 'submit')
    expect(exposedForm(view).postWriteError).toMatchObject({ postWrite: true })

    expect(submit).toHaveBeenCalledOnce()
    expect(replacementSubmit).not.toHaveBeenCalled()
  })

  it('keeps the post-write block after a controlled draft replacement', async () => {
    const model = ref<{ name: string }>({ name: 'Ada' })
    const submit = vi.fn(async () => {
      throw Object.assign(new Error('The write may have completed.'), { postWrite: true })
    })
    const Host = defineComponent({
      setup(_, { expose }) {
        const form = ref<Record<string, unknown> | null>(null)
        expose({ form })
        return () => h(Form, {
          ref: form,
          schema: z.object({ name: z.string() }),
          fields: { name: { renderer: 'text' } },
          modelValue: model.value,
          'onUpdate:modelValue': (value: { name: string }) => { model.value = value },
          submit,
        })
      },
    })
    const view = mount(Host)
    await flush()
    await callExposed(view, 'submit')

    model.value = { name: 'Grace' }
    await flush()
    await callExposed(view, 'submit')

    expect(fieldInput(view, 'name').value).toBe('Grace')
    expect(submit).toHaveBeenCalledOnce()
    expect(exposedForm(view).postWriteError).toMatchObject({ postWrite: true })
  })

  it.each(['resource', 'id'] as const)('allows submission after the %s write target changes', async (changedTarget) => {
    const resource = ref('users')
    const id = ref('first-record')
    let calls = 0
    const submit = vi.fn(async () => {
      calls += 1
      if (calls === 1) throw Object.assign(new Error('The write may have completed.'), { postWrite: true })
      return 'saved'
    })
    const submitted = vi.fn()
    const Host = defineComponent({
      setup(_, { expose }) {
        const form = ref<Record<string, unknown> | null>(null)
        expose({ form })
        return () => h(Form, {
          ref: form,
          schema: z.object({ name: z.string() }),
          fields: { name: { renderer: 'text' } },
          initialData: { name: 'Ada' },
          resource: resource.value,
          id: id.value,
          submit,
          onSubmitted: submitted,
        })
      },
    })
    const view = mount(Host)
    await flush()
    await callExposed(view, 'submit')
    expect(exposedForm(view).postWriteError).toMatchObject({ postWrite: true })

    if (changedTarget === 'resource') resource.value = 'members'
    else id.value = 'second-record'
    await flush(12)
    expect(exposedForm(view).postWriteError).toBeUndefined()
    await callExposed(view, 'submit')

    expect(submit).toHaveBeenCalledTimes(2)
    expect(submitted).toHaveBeenCalledWith('saved')
  })

  it('ignores a late post-write error from the earlier target', async () => {
    const oldWrite = deferred<unknown>()
    const id = ref('first-record')
    let calls = 0
    const submit = vi.fn(() => {
      calls += 1
      return calls === 1 ? oldWrite.promise : Promise.resolve('saved')
    })
    const errors: unknown[] = []
    const submitted = vi.fn()
    const Host = defineComponent({
      setup(_, { expose }) {
        const form = ref<Record<string, unknown> | null>(null)
        expose({ form })
        return () => h(Form, {
          ref: form,
          schema: z.object({ name: z.string() }),
          fields: { name: { renderer: 'text' } },
          initialData: { name: 'Ada' },
          resource: 'users',
          id: id.value,
          submit,
          onError: (error: unknown) => errors.push(error),
          onSubmitted: submitted,
        })
      },
    })
    const view = mount(Host)
    await flush()
    const oldAttempt = Promise.resolve(callExposed(view, 'submit'))
    await flush()
    expect(submit).toHaveBeenCalledOnce()

    id.value = 'second-record'
    await flush(12)
    await callExposed(view, 'submit')
    oldWrite.reject(Object.assign(new Error('The write may have completed.'), { postWrite: true }))
    await oldAttempt
    await flush()

    expect(submit).toHaveBeenCalledTimes(2)
    expect(errors).toHaveLength(0)
    expect(submitted).toHaveBeenCalledWith('saved')
    expect(exposedForm(view).postWriteError).toBeUndefined()
  })

  it('starts a new Form mount without the previous post-write block', async () => {
    const submit = vi.fn(async () => {
      throw Object.assign(new Error('The write may have completed.'), { postWrite: true })
    })
    const props = {
      schema: z.object({ name: z.string() }),
      fields: { name: { renderer: 'text' } },
      initialData: { name: 'Ada' },
      submit,
    }
    const first = mount(Form, props)
    await flush()
    await callExposed(first, 'submit')
    expect(first.exposed().postWriteError).toMatchObject({ postWrite: true })
    first.unmount()
    mounted.splice(mounted.indexOf(first), 1)

    const second = mount(Form, props)
    await flush()

    expect(second.exposed().postWriteError).toBeUndefined()
    await callExposed(second, 'submit')
    expect(submit).toHaveBeenCalledTimes(2)
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
