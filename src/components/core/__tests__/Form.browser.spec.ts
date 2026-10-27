import { afterEach, describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { createApp, defineComponent, h, nextTick, ref, type App, type VNodeChild } from 'vue'
import { z } from 'zod/v4'
import { FrameworkPlugin } from '../../../adapters/plugin'
import { createFrameworkQueryClient } from '../../../query'
import type { FormFieldContext } from '../../../contracts/forms'
import type { RecordLoadContext } from '../../../contracts/load'
import type { TableColumnContext } from '../../../contracts/tables'
import { defineForm } from '../../../forms/defineForm'
import { defineResource } from '../../../resources/defineResource'
import { defineTable } from '../../../tables/defineTable'
import Form from '../Form.vue'
import TextInput from '../../inputs/TextInput.vue'
import './browser.css'

const apps: App[] = []

async function settle() {
  await nextTick()
  await Promise.resolve()
  await nextTick()
}

function mountFormBrowser(render: () => VNodeChild) {
  const host = document.createElement('div')
  document.body.append(host)
  const app = createApp(defineComponent({ setup: () => render }))
  app.use(FrameworkPlugin, { queryClient: createFrameworkQueryClient({ retry: 0, staleTime: 0 }) })
  app.mount(host)
  apps.push(app)
  return host
}

afterEach(() => {
  apps.splice(0).forEach((app) => app.unmount())
  document.body.innerHTML = ''
})

describe('Form control contracts in the browser', () => {
  it('replaces the complete field configuration while preserving the edited value', async () => {
    const form = defineForm({
      schema: z.object({ mode: z.string(), body: z.string() }),
      fields: {
        mode: { renderer: 'text' },
        body: ({ draft }) => draft.mode === 'expanded'
          ? { renderer: 'textarea', span: 4, props: { placeholder: 'expanded', disabled: true } }
          : draft.mode === 'hidden'
            ? { renderer: 'text', span: 2, visible: false }
            : { renderer: 'text', span: 2, props: { placeholder: 'compact', disabled: false } },
      },
    })
    const modelValue = ref({ mode: 'compact', body: 'Saved body' })
    const host = mountFormBrowser(() => h(Form, {
      ...form,
      modelValue: modelValue.value,
      'onUpdate:modelValue': (value) => { modelValue.value = value },
    }))
    await settle()

    const authoredInput = host.querySelector<HTMLInputElement>('input[id$="-field-body"]')
    const field = authoredInput?.closest('.is-form-field')
    expect(authoredInput?.value).toBe('Saved body')
    expect(authoredInput?.placeholder).toBe('compact')
    expect(field?.getAttribute('style')).toContain('span 2')

    const modeInput = host.querySelector<HTMLInputElement>('input[id$="-field-mode"]')
    if (!modeInput) throw new Error('The mode input did not render.')
    modeInput.value = 'expanded'
    modeInput.dispatchEvent(new Event('input', { bubbles: true }))
    await settle()

    await vi.waitFor(() => expect(host.querySelector('textarea')).not.toBeNull())
    const dynamicInput = host.querySelector<HTMLTextAreaElement>('textarea')
    expect(dynamicInput?.value).toBe('Saved body')
    expect(dynamicInput?.placeholder).toBe('expanded')
    expect(dynamicInput?.disabled).toBe(true)
    expect(dynamicInput?.closest('.is-form-field')?.getAttribute('style')).toContain('span 4')
    expect(modelValue.value.body).toBe('Saved body')

    const expandedMode = host.querySelector<HTMLInputElement>('input[id$="-field-mode"]')!
    expandedMode.value = 'hidden'
    expandedMode.dispatchEvent(new Event('input', { bubbles: true }))
    await settle()

    expect(host.querySelector('[id$="-field-body"]')).toBeNull()
    expect(modelValue.value.body).toBe('Saved body')
  })

  it('loads a binding-time create draft with request parameters and field context', async () => {
    type WorkspaceContext = { workspaceId: string }
    type CreateInput = { name: string }
    const schema = z.object({ name: z.string() })
    const load = async ({ searchParameters }: RecordLoadContext) => ({
      name: `Prepared ${String(searchParameters.invitation)}`,
    })
    const resource = defineResource({
      key: 'binding-create-load-browser',
      identity: (record: { id: string }) => record.id,
      create: {
        permission: null,
        form: defineForm({
          schema,
          fields: {
            name: ({ context }: FormFieldContext<CreateInput, WorkspaceContext>) => ({
              renderer: 'text',
              props: { placeholder: context.workspaceId },
            }),
          },
          submit: async (output) => ({ id: 'created', ...output }),
        }),
      },
    })
    const bound = resource.create({
      context: { workspaceId: 'Workspace North' },
      searchParameters: { invitation: 'from invitation' },
      load,
    })
    const host = mountFormBrowser(() => h(Form, { ...bound.form }))

    await vi.waitFor(async () => {
      await settle()
      const input = host.querySelector<HTMLInputElement>('input[id$="-field-name"]')
      expect(input?.value).toBe('Prepared from invitation')
      expect(input?.placeholder).toBe('Workspace North')
    })
  })

  it('keeps remote selections across resolver reevaluation for Select, Radio, Checkbox, and Lookup fields', async () => {
    const optionSchema = z.object({ id: z.string(), name: z.string() })
    type Option = z.output<typeof optionSchema>
    type Draft = { note?: string | null; selectId?: string | null; radioId?: string | null; checked?: Option[] | null; lookupId?: string | null }
    const option = { id: 'one', name: 'One' }
    const table = defineTable({ schema: optionSchema, columns: { name: {} } })
    const form = defineForm({
      schema: z.object({ note: z.string(), selectId: z.string(), radioId: z.string(), checked: z.array(optionSchema), lookupId: z.string() }),
      fields: {
        note: { renderer: 'text' },
        selectId: ({ draft }) => ({
          renderer: 'select',
          span: draft.note ? 6 : 12,
          props: { load: async () => [option], pick: 'id', view: 'name', namespace: 'resolver-select' },
        }),
        radioId: ({ draft }) => ({
          renderer: 'radio',
          label: draft.note ? 'Edited choice' : 'Choice',
          span: draft.note ? 6 : 12,
          props: { load: async () => [option], pick: 'id', view: 'name', namespace: 'resolver-radio' },
        }),
        checked: ({ draft }) => ({
          renderer: 'checkbox-group',
          span: draft.note ? 6 : 12,
          props: { load: async () => [option], pick: 'id', view: 'name', namespace: 'resolver-checkbox' },
        }),
        lookupId: ({ draft }) => ({
          renderer: 'lookup',
          span: draft.note ? 6 : 12,
          props: {
            table,
            load: async () => ({ data: [option], meta: { total: 1, page: 1, pageSize: 5 } }),
            loadDetail: async () => option,
            pick: 'id',
            view: 'name',
          },
        }),
      },
    })
    const modelValue = ref<Draft>({ note: '', selectId: 'one', radioId: 'one', checked: [option], lookupId: 'one' })
    const host = mountFormBrowser(() => h(Form, {
      ...form,
      modelValue: modelValue.value,
      'onUpdate:modelValue': (value) => { modelValue.value = value },
    }))
    await vi.waitFor(async () => {
      await settle()
      expect(host.querySelector<HTMLInputElement>('input[type="radio"]')?.checked).toBe(true)
      expect(host.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked).toBe(true)
      expect(host.querySelector('label[for$="-field-radioId"]')?.textContent).toContain('Choice')
      expect(host.querySelector('[role="radiogroup"]')?.textContent).toContain('One')
      expect(host.querySelector('[role="group"]')?.textContent).toContain('One')
      expect(host.querySelector('[id$="-field-selectId"]')?.textContent).toContain('One')
      expect(host.querySelector('[id$="-field-lookupId"]')?.textContent?.trim()).toBe('One')
    })

    const note = host.querySelector<HTMLInputElement>('input[id$="-field-note"]')
    if (!note) throw new Error('The remote Form controls did not render.')

    await userEvent.fill(note, 'Changed')
    await vi.waitFor(async () => {
      await settle()
      expect(host.querySelector('label[for$="-field-radioId"]')?.textContent).toContain('Edited choice')
      expect(host.querySelector<HTMLInputElement>('input[type="radio"]')?.checked).toBe(true)
      expect(host.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked).toBe(true)
      expect(host.querySelector('[role="radiogroup"]')?.textContent).toContain('One')
      expect(host.querySelector('[role="group"]')?.textContent).toContain('One')
      expect(host.querySelector('[id$="-field-selectId"]')?.textContent).toContain('One')
      expect(host.querySelector('[id$="-field-lookupId"]')?.textContent?.trim()).toBe('One')
    })

    expect.soft(modelValue.value).toMatchObject({ note: 'Changed', selectId: 'one', radioId: 'one', checked: [option], lookupId: 'one' })
  })

  it('keeps a static Lookup context local and inherits the Form context when absent', async () => {
    type WorkspaceContext = { workspaceId: string }
    type LookupInput = { ownerId: string; scopeLabel: string }
    const workspaceTable = defineTable({
      schema: z.object({ id: z.string(), name: z.string() }),
      columns: {
        name: ({ context }: TableColumnContext<WorkspaceContext>) => ({ read: () => context.workspaceId }),
      },
    })
    const schema = z.object({ ownerId: z.string(), scopeLabel: z.string() })
    const rows = [{ id: 'one', name: 'Option one' }]
    const localContext = { workspaceId: 'Field local' }
    const localForm = defineForm({
      schema,
      fields: {
        ownerId: { renderer: 'lookup', props: { table: workspaceTable, data: rows, pick: 'id', view: 'name', context: localContext } },
        scopeLabel: ({ context }: FormFieldContext<LookupInput, WorkspaceContext>) => ({ renderer: 'text', props: { placeholder: context.workspaceId } }),
      },
    })
    const inheritedForm = defineForm({
      schema,
      fields: {
        ownerId: { renderer: 'lookup', props: { table: workspaceTable, data: rows, pick: 'id', view: 'name' } },
        scopeLabel: ({ context }: FormFieldContext<LookupInput, WorkspaceContext>) => ({ renderer: 'text', props: { placeholder: context.workspaceId } }),
      },
    })
    const host = mountFormBrowser(() => h('div', [
      h('section', { 'data-context-case': 'local-without-outer' }, [
        h(Form, { ...localForm, modelValue: { ownerId: 'one', scopeLabel: '' } }),
      ]),
      h('section', { 'data-context-case': 'local-with-outer' }, [
        h(Form, { ...localForm, modelValue: { ownerId: 'one', scopeLabel: '' }, context: { workspaceId: 'Outer replacement' } }),
      ]),
      h('section', { 'data-context-case': 'inherited' }, [
        h(Form, { ...inheritedForm, modelValue: { ownerId: 'one', scopeLabel: '' }, context: { workspaceId: 'Outer inherited' } }),
      ]),
    ]))
    await settle()

    const openAndCheck = async (testCase: string, expected: string) => {
      const section = host.querySelector<HTMLElement>(`[data-context-case="${testCase}"]`)
      const trigger = section?.querySelector<HTMLElement>('.overlay')
      if (!trigger) throw new Error(`Lookup field was not rendered for ${testCase}.`)
      trigger.click()
      await settle()
      expect(document.body.querySelector('[role="dialog"]')?.textContent).toContain(expected)
      const close = [...document.body.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')]
        .find((button) => button.textContent?.includes('Close'))
      close?.click()
      await settle()
    }

    await openAndCheck('local-without-outer', 'Field local')
    await openAndCheck('local-with-outer', 'Field local')
    await openAndCheck('inherited', 'Outer inherited')
  })

  it('blocks Save when the real DateInput retains invalid pasted text', async () => {
    const modelValue = ref<{ date?: string }>({ date: '2026-02-15' })
    const submitResult = vi.fn(async (data: { date?: string }) => data)
    const host = mountFormBrowser(() => h(Form, {
      schema: z.object({ date: z.string().optional() }),
      fields: { date: { renderer: 'date', props: { teleport: false } } },
      modelValue: modelValue.value,
      'onUpdate:modelValue': (value) => { modelValue.value = value },
      submit: submitResult,
    }))
    await vi.waitFor(() => expect(host.querySelector('[data-test-id="dp-input"]')).not.toBeNull())

    const input = host.querySelector<HTMLInputElement>('[data-test-id="dp-input"]')
    if (!input) throw new Error('DateInput did not render its real text input.')
    input.focus()
    const clipboard = new DataTransfer()
    clipboard.setData('text/plain', 'not-a-date')
    input.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, clipboardData: clipboard }))
    input.value = 'not-a-date'
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste', data: 'not-a-date' }))
    await vi.waitFor(() => expect(input.value).toBe('not-a-date'))
    expect(modelValue.value.date).toBe('2026-02-15')

    const save = host.querySelector<HTMLButtonElement>('form button[type="submit"]')
    if (!save) throw new Error('The Save action did not render.')
    save.click()
    await settle()

    expect(submitResult).not.toHaveBeenCalled()
    expect(host.textContent).toContain('Enter a valid date.')

    input.value = '2026-02-20'
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: '2026-02-20' }))
    await vi.waitFor(() => expect(modelValue.value.date).toBe('2026-02-20'))
    save.click()
    await vi.waitFor(() => expect(submitResult).toHaveBeenCalledOnce())

    expect(submitResult).toHaveBeenCalledWith({ date: '2026-02-20' })
  })

  it('keeps invalid numeric TextInput drafts local and submits only valid or unset values', async () => {
    const directValue = ref<string | number | undefined>(8)
    const managedValue = ref<{ amount?: number }>({ amount: 8 })
    const directValidationErrors = vi.fn()
    const submitted = vi.fn(async (value: { amount?: number }) => value)
    const form = defineForm({
      schema: z.object({ amount: z.number().optional() }),
      fields: { amount: { renderer: 'text', props: { constraint: ['number'] as const } } },
      submit: submitted,
    })
    const host = document.createElement('div')
    document.body.append(host)
    const app = createApp(defineComponent({
      setup: () => () => h('div', [
        h(TextInput, {
          constraint: ['number'],
          modelValue: directValue.value,
          'onUpdate:modelValue': (value: string | number | undefined) => { directValue.value = value },
          'onValidation:error': directValidationErrors,
        }),
        h(Form, {
          ...form,
          modelValue: managedValue.value,
          'onUpdate:modelValue': (value) => { managedValue.value = value },
        }),
      ]),
    }))
    app.use(FrameworkPlugin, { queryClient: createFrameworkQueryClient({ retry: 0, staleTime: 0 }) })
    app.mount(host)
    apps.push(app)
    await settle()

    const inputs = host.querySelectorAll<HTMLInputElement>('input')
    expect(inputs).toHaveLength(2)
    const directInput = inputs[0]!
    const managedInput = inputs[1]!
    for (const input of inputs) {
      input.value = '.'
      input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: '.' }))
    }
    await settle()

    expect(directInput.value).toBe('.')
    expect(managedInput.value).toBe('.')
    expect(directValue.value).toBe(8)
    expect(managedValue.value.amount).toBe(8)
    expect(directValidationErrors).toHaveBeenLastCalledWith('Enter a valid number.')

    for (const input of inputs) {
      input.value = '12abc'
      input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste', data: '12abc' }))
    }
    await settle()

    expect(directInput.value).toBe('12abc')
    expect(managedInput.value).toBe('12abc')
    expect(directValue.value).toBe(8)
    expect(managedValue.value.amount).toBe(8)
    expect(directValidationErrors).toHaveBeenLastCalledWith('Enter a valid number.')

    const overflow = '9'.repeat(400)
    for (const input of inputs) {
      input.value = overflow
      input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste', data: overflow }))
    }
    await settle()

    expect(directInput.value).toBe(overflow)
    expect(managedInput.value).toBe(overflow)
    expect(directValue.value).toBe(8)
    expect(managedValue.value.amount).toBe(8)
    expect(directValidationErrors).toHaveBeenLastCalledWith('Enter a valid number.')
    host.querySelector<HTMLButtonElement>('button[type="submit"]')?.click()
    await settle()
    expect(submitted).not.toHaveBeenCalled()
    expect(host.textContent).toContain('Enter a valid number.')

    for (const input of inputs) {
      input.value = '6'
      input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: '6' }))
    }
    await settle()

    expect(directValue.value).toBe(6)
    expect(managedValue.value.amount).toBe(6)
    expect(directValidationErrors).toHaveBeenLastCalledWith(undefined)
    expect(host.textContent).not.toContain('Enter a valid number.')
    host.querySelector<HTMLButtonElement>('button[type="submit"]')?.click()
    await vi.waitFor(() => expect(submitted).toHaveBeenCalledOnce())
    expect(submitted.mock.calls[0]?.[0].amount).toBe(6)

    for (const input of inputs) {
      input.value = ''
      input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward', data: null }))
    }
    await settle()

    expect(directValue.value).toBeUndefined()
    expect(managedValue.value.amount).toBeUndefined()
    host.querySelector<HTMLButtonElement>('button[type="submit"]')?.click()
    await vi.waitFor(() => expect(submitted).toHaveBeenCalledTimes(2))
    expect(submitted.mock.calls[1]?.[0].amount).toBeUndefined()

    for (const input of inputs) {
      input.value = '4'
      input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: '4' }))
    }
    await settle()

    expect(directValue.value).toBe(4)
    expect(managedValue.value.amount).toBe(4)
    host.querySelector<HTMLButtonElement>('button[type="submit"]')?.click()
    await vi.waitFor(() => expect(submitted).toHaveBeenCalledTimes(3))
    expect(submitted.mock.calls[2]?.[0].amount).toBe(4)
  })

  it('blocks Enter after a post-write failure and keeps the warning visible', async () => {
    const submit = vi.fn(async () => {
      throw Object.assign(new Error('The write may have completed.'), { postWrite: true })
    })
    const host = document.createElement('div')
    document.body.append(host)
    const app = createApp(defineComponent({
      setup: () => () => h(Form, {
        schema: z.object({ name: z.string() }),
        fields: { name: { renderer: 'text' } },
        initialData: { name: 'Ada' },
        submit,
      }),
    }))
    app.use(FrameworkPlugin, { queryClient: createFrameworkQueryClient({ retry: 0, staleTime: 0 }) })
    app.mount(host)
    apps.push(app)
    await settle()

    const name = host.querySelector<HTMLInputElement>('input[id$="-field-name"]')
    const save = host.querySelector<HTMLButtonElement>('button[type="submit"]')
    if (!name || !save) throw new Error('The Form controls did not render.')
    await userEvent.click(save)
    await vi.waitFor(() => expect(submit).toHaveBeenCalledOnce())
    expect(save.disabled).toBe(true)
    expect(host.textContent).toContain('Check the record before starting another save.')

    await userEvent.click(name)
    await userEvent.keyboard('{Enter}')
    await settle()

    expect(submit).toHaveBeenCalledOnce()
    expect(host.textContent).toContain('Check the record before starting another save.')
  })
})
