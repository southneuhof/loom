import { computed, defineComponent, h, ref, shallowRef, type Component } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { toast } from 'vue-sonner'
import Form from '../../components/core/Form.vue'
import Table from '../../components/core/Table.vue'
import Detail from '../../components/core/Detail.vue'
import { deferred, flush, mountCore } from '../../components/core/__tests__/harness'
import { defineResource } from '../../resources/defineResource'
import { useFrameworkQueryClient } from '../../query/client'

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
  vi.restoreAllMocks()
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

  it('forwards one confirmed result and safely handles failed and shared read recovery', async () => {
    type RecordRow = { id: string; name: string }
    const rowSchema = z.object({ id: z.string(), name: z.string() })
    const draftSchema = z.object({ name: z.string() })
    let readCalls = 0
    let recoveryMode: 'fail' | 'pending' = 'fail'
    const recoveryRead = deferred<{ data: RecordRow[] }>()
    const read = vi.fn(() => {
      readCalls += 1
      if (readCalls === 1) return Promise.resolve({ data: [{ id: '1', name: 'Current' }] })
      return recoveryMode === 'pending'
        ? recoveryRead.promise
        : Promise.reject(new Error('The collection could not be refreshed.'))
    })
    const serverWrite = deferred<RecordRow>()
    const submit = vi.fn((_input: { name: string }) => serverWrite.promise)
    const resource = defineResource({
      key: 'confirmed-form-recovery',
      identity: (record: RecordRow) => record.id,
      list: {
        permission: null,
        table: { schema: rowSchema, columns: { name: {} }, load: read },
      },
      create: {
        permission: null,
        form: { schema: draftSchema, fields: { name: { renderer: 'text' } }, initialData: { name: 'Grace' }, submit },
      },
    })
    const toastWarning = vi.spyOn(toast, 'warning').mockImplementation(() => '')
    const submitted: Array<[unknown, unknown?]> = []
    const Host = defineComponent({
      setup(_, { expose }) {
        const form = ref<Record<string, unknown> | null>(null)
        expose({ form })
        return () => h('div', [
          h(Table as Component, resource.list().table),
          h(Form, {
            ...resource.create().form,
            ref: form,
            onSubmitted: (result: unknown, refreshError?: unknown) => submitted.push([result, refreshError]),
          }),
        ])
      },
    })
    const view = mount(Host, {})
    await vi.waitFor(() => expect(read).toHaveBeenCalledOnce())
    const write = callExposed(view, 'submit')
    await vi.waitFor(() => expect(submit).toHaveBeenCalledOnce())
    setText(view, 'name', 'Newer draft')
    serverWrite.resolve({ id: '2', name: 'Grace' })
    await write
    await vi.waitFor(() => expect(submitted).toHaveLength(1))

    expect(submit).toHaveBeenCalledOnce()
    expect(submitted[0]?.[0]).toEqual({ id: '2', name: 'Grace' })
    expect(submitted[0]?.[1]).toMatchObject({ writeOutcome: 'confirmed', result: { id: '2', name: 'Grace' } })
    expect(view.text()).toContain('Changes saved. The data could not be refreshed.')
    expect(fieldInput(view, 'name').value).toBe('Newer draft')
    expect(toastWarning).toHaveBeenCalledOnce()
    expect(toastWarning).toHaveBeenCalledWith('Changes saved. Could not refresh the data.')

    await callExposed(view, 'refresh')
    expect(read).toHaveBeenCalledTimes(3)
    expect(exposedForm(view).postWriteError).toBe(submitted[0]?.[1])
    expect(toastWarning).toHaveBeenCalledTimes(2)

    recoveryMode = 'pending'
    const firstRecovery = callExposed(view, 'refresh')
    const secondRecovery = callExposed(view, 'refresh')
    expect(firstRecovery).toBe(secondRecovery)
    await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(4))
    recoveryRead.resolve({ data: [{ id: '1', name: 'Refreshed' }] })
    await firstRecovery

    expect(exposedForm(view).postWriteError).toBeUndefined()
    expect(read).toHaveBeenCalledTimes(4)
    expect(submitted).toHaveLength(1)
    expect(submit).toHaveBeenCalledOnce()
    expect(toastWarning).toHaveBeenCalledTimes(2)
  })

  it('keeps a confirmed Form recovery blocked when its read is canceled', async () => {
    type RecordRow = { id: string; name: string }
    const rowSchema = z.object({ id: z.string(), name: z.string() })
    const draftSchema = z.object({ name: z.string() })
    let readCalls = 0
    let recoveryMode: 'fail' | 'pending' = 'fail'
    const recoveryRead = deferred<{ data: RecordRow[] }>()
    const read = vi.fn(() => {
      readCalls += 1
      if (readCalls === 1) return Promise.resolve({ data: [{ id: '1', name: 'Current' }] })
      return recoveryMode === 'pending'
        ? recoveryRead.promise
        : Promise.reject(new Error('The collection could not be refreshed.'))
    })
    const resource = defineResource({
      key: 'confirmed-form-cancel',
      identity: (record: RecordRow) => record.id,
      list: { permission: null, table: { schema: rowSchema, columns: { name: {} }, load: read } },
      create: {
        permission: null,
        form: { schema: draftSchema, fields: { name: { renderer: 'text' } }, initialData: { name: 'Grace' }, submit: async (input: { name: string }) => ({ id: '2', ...input }) },
      },
    })
    const toastWarning = vi.spyOn(toast, 'warning').mockImplementation(() => '')
    let queryClient: ReturnType<typeof useFrameworkQueryClient> | undefined
    const Host = defineComponent({
      setup(_, { expose }) {
        const form = ref<Record<string, unknown> | null>(null)
        queryClient = useFrameworkQueryClient()
        expose({ form })
        return () => h('div', [
          h(Table as Component, resource.list().table),
          h(Form, { ...resource.create().form, ref: form }),
        ])
      },
    })
    const view = mount(Host, {})
    await vi.waitFor(() => expect(read).toHaveBeenCalledOnce())
    await callExposed(view, 'submit')
    await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(2))
    expect(exposedForm(view).postWriteError).toMatchObject({ writeOutcome: 'confirmed' })
    recoveryMode = 'pending'

    const recovery = callExposed(view, 'refresh')
    await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(3))
    const activeQueries = queryClient?.getQueryCache().findAll({ queryKey: ['resource', 'confirmed-form-cancel', 'list'] }) ?? []
    expect(activeQueries).toHaveLength(1)
    const activeQuery = activeQueries[0]
    if (!activeQuery) throw new Error('The mounted collection query was not found.')
    await queryClient?.cancelQueries({ queryKey: activeQuery.queryKey, exact: true })
    recoveryRead.resolve({ data: [{ id: '1', name: 'Late read' }] })
    await recovery

    expect(exposedForm(view).postWriteError).toMatchObject({ writeOutcome: 'confirmed' })
    expect(toastWarning).toHaveBeenCalledOnce()
    expect(read).toHaveBeenCalledTimes(3)
  })

  it('starts recovery for a new target while an old target read is pending', async () => {
    type RecordRow = { id: string; name: string }
    const rowSchema = z.object({ id: z.string(), name: z.string() })
    const draftSchema = z.object({ name: z.string() })
    const oldRecovery = deferred<RecordRow>()
    const newRecovery = deferred<RecordRow>()
    const detailCalls = new Map<string, number>()
    const detailLoad = vi.fn(({ id }: { id: string }) => {
      const calls = (detailCalls.get(id) ?? 0) + 1
      detailCalls.set(id, calls)
      if (calls === 1) return Promise.resolve({ id, name: `Row ${id}` })
      if (calls === 2) throw new Error(`The ${id} refresh failed.`)
      return id === 'one' ? oldRecovery.promise : newRecovery.promise
    })
    const writes: Array<{ id: string; name: string }> = []
    const resource = defineResource({
      key: 'targeted-form-recovery',
      identity: (record: RecordRow) => record.id,
      detail: {
        permission: null,
        detail: () => ({ schema: rowSchema, fields: { name: {} }, load: detailLoad }),
      },
      update: {
        permission: null,
        form: ({ id }) => ({
          schema: draftSchema,
          fields: { name: { renderer: 'text' } },
          load: async () => ({ name: `Row ${id}` }),
          submit: async (input: { name: string }) => {
            writes.push({ id, ...input })
            return { id, ...input }
          },
        }),
      },
    })
    const Host = defineComponent({
      setup(_, { expose }) {
        const target = ref('one')
        const form = ref<Record<string, unknown> | null>(null)
        expose({ setTarget: (id: string) => { target.value = id }, form })
        return () => h('div', [
          h(Detail as Component, resource.detail({ id: 'one' }).detail),
          h(Detail as Component, resource.detail({ id: 'two' }).detail),
          h(Form, { ...resource.update({ id: target.value }).form, ref: form }),
        ])
      },
    })
    const view = mount(Host, {})

    await vi.waitFor(() => {
      expect(detailCalls.get('one')).toBe(1)
      expect(detailCalls.get('two')).toBe(1)
      expect(fieldInput(view, 'name').value).toBe('Row one')
    })
    const oldFormError = callExposed(view, 'submit')
    await oldFormError
    await vi.waitFor(() => expect(detailCalls.get('one')).toBe(2))
    const firstError = exposedForm(view).postWriteError
    expect(firstError).toMatchObject({ writeOutcome: 'confirmed', result: { id: 'one', name: 'Row one' } })

    const oldRetry = callExposed(view, 'refresh')
    await vi.waitFor(() => expect(detailCalls.get('one')).toBe(3))
    const setTarget = view.exposed().setTarget
    if (typeof setTarget !== 'function') throw new Error('The Form target setter was not exposed.')
    setTarget('two')
    await vi.waitFor(() => expect(fieldInput(view, 'name').value).toBe('Row two'))
    await vi.waitFor(() => expect(exposedForm(view).postWriteError).toBeUndefined())

    await callExposed(view, 'submit')
    await vi.waitFor(() => expect(detailCalls.get('two')).toBe(2))
    const secondError = exposedForm(view).postWriteError
    expect(secondError).toMatchObject({ writeOutcome: 'confirmed', result: { id: 'two', name: 'Row two' } })

    const newRetry = callExposed(view, 'refresh')
    await vi.waitFor(() => expect(detailCalls.get('two')).toBe(3))
    oldRecovery.resolve({ id: 'one', name: 'Old target read' })
    await oldRetry
    expect(exposedForm(view).postWriteError).toBe(secondError)
    newRecovery.resolve({ id: 'two', name: 'New target read' })
    await newRetry

    expect(exposedForm(view).postWriteError).toBeUndefined()
    expect(writes).toEqual([{ id: 'one', name: 'Row one' }, { id: 'two', name: 'Row two' }])
    view.unmount()
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

  it('does not accept confirmed completion metadata from a custom normalizer', async () => {
    const submitted = vi.fn()
    const errors: unknown[] = []
    const view = mount(Form, {
      schema: z.object({ name: z.string() }),
      fields: { name: { renderer: 'text' } },
      initialData: { name: 'Ada' },
      submit: async () => { throw new Error('The request was rejected.') },
      normalizeError: () => ({
        message: 'The request was rejected.',
        code: 'RESOURCE_POST_WRITE_INVALIDATION_FAILED',
        postWrite: true,
        writeOutcome: 'confirmed',
        result: { id: 'fabricated' },
        refresh: async () => {},
      }),
      onSubmitted: submitted,
      onError: (error: unknown) => errors.push(error),
    })
    await flush()

    await callExposed(view, 'submit')

    expect(submitted).not.toHaveBeenCalled()
    expect(errors).toHaveLength(1)
    expect(view.text()).toContain('The save may have completed. Check the record before starting another save.')
    expect(view.text()).not.toContain('Changes saved. The data could not be refreshed.')
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
