import { afterEach, describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { createApp, defineComponent, h, nextTick, ref, type App } from 'vue'
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
import CheckboxGroupInput from '../../inputs/CheckboxGroupInput.vue'
import RadioGroupInput from '../../inputs/RadioGroupInput.vue'
import TextInput from '../../inputs/TextInput.vue'
import TextareaInput from '../../inputs/TextareaInput.vue'
import './browser.css'

const apps: App[] = []

async function settle() {
  await nextTick()
  await Promise.resolve()
  await nextTick()
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
    const host = document.createElement('div')
    document.body.append(host)
    const app = createApp(defineComponent({
      setup: () => () => h(Form, {
        ...form,
        modelValue: modelValue.value,
        'onUpdate:modelValue': (value) => { modelValue.value = value },
      }),
    }))
    app.use(FrameworkPlugin, { queryClient: createFrameworkQueryClient({ retry: 0, staleTime: 0 }) })
    app.mount(host)
    apps.push(app)
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
    const load = vi.fn(async ({ searchParameters }: RecordLoadContext) => ({
      name: `Prepared ${String(searchParameters.invitation)}`,
    }))
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
    const host = document.createElement('div')
    document.body.append(host)
    const app = createApp(defineComponent({ setup: () => () => h(Form, { ...bound.form }) }))
    app.use(FrameworkPlugin, { queryClient: createFrameworkQueryClient({ retry: 0, staleTime: 0 }) })
    app.mount(host)
    apps.push(app)

    await vi.waitFor(async () => {
      await settle()
      const input = host.querySelector<HTMLInputElement>('input[id$="-field-name"]')
      expect(input?.value).toBe('Prepared from invitation')
      expect(input?.placeholder).toBe('Workspace North')
    })

    expect(load).toHaveBeenCalledOnce()
    expect(load.mock.calls[0]?.[0]).toMatchObject({ searchParameters: { invitation: 'from invitation' } })
  })

  it('keeps remote selections across resolver reevaluation for Select, Radio, Checkbox, and Lookup fields', async () => {
    const optionSchema = z.object({ id: z.string(), name: z.string() })
    type Option = z.output<typeof optionSchema>
    type Draft = { note?: string | null; selectId?: string | null; radioId?: string | null; checked?: Option[] | null; lookupId?: string | null }
    const option = { id: 'one', name: 'One' }
    const selectLoad = vi.fn(async () => [option])
    const radioLoad = vi.fn(async () => [option])
    const checkboxLoad = vi.fn(async () => [option])
    const lookupOptionsLoad = vi.fn(async () => ({ data: [option], meta: { total: 1, page: 1, pageSize: 5 } }))
    const lookupDetailLoad = vi.fn(async () => option)
    const table = defineTable({ schema: optionSchema, columns: { name: {} } })
    const form = defineForm({
      schema: z.object({ note: z.string(), selectId: z.string(), radioId: z.string(), checked: z.array(optionSchema), lookupId: z.string() }),
      fields: {
        note: { renderer: 'text' },
        selectId: ({ draft }) => ({
          renderer: 'select',
          span: draft.note ? 6 : 12,
          props: { load: async () => selectLoad(), pick: 'id', view: 'name', namespace: 'resolver-select' },
        }),
        radioId: ({ draft }) => ({
          renderer: 'radio',
          span: draft.note ? 6 : 12,
          props: { load: async () => radioLoad(), pick: 'id', view: 'name', namespace: 'resolver-radio' },
        }),
        checked: ({ draft }) => ({
          renderer: 'checkbox-group',
          span: draft.note ? 6 : 12,
          props: { load: async () => checkboxLoad(), pick: 'id', view: 'name', namespace: 'resolver-checkbox' },
        }),
        lookupId: ({ draft }) => ({
          renderer: 'lookup',
          span: draft.note ? 6 : 12,
          props: {
            table,
            load: async () => lookupOptionsLoad(),
            loadDetail: async () => lookupDetailLoad(),
            pick: 'id',
            view: 'name',
          },
        }),
      },
    })
    const modelValue = ref<Draft>({ note: '', selectId: 'one', radioId: 'one', checked: [option], lookupId: 'one' })
    const host = document.createElement('div')
    document.body.append(host)
    const app = createApp(defineComponent({
      setup: () => () => h(Form, {
        ...form,
        modelValue: modelValue.value,
        'onUpdate:modelValue': (value) => { modelValue.value = value },
      }),
    }))
    app.use(FrameworkPlugin, { queryClient: createFrameworkQueryClient({ retry: 0, staleTime: 0 }) })
    app.mount(host)
    apps.push(app)
    await vi.waitFor(async () => {
      await settle()
      expect(host.querySelector('[role="radiogroup"]')).not.toBeNull()
      expect(host.querySelector('[role="group"]')).not.toBeNull()
      expect(host.textContent).toContain('One')
      expect(host.querySelector('[id$="-field-lookupId"]')?.textContent?.trim()).toBe('One')
      expect(selectLoad).toHaveBeenCalledOnce()
      expect(radioLoad).toHaveBeenCalledOnce()
      expect(checkboxLoad).toHaveBeenCalledOnce()
      expect(lookupOptionsLoad).toHaveBeenCalledOnce()
      expect(lookupDetailLoad).toHaveBeenCalledOnce()
    })

    const radio = host.querySelector<HTMLInputElement>('input[type="radio"]')
    const checkbox = host.querySelector<HTMLInputElement>('input[type="checkbox"]')
    const note = host.querySelector<HTMLInputElement>('input[id$="-field-note"]')
    if (!radio || !checkbox || !note) throw new Error('The remote Form controls did not render.')
    expect(radio.checked).toBe(true)
    expect(checkbox.checked).toBe(true)

    await userEvent.fill(note, 'Changed')
    await settle()

    expect.soft(modelValue.value).toMatchObject({ note: 'Changed', selectId: 'one', radioId: 'one', checked: [option], lookupId: 'one' })
    expect.soft(radio.checked).toBe(true)
    expect.soft(checkbox.checked).toBe(true)
    expect.soft(host.querySelector('[id$="-field-selectId"]')?.textContent).toContain('One')
    expect.soft(selectLoad).toHaveBeenCalledOnce()
    expect.soft(radioLoad).toHaveBeenCalledOnce()
    expect.soft(checkboxLoad).toHaveBeenCalledOnce()
    expect.soft(lookupOptionsLoad).toHaveBeenCalledOnce()
    expect.soft(lookupDetailLoad).toHaveBeenCalledOnce()
    expect.soft(host.querySelector('[id$="-field-lookupId"]')?.textContent?.trim()).toBe('One')
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
    const host = document.createElement('div')
    document.body.append(host)
    const app = createApp(defineComponent({
      setup: () => () => h('div', [
        h('section', { 'data-context-case': 'local-without-outer' }, [
          h(Form, { ...localForm, modelValue: { ownerId: 'one', scopeLabel: '' } }),
        ]),
        h('section', { 'data-context-case': 'local-with-outer' }, [
          h(Form, { ...localForm, modelValue: { ownerId: 'one', scopeLabel: '' }, context: { workspaceId: 'Outer replacement' } }),
        ]),
        h('section', { 'data-context-case': 'inherited' }, [
          h(Form, { ...inheritedForm, modelValue: { ownerId: 'one', scopeLabel: '' }, context: { workspaceId: 'Outer inherited' } }),
        ]),
      ]),
    }))
    app.use(FrameworkPlugin, { queryClient: createFrameworkQueryClient({ retry: 0, staleTime: 0 }) })
    app.mount(host)
    apps.push(app)
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

  it('forwards canonical props to native controls and keeps direct and managed models live', async () => {
    const directValue = ref<string | number | undefined>('Direct value')
    const managedValue = ref<{ name?: string | null }>({ name: 'Managed value' })
    const directAttributes = ref({
      autocomplete: 'name',
      inputmode: 'text' as const,
      maxlength: 40,
      'data-phase': 'initial',
    })
    const directInputEvents: Event[] = []
    const managedInputEvents: Event[] = []
    const form = defineForm({
      schema: z.object({ name: z.string().min(1) }),
      fields: {
        name: {
          renderer: 'text',
          props: {
            id: 'managed-name',
            name: 'managedName',
            autocomplete: 'email',
            inputmode: 'email',
            maxlength: 80,
            'aria-describedby': 'managed-hint',
            'data-control': 'managed',
            onInput: (event: Event) => managedInputEvents.push(event),
          },
        },
      },
    })
    const host = document.createElement('div')
    document.body.append(host)
    const app = createApp(defineComponent({
      setup: () => () => h('div', [
        h(TextInput, {
          ...directAttributes.value,
          id: 'direct-name',
          name: 'directName',
          'aria-describedby': 'direct-hint',
          class: 'direct-wrapper',
          style: { marginTop: '4px' },
          modelValue: directValue.value,
          'onUpdate:modelValue': (value: string | number | undefined) => { directValue.value = value },
          onInput: (event: Event) => directInputEvents.push(event),
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
    expect(directInput.id).toBe('direct-name')
    expect(directInput.name).toBe('directName')
    expect(directInput.autocomplete).toBe('name')
    expect(directInput.getAttribute('inputmode')).toBe('text')
    expect(directInput.maxLength).toBe(40)
    expect(directInput.getAttribute('aria-describedby')).toBe('direct-hint')
    expect(directInput.getAttribute('data-phase')).toBe('initial')
    expect(directInput.classList.contains('direct-wrapper')).toBe(false)
    expect(directInput.closest('.direct-wrapper')?.style.marginTop).toBe('4px')
    expect(managedInput.id).toBe('managed-name')
    expect(managedInput.name).toBe('managedName')
    expect(managedInput.autocomplete).toBe('email')
    expect(managedInput.getAttribute('inputmode')).toBe('email')
    expect(managedInput.maxLength).toBe(80)
    expect(managedInput.required).toBe(true)
    expect(managedInput.getAttribute('aria-describedby')).toBe('managed-hint')
    expect(managedInput.getAttribute('data-control')).toBe('managed')
    expect(host.querySelector<HTMLLabelElement>('label[for="managed-name"]')?.htmlFor).toBe('managed-name')

    directAttributes.value = {
      autocomplete: 'username',
      inputmode: 'numeric',
      maxlength: 18,
      'data-current': 'updated',
    }
    await settle()

    expect(directInput.autocomplete).toBe('username')
    expect(directInput.getAttribute('inputmode')).toBe('numeric')
    expect(directInput.maxLength).toBe(18)
    expect(directInput.hasAttribute('data-phase')).toBe(false)
    expect(directInput.getAttribute('data-current')).toBe('updated')

    directInput.value = 'Changed directly'
    directInput.dispatchEvent(new Event('input', { bubbles: true }))
    managedInput.value = 'Changed in form'
    managedInput.dispatchEvent(new Event('input', { bubbles: true }))
    await settle()

    expect(directValue.value).toBe('Changed directly')
    expect(managedValue.value.name).toBe('Changed in form')
    expect(directInputEvents).toHaveLength(1)
    expect(managedInputEvents).toHaveLength(1)
    expect(directInput.value).toBe('Changed directly')
    expect(managedInput.value).toBe('Changed in form')
  })

  it('links direct and managed helper and error messages to their controls', async () => {
    const directValue = ref('Ada')
    const directHelper = ref('Use your full name.')
    const directError = ref('Enter a valid name.')
    const submitted = vi.fn(async (value: { name: string }) => value)
    const form = defineForm({
      schema: z.object({ name: z.string().min(2, 'Enter at least two characters.') }),
      fields: {
        name: {
          renderer: 'text',
          props: {
            id: 'managed-name',
            helperMessage: 'Use the name on the account.',
            'aria-describedby': 'managed-authored-hint',
          },
        },
      },
      submit: submitted,
    })
    const host = document.createElement('div')
    document.body.append(host)
    const app = createApp(defineComponent({
      setup: () => () => h('div', [
        h(TextInput, {
          id: 'direct-name',
          label: 'Direct name',
          helperMessage: directHelper.value,
          error: directError.value,
          required: true,
          'aria-describedby': 'direct-authored-hint',
          modelValue: directValue.value,
          'onUpdate:modelValue': (value: string | number | undefined) => { directValue.value = String(value ?? '') },
        }),
        h(Form, { ...form, initialData: { name: '' } }),
      ]),
    }))
    app.use(FrameworkPlugin, { queryClient: createFrameworkQueryClient({ retry: 0, staleTime: 0 }) })
    app.mount(host)
    apps.push(app)
    await settle()

    const directInput = host.querySelector<HTMLInputElement>('#direct-name')!
    const directDescriptions = directInput.getAttribute('aria-describedby')?.split(/\s+/) ?? []
    const directHelperNode = document.getElementById(directDescriptions.find((id) => id !== 'direct-authored-hint')!)
    const directErrorNode = host.querySelector<HTMLElement>('[role="alert"]')!
    expect(directDescriptions).toContain('direct-authored-hint')
    expect(directDescriptions).toContain(directHelperNode?.id)
    expect(directDescriptions).toContain(directErrorNode.id)
    expect(directHelperNode?.textContent).toBe('Use your full name.')
    expect(directErrorNode.textContent).toBe('Enter a valid name.')
    expect(directInput.required).toBe(true)
    expect(directInput.getAttribute('aria-invalid')).toBe('true')
    expect(directInput.compareDocumentPosition(directHelperNode!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(directHelperNode?.compareDocumentPosition(directErrorNode) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    const managedInput = host.querySelector<HTMLInputElement>('#managed-name')!
    host.querySelector<HTMLFormElement>('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await vi.waitFor(() => expect(host.querySelectorAll('[role="alert"]')).toHaveLength(2))

    const managedDescriptions = managedInput.getAttribute('aria-describedby')?.split(/\s+/) ?? []
    const managedHelper = document.getElementById(managedDescriptions.find((id) => id !== 'managed-authored-hint')!)
    const managedErrorId = managedDescriptions.find((id) => id !== 'managed-authored-hint' && id !== managedHelper?.id)
    const managedError = managedErrorId ? document.getElementById(managedErrorId) : null
    expect(managedDescriptions).toContain('managed-authored-hint')
    expect(managedHelper?.textContent).toBe('Use the name on the account.')
    expect(managedError?.textContent).toBe('Enter at least two characters.')
    expect(managedInput.getAttribute('aria-invalid')).toBe('true')
    expect(managedDescriptions).toContain(managedError?.id)
    expect(managedHelper?.id).not.toBe(directHelperNode?.id)
    expect(managedError?.id).not.toBe(directErrorNode.id)

    const directErrorId = directErrorNode.id
    directError.value = 'Update the direct error.'
    await settle()
    expect(document.getElementById(directErrorId)?.textContent).toBe('Update the direct error.')
    directError.value = ''
    await settle()
    expect(document.getElementById(directErrorId)).toBeNull()
    expect(directInput.getAttribute('aria-describedby')?.split(/\s+/)).toEqual(['direct-authored-hint', directHelperNode?.id])
    expect(directInput.getAttribute('aria-invalid')).not.toBe('true')
    directHelper.value = 'Updated direct helper.'
    await settle()
    expect(document.getElementById(directHelperNode!.id)?.textContent).toBe('Updated direct helper.')
    app.unmount()
  })

  it('links Switch and label-suppressed checkbox messages to their controls', async () => {
    const submitted = vi.fn(async (value: { enabled: boolean; confirmed: boolean }) => value)
    const form = defineForm({
      schema: z.object({
        enabled: z.boolean().refine(Boolean, 'Turn on access.'),
        confirmed: z.boolean().refine(Boolean, 'Confirm access.'),
      }),
      fields: {
        enabled: { renderer: 'switch', props: { helperMessage: 'Controls account access.' } },
        confirmed: { renderer: 'checkbox', props: { helperMessage: 'Confirms account access.' } },
      },
      submit: submitted,
    })
    const host = document.createElement('div')
    document.body.append(host)
    const app = createApp(defineComponent({
      setup: () => () => h(Form, { ...form, initialData: { enabled: false, confirmed: false } }),
    }))
    app.use(FrameworkPlugin, { queryClient: createFrameworkQueryClient({ retry: 0, staleTime: 0 }) })
    app.mount(host)
    apps.push(app)
    await vi.waitFor(async () => {
      await settle()
      expect(host.querySelector('button[type="submit"]')).not.toBeNull()
      expect(host.querySelector('input[type="checkbox"]')).not.toBeNull()
    })

    host.querySelector<HTMLFormElement>('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await vi.waitFor(() => expect(host.querySelectorAll('[role="alert"]')).toHaveLength(2))

    const enabledField = host.querySelector<HTMLElement>('.is-form-field')!
    const switchControl = enabledField.querySelector<HTMLButtonElement>('button[type="button"]')!
    const switchMessages = Array.from(enabledField.querySelectorAll<HTMLElement>('[id$="-helper"], [role="alert"]'))
    expect(switchControl.id).toBe(enabledField.querySelector('label')?.htmlFor)
    expect(switchControl.getAttribute('aria-invalid')).toBe('true')
    expect(switchMessages.map((message) => message.textContent)).toEqual(['Controls account access.', 'Turn on access.'])
    expect(switchMessages.map((message) => message.id)).toEqual(switchControl.getAttribute('aria-describedby')?.split(/\s+/))

    const checkboxField = host.querySelectorAll<HTMLElement>('.is-form-field')[1]!
    const checkbox = checkboxField.querySelector<HTMLInputElement>('input[type="checkbox"]')!
    const checkboxMessages = Array.from(checkboxField.querySelectorAll<HTMLElement>('[id$="-helper"], [role="alert"]'))
    expect(checkbox.id).toBe(checkboxField.querySelector('label')?.htmlFor)
    expect(checkbox.getAttribute('aria-invalid')).toBe('true')
    expect(checkboxMessages.map((message) => message.textContent)).toEqual(['Confirms account access.', 'Confirm access.'])
    expect(checkboxMessages.map((message) => message.id)).toEqual(checkbox.getAttribute('aria-describedby')?.split(/\s+/))
  })

  it('keeps required choice groups valid after one choice is selected', async () => {
    const checkboxValue = ref<Array<string | number | Record<string, unknown>>>([])
    const radioValue = ref<string | undefined>()
    const choices = [{ id: 'read', name: 'Read' }, { id: 'write', name: 'Write' }]
    const host = document.createElement('div')
    document.body.append(host)
    const app = createApp(defineComponent({
      setup: () => () => h('form', { novalidate: false }, [
        h(CheckboxGroupInput, {
          label: 'Permissions',
          data: choices,
          required: true,
          modelValue: checkboxValue.value,
          'onUpdate:modelValue': (value: Array<string | number | Record<string, unknown>>) => { checkboxValue.value = value },
        }),
        h(RadioGroupInput, {
          label: 'Account type',
          data: [{ id: 'person', name: 'Person' }, { id: 'team', name: 'Team' }],
          required: true,
          modelValue: radioValue.value,
          'onUpdate:modelValue': (value: string | number | undefined) => { radioValue.value = String(value ?? '') || undefined },
        }),
      ]),
    }))
    app.use(FrameworkPlugin, { queryClient: createFrameworkQueryClient({ retry: 0, staleTime: 0 }) })
    app.mount(host)
    apps.push(app)
    await settle()

    const formElement = host.querySelector<HTMLFormElement>('form')!
    expect(formElement.noValidate).toBe(false)
    expect(host.querySelector('[role="group"]')?.getAttribute('aria-required')).toBe('true')
    expect(host.querySelector('[role="radiogroup"]')?.getAttribute('aria-required')).toBe('true')
    expect(formElement.checkValidity()).toBe(false)

    const read = host.querySelector<HTMLInputElement>('input[type="checkbox"]')!
    read.click()
    const radios = host.querySelectorAll<HTMLInputElement>('input[type="radio"]')
    expect(radios).toHaveLength(2)
    radios[0]!.click()
    await settle()

    expect(formElement.checkValidity()).toBe(true)
    expect(checkboxValue.value).toEqual([choices[0]])
    expect(radioValue.value).toBe('person')
    expect([...host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].filter((input) => input.checked)).toHaveLength(1)
    expect([...host.querySelectorAll<HTMLInputElement>('input[type="radio"]')].filter((input) => input.checked)).toHaveLength(1)
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

  it('keeps invalid numeric Textarea drafts local in direct and managed controls', async () => {
    const directValue = ref<string | number | undefined>(8)
    const managedValue = ref<{ amount?: number }>({ amount: 8 })
    const directValidationErrors = vi.fn()
    const submitted = vi.fn(async (value: { amount?: number }) => value)
    const form = defineForm({
      schema: z.object({ amount: z.number().optional() }),
      fields: { amount: { renderer: 'textarea', props: { constraint: ['number'] as const } } },
      submit: submitted,
    })
    const host = document.createElement('div')
    document.body.append(host)
    const app = createApp(defineComponent({
      setup: () => () => h('div', [
        h(TextareaInput, {
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
    await vi.waitFor(async () => {
      await settle()
      expect(host.querySelectorAll('textarea')).toHaveLength(2)
    })

    const textareas = host.querySelectorAll<HTMLTextAreaElement>('textarea')
    const directTextarea = textareas[0]!
    const managedTextarea = textareas[1]!
    directTextarea.value = '.'
    directTextarea.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: '.' }))
    managedTextarea.value = '.'
    managedTextarea.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: '.' }))
    await settle()

    expect(directTextarea.value).toBe('.')
    expect(managedTextarea.value).toBe('.')
    expect(directValue.value).toBe(8)
    expect(managedValue.value.amount).toBe(8)
    expect(directValidationErrors).toHaveBeenLastCalledWith('Enter a valid number.')

    const overflow = '9'.repeat(400)
    for (const textarea of textareas) {
      textarea.value = overflow
      textarea.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste', data: overflow }))
    }
    await settle()
    expect(directTextarea.value).toBe(overflow)
    expect(managedTextarea.value).toBe(overflow)
    expect(directValue.value).toBe(8)
    expect(managedValue.value.amount).toBe(8)
    expect(directValidationErrors).toHaveBeenLastCalledWith('Enter a valid number.')
    host.querySelector<HTMLButtonElement>('button[type="submit"]')?.click()
    await settle()
    expect(submitted).not.toHaveBeenCalled()
    expect(host.textContent).toContain('Enter a valid number.')

    for (const textarea of textareas) {
      textarea.value = '12abc'
      textarea.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste', data: '12abc' }))
    }
    await settle()
    expect(directValue.value).toBe(8)
    expect(managedValue.value.amount).toBe(8)
    expect(managedTextarea.value).toBe('12abc')

    for (const textarea of textareas) {
      textarea.value = '6'
      textarea.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: '6' }))
    }
    await settle()

    expect(directValue.value).toBe(6)
    expect(managedValue.value.amount).toBe(6)
    expect(directValidationErrors).toHaveBeenLastCalledWith(undefined)
    expect(host.textContent).not.toContain('Enter a valid number.')
    host.querySelector<HTMLButtonElement>('button[type="submit"]')?.click()
    await vi.waitFor(() => expect(submitted).toHaveBeenCalledOnce())
    expect(submitted.mock.calls[0]?.[0].amount).toBe(6)
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
