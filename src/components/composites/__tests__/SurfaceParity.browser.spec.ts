import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref, shallowRef, type App } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { z } from 'zod'
import type { FormDefinition, FormDraft, FormFields } from '../../../contracts/forms'
import { formNativeAttributeNames } from '../../../forms/props'
import { defineForm } from '../../../forms/defineForm'
import { FrameworkPlugin } from '../../../adapters/plugin'
import { createFrameworkQueryClient } from '../../../query'
import { defineResource, resetResourceRuntimeForTests } from '../../../resources'
import DialogForm from '../DialogForm.vue'
import Form from '../../core/Form.vue'
import FormView from '../../views/FormView.vue'
import { deferred, flush, mountCore } from '../../core/__tests__/harness'

const apps: App[] = []
const mountedForms: Array<ReturnType<typeof mountCore>> = []
type ParitySurface = 'form' | 'dialog' | 'view' | 'resource'
type OwnerValues = Partial<Record<ParitySurface, unknown>>
type OwnerSetters = Partial<Record<ParitySurface, (value: unknown) => void>>
type Owner = { id: string; name: string; profile: { region: string } }

function form(name: string): HTMLFormElement {
  const value = document.body.querySelector<HTMLFormElement>(`form[name="${name}"]`)
  if (!value) throw new Error(`Form "${name}" did not render.`)
  return value
}

function viewForm(host: HTMLElement): HTMLFormElement {
  const value = host.querySelector<HTMLFormElement>('.is-form-view form')
  if (!value) throw new Error('FormView did not render its form.')
  return value
}

function field(formElement: HTMLFormElement, key: string): HTMLInputElement {
  const value = formElement.querySelector<HTMLInputElement>(`[id$="-field-${key}"]`)
  if (!value) throw new Error(`Form field "${key}" did not render.`)
  return value
}

function enter(formElement: HTMLFormElement, key: string, value: string): void {
  const input = field(formElement, key)
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

function ownerSlot(
  surface: ParitySurface,
  firstValues: OwnerValues,
  currentValues: OwnerValues,
  setters: OwnerSetters,
) {
  return (scope: Record<string, unknown>) => {
    if (!Object.hasOwn(firstValues, surface)) firstValues[surface] = scope.value
    currentValues[surface] = scope.value
    const setValue = scope.setValue
    if (typeof setValue !== 'function') throw new Error('The owner slot did not receive setValue().')
    setters[surface] = (value) => setValue(value)
    return h('span', { [`data-owner-${surface}`]: '' }, 'Owners')
  }
}

async function mountParity(useConstructor: boolean) {
  const schema = z.object({
    name: z.string().transform((value) => {
      transformCalls += 1
      return `${value}:parsed`
    }),
    dependent: z.string().optional(),
    owners: z.array(z.object({ id: z.string(), name: z.string(), profile: z.object({ region: z.string() }) })).optional(),
    hidden: z.string().optional(),
    retained: z.string(),
  })
  type Input = z.input<typeof schema>
  type Output = z.output<typeof schema>
  type Submitted = Output & { id: string }
  const fields = {
    name: { renderer: 'text', initialValue: () => `show-default-${++defaultCalls}` },
    dependent: {
      renderer: 'text',
      initialValue: () => `dependent-${++defaultCalls}`,
      behavior: { visible: ({ draft }: { draft: FormDraft<Input> }) => draft.name?.startsWith('show') === true },
    },
    owners: {
      renderer: 'select',
      props: { multi: true, asWhole: true },
      initialValue: () => {
        ownerFactoryCalls += 1
        return [{ id: 'owner-default', name: 'Owner', profile: { region: 'East' } }]
      },
    },
    hidden: { renderer: 'text', initialValue: () => `hidden-${++defaultCalls}`, behavior: { visible: () => false } },
  } satisfies FormFields<Input>
  const labels = { name: 'Name', dependent: 'Dependent', owners: 'Owners', hidden: 'Hidden' }
  const validators = [{
    validate: async ({ data }: { data: Output }) => {
      validatorValues.push(data.name)
      await Promise.resolve()
    },
  }]
  const originalSubmit = async (data: Output): Promise<Submitted> => {
    originalCalls += 1
    originalValues.push(data)
    return { id: 'saved-user', ...data }
  }
  const definition = { schema, fields, labels, validators, submit: originalSubmit } satisfies FormDefinition<Input, Output, Submitted>
  const constructor = defineForm(definition)
  const selectedDefinition = useConstructor ? constructor : definition
  const initialData = { retained: 'retained without a control' }
  const formProps = { ...selectedDefinition, initialData }
  const resources = defineResource({
    key: `surface-parity-${useConstructor ? 'defined' : 'plain'}`,
    identity: (record: Submitted) => record.id,
    create: { permission: null, form: formProps },
  })
  const selectedOwner: Owner = { id: 'owner-default', name: 'Owner', profile: { region: 'East' } }
  const formSubmitted: unknown[] = []
  const dialogSubmitted: unknown[] = []
  const viewSubmitted: unknown[] = []
  const resourceSubmitted: unknown[] = []
  const dialogValues: Output[] = []
  const dialogSubmit = async (data: Output) => {
    dialogCalls += 1
    dialogValues.push(data)
    return data.name.length
  }
  const firstOwners: OwnerValues = {}
  const currentOwners: OwnerValues = {}
  const setters: OwnerSetters = {}
  const host = document.createElement('div')
  document.body.append(host)
  const Host = defineComponent({
    setup: () => () => h('main', [
      h(Form, {
        ...formProps,
        name: 'base-form',
        onSubmitted: (result: unknown) => formSubmitted.push(result),
      }, {
        'input:owners': ownerSlot('form', firstOwners, currentOwners, setters),
      }),
      h(DialogForm, {
        ...formProps,
        submit: dialogSubmit,
        name: 'dialog-form',
        open: true,
        title: 'Dialog form',
        description: 'Edit the same record in a dialog.',
        closeOnSubmitted: false,
        onSubmitted: (result: unknown) => dialogSubmitted.push(result),
      }, {
        trigger: () => h('button', { type: 'button' }, 'Dialog trigger'),
        'input:owners': ownerSlot('dialog', firstOwners, currentOwners, setters),
      }),
      h(FormView, {
        form: formProps,
        successMessage: false,
        onSubmitted: (result: unknown) => viewSubmitted.push(result),
      }, {
        'input:owners': ownerSlot('view', firstOwners, currentOwners, setters),
      }),
      h(Form, {
        ...resources.create.form,
        name: 'resource-form',
        onSubmitted: (result: unknown) => resourceSubmitted.push(result),
      }, {
        'input:owners': ownerSlot('resource', firstOwners, currentOwners, setters),
      }),
    ]),
  })
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: Host }] })
  await router.push('/')
  const app = createApp(defineComponent({ setup: () => () => h(RouterView) }))
  app.use(router)
  app.use(FrameworkPlugin, { queryClient: createFrameworkQueryClient({ retry: 0, staleTime: 0 }) })
  app.mount(host)
  await router.isReady()
  apps.push(app)
  return {
    host,
    selectedOwner,
    firstOwners,
    currentOwners,
    setters,
    formSubmitted,
    dialogSubmitted,
    viewSubmitted,
    resourceSubmitted,
    dialogValues,
  }
}

let transformCalls = 0
let defaultCalls = 0
let ownerFactoryCalls = 0
let originalCalls = 0
let dialogCalls = 0
let originalValues: Array<{ name: string; dependent?: string; owners?: Owner[]; hidden?: string; retained: string }> = []
let validatorValues: string[] = []

afterEach(() => {
  apps.splice(0).forEach((app) => app.unmount())
  mountedForms.splice(0).forEach((view) => view.unmount())
  resetResourceRuntimeForTests()
  document.body.innerHTML = ''
})

async function browserFrame(times = 4) {
  for (let attempt = 0; attempt < times; attempt += 1) {
    await Promise.resolve()
    await nextTick()
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    await nextTick()
  }
}

describe('form surface browser parity', () => {
  it('uses Form native declarations on the same form element through both surfaces', async () => {
    const runtimeProps = (Form as unknown as { props: readonly string[] | Readonly<Record<string, unknown>> }).props
    const declaredProps = new Set(Array.isArray(runtimeProps) ? runtimeProps : Object.keys(runtimeProps))
    const propName = (name: string) => name.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase())
    const compareNames = formNativeAttributeNames.filter((name) =>
      name !== 'class'
      && name !== 'style'
      && name !== 'hidden'
      && name !== 'inert',
    )
    for (const name of compareNames.filter((entry) => !entry.startsWith('aria-') && entry !== 'data-testid')) {
      expect(declaredProps.has(propName(name)), name).toBe(true)
    }
    const nativeValues = Object.fromEntries(compareNames.map((name) => [
      name,
      name.startsWith('aria-') ? 'true' : {
        acceptCharset: 'utf-8',
        novalidate: false,
        action: '/users',
        autocomplete: 'off',
        enctype: 'multipart/form-data',
        method: 'post',
        target: '_self',
        accesskey: 'f',
        contenteditable: 'false',
        dir: 'ltr',
        draggable: 'false',
        lang: 'en',
        role: 'form',
        spellcheck: 'false',
        tabindex: 0,
      }[name] ?? 'test-value',
    ]))
    const schema = z.object({ name: z.string() })
    const formProps = {
      schema,
      fields: { name: { renderer: 'text' } },
      initialData: { name: 'Ada' },
      submit: async () => 'saved',
      ...nativeValues,
    }
    const host = document.createElement('div')
    document.body.append(host)
    const app = createApp(defineComponent({
      setup: () => () => h('main', [
        h(Form, { ...formProps, name: 'direct-form' }),
        h(DialogForm, { ...formProps, name: 'dialog-form', open: true, title: 'Edit user', description: 'Update user details.' }),
      ]),
    }))
    app.use(FrameworkPlugin, { queryClient: createFrameworkQueryClient({ retry: 0, staleTime: 0 }) })
    app.mount(host)
    apps.push(app)

    await vi.waitFor(() => expect(document.body.querySelectorAll('form')).toHaveLength(2))
    const directForm = document.body.querySelector<HTMLFormElement>('form[name="direct-form"]')!
    const dialogForm = document.body.querySelector<HTMLFormElement>('form[name="dialog-form"]')!
    const actualNativeProps = [...declaredProps]
      .map((name) => name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`))
      .filter((name) => compareNames.some((compareName) => (compareName === 'acceptCharset' ? 'accept-charset' : compareName) === name) && name !== 'name')
    for (const name of actualNativeProps) {
      expect(directForm.getAttribute(name)).toBe(dialogForm.getAttribute(name))
      expect(directForm.hasAttribute(name)).toBe(name !== 'novalidate')
    }
    for (const name of compareNames.filter((entry) => entry.startsWith('aria-'))) {
      expect(directForm.getAttribute(name)).toBe(dialogForm.getAttribute(name))
      expect(directForm.getAttribute(name)).not.toBeNull()
    }
  })

  it('forwards current ARIA and data attributes but filters undeclared attributes', async () => {
    const attributes = shallowRef<Record<string, unknown>>({
      schema: z.object({ name: z.string() }),
      fields: { name: { renderer: 'text' } },
      initialData: { name: 'Ada' },
      submit: async () => 'saved',
      'aria-label': 'Before update',
      'data-testid': 'before-update',
      'not-supported': 'ignored',
    })
    const host = document.createElement('div')
    document.body.append(host)
    const app = createApp(defineComponent({
      setup: () => () => h('main', [
        h(Form, { ...attributes.value, name: 'direct-form' }),
        h(DialogForm, {
          ...attributes.value,
          name: 'dialog-form',
          open: true,
          title: 'Attribute forwarding',
          description: 'Check the current native attribute contract.',
        }),
      ]),
    }))
    app.use(FrameworkPlugin, { queryClient: createFrameworkQueryClient({ retry: 0, staleTime: 0 }) })
    app.mount(host)
    apps.push(app)

    const directForm = () => host.querySelector<HTMLFormElement>('form[name="direct-form"]')
    const dialogForm = () => document.body.querySelector<HTMLFormElement>('form[name="dialog-form"]')
    await vi.waitFor(() => expect(dialogForm()).not.toBeNull())
    for (const nativeForm of [directForm(), dialogForm()]) {
      expect(nativeForm?.getAttribute('aria-label')).toBe('Before update')
      expect(nativeForm?.getAttribute('data-testid')).toBe('before-update')
      expect(nativeForm?.hasAttribute('not-supported')).toBe(false)
    }

    const next = { ...attributes.value, 'aria-label': 'After update', 'data-live': 'added' }
    delete next['data-testid']
    attributes.value = next
    await browserFrame()
    for (const nativeForm of [directForm(), dialogForm()]) {
      expect(nativeForm?.getAttribute('aria-label')).toBe('After update')
      expect(nativeForm?.hasAttribute('data-testid')).toBe(false)
      expect(nativeForm?.getAttribute('data-live')).toBe('added')
      expect(nativeForm?.hasAttribute('not-supported')).toBe(false)
    }

    const removed = { ...attributes.value }
    delete removed['aria-label']
    delete removed['data-live']
    attributes.value = removed
    await browserFrame()
    for (const nativeForm of [directForm(), dialogForm()]) {
      expect(nativeForm?.hasAttribute('aria-label')).toBe(false)
      expect(nativeForm?.hasAttribute('data-live')).toBe(false)
      expect(nativeForm?.hasAttribute('not-supported')).toBe(false)
    }
  })

  it('forwards current DialogForm prop presence and native attributes', async () => {
    const schema = z.object({ name: z.string() })
    const fields = { name: { renderer: 'text' } }
    const nativeProps = shallowRef<Record<string, unknown>>({
      schema,
      fields,
      submit: async () => 'saved',
      name: 'live-form',
      'aria-label': 'Initial editor',
      'data-testid': 'live-editor',
    })
    const model = ref<Record<string, unknown> | undefined>()
    const modelUpdates: Record<string, unknown>[] = []
    const validatorContexts: Record<string, unknown>[] = []
    const load = vi.fn(async () => ({}))
    const overriddenSubmit = vi.fn(async () => 'overridden')
    const exposed = ref<Record<string, unknown> | null>(null)
    const host = document.createElement('div')
    document.body.append(host)
    const app = createApp(defineComponent({
      setup: () => () => h(DialogForm, {
        ...nativeProps.value,
        open: true,
        title: 'Live editor',
        description: 'Edit the current record.',
        closeOnSubmitted: false,
        ref: (value: unknown) => { exposed.value = value as Record<string, unknown> | null },
        'onUpdate:modelValue': (value: Record<string, unknown>) => {
          modelUpdates.push(value)
          model.value = value
          if (Object.hasOwn(nativeProps.value, 'modelValue')) nativeProps.value = { ...nativeProps.value, modelValue: value }
        },
      }, {
        'input:name': (scope: Record<string, unknown>) => {
          const setValue = scope.setValue
          if (typeof setValue !== 'function') throw new Error('DialogForm did not forward Form input slot scope.')
          return h('input', {
            'data-live-input': '',
            value: String(scope.value ?? ''),
            disabled: scope.disabled === true,
            onInput: (event: Event) => setValue((event.target as HTMLInputElement).value),
          })
        },
      }),
    }))
    app.use(FrameworkPlugin, { queryClient: createFrameworkQueryClient({ retry: 0, staleTime: 0 }) })
    app.mount(host)
    apps.push(app)

    const dialogForm = () => document.body.querySelector<HTMLFormElement>('[role="dialog"] form')
    const liveInput = () => document.body.querySelector<HTMLInputElement>('[role="dialog"] [data-live-input]')
    await vi.waitFor(() => expect(dialogForm()?.getAttribute('name')).toBe('live-form'))
    expect(dialogForm()?.getAttribute('aria-label')).toBe('Initial editor')
    expect(dialogForm()?.getAttribute('data-testid')).toBe('live-editor')

    nativeProps.value = {
      ...nativeProps.value,
      disabled: true,
      initialData: { name: 'Live initial' },
      validators: [{ validate: async ({ context }: { context: Record<string, unknown> }) => { validatorContexts.push(context) } }],
      'aria-label': 'Changed editor',
    }
    await browserFrame()
    expect(liveInput()?.disabled).toBe(true)
    expect(liveInput()?.value).toBe('Live initial')
    expect(dialogForm()?.getAttribute('aria-label')).toBe('Changed editor')

    delete nativeProps.value.disabled
    nativeProps.value = { ...nativeProps.value, modelValue: undefined }
    await browserFrame()
    expect(liveInput()?.disabled).toBe(false)
    modelUpdates.length = 0
    const controlledInput = liveInput()!
    controlledInput.value = 'Controlled draft'
    controlledInput.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: 'Controlled draft' }))
    await browserFrame()
    expect(model.value).toEqual({ name: 'Controlled draft' })
    expect(modelUpdates).toEqual([{ name: 'Controlled draft' }])

    delete nativeProps.value.modelValue
    nativeProps.value = { ...nativeProps.value, load }
    await browserFrame()
    await vi.waitFor(() => expect(load).toHaveBeenCalledOnce())
    expect(liveInput()?.value).toBe('Live initial')
    delete nativeProps.value.initialData
    nativeProps.value = { ...nativeProps.value }
    await browserFrame()
    expect(liveInput()?.value).toBe('')
    const loadedInput = liveInput()!
    loadedInput.value = 'Uncontrolled draft'
    loadedInput.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: 'Uncontrolled draft' }))
    await browserFrame()
    expect(modelUpdates).toEqual([{ name: 'Controlled draft' }])

    delete nativeProps.value.load
    delete nativeProps.value.name
    delete nativeProps.value['data-testid']
    nativeProps.value = { ...nativeProps.value }
    await browserFrame()
    expect(dialogForm()?.hasAttribute('name')).toBe(false)
    expect(dialogForm()?.hasAttribute('data-testid')).toBe(false)
    const refresh = exposed.value?.refresh
    if (typeof refresh !== 'function') throw new Error('DialogForm did not expose Form refresh().')
    await refresh()
    expect(load).toHaveBeenCalledOnce()

    nativeProps.value = {
      ...nativeProps.value,
      context: { scope: 'current' },
      submit: overriddenSubmit,
    }
    await browserFrame()
    const submit = exposed.value?.submit
    if (typeof submit !== 'function') throw new Error('DialogForm did not expose Form submit().')
    await submit()
    expect(overriddenSubmit).toHaveBeenCalledOnce()
    expect(validatorContexts).toContainEqual({ scope: 'current' })
    delete nativeProps.value.context
    nativeProps.value = { ...nativeProps.value }
    await browserFrame()
    await submit()
    expect(overriddenSubmit).toHaveBeenCalledTimes(2)
    expect(validatorContexts.at(-1)).toEqual({})
  })

  it('does not apply a deferred close approval to a reopened or submitting session', async () => {
    const closeDecisions = [deferred<boolean>(), deferred<boolean>()]
    let closeIndex = 0
    const submitDecision = deferred<string>()
    const submitHandler = vi.fn(() => submitDecision.promise)
    const closeUpdates: boolean[] = []
    const open = ref(true)
    const exposed = ref<Record<string, unknown> | null>(null)
    const schema = z.object({ name: z.string() })
    const host = document.createElement('div')
    document.body.append(host)
    const app = createApp(defineComponent({
      setup: () => () => h(DialogForm, {
        schema,
        fields: { name: { renderer: 'text' } },
        initialData: { name: 'Ada' },
        submit: submitHandler,
        beforeClose: () => closeDecisions[closeIndex++]!.promise,
        open: open.value,
        title: 'Close test',
        description: 'Test asynchronous close ownership.',
        ref: (value: unknown) => { exposed.value = value as Record<string, unknown> | null },
        'onUpdate:open': (value: boolean) => {
          closeUpdates.push(value)
          open.value = value
        },
      }),
    }))
    app.use(FrameworkPlugin, { queryClient: createFrameworkQueryClient({ retry: 0, staleTime: 0 }) })
    app.mount(host)
    apps.push(app)

    await vi.waitFor(() => expect(document.body.querySelector('[role="dialog"]')).not.toBeNull())
    const cancel = [...document.body.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent?.trim() === 'Cancel')!
    cancel.click()
    await browserFrame()
    expect(cancel.disabled).toBe(true)

    open.value = false
    await browserFrame()
    open.value = true
    await browserFrame()
    closeDecisions[0]!.resolve(true)
    await browserFrame()
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull()
    expect(closeUpdates).toEqual([])

    const submit = exposed.value?.submit
    if (typeof submit !== 'function') throw new Error('DialogForm submit method was not exposed.')
    const secondCancel = [...document.body.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent?.trim() === 'Cancel')!
    secondCancel.click()
    await browserFrame()
    const submitting = submit() as Promise<void>
    await browserFrame()
    await vi.waitFor(() => expect(submitHandler).toHaveBeenCalledOnce())
    closeDecisions[1]!.resolve(true)
    await browserFrame()
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull()
    expect(closeUpdates).toEqual([])

    submitDecision.resolve('saved')
    await submitting
    await browserFrame()
    expect(closeUpdates).toEqual([false])
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
  })

  it('inherits FormView labels and forwards the complete actions scope', async () => {
    const schema = z.object({ name: z.string() })
    const firstSave = deferred<{ id: string }>()
    const customSave = deferred<{ id: string }>()
    const firstSubmit = vi.fn(() => firstSave.promise)
    const customSubmit = vi.fn(() => customSave.promise)
    const customScopes: Array<Record<string, unknown>> = []
    const submitted: unknown[] = []
    const host = document.createElement('div')
    document.body.append(host)
    const Host = defineComponent({
      setup: () => () => h('main', [
        h(FormView, {
          title: 'Default actions',
          form: {
            schema,
            fields: { name: { renderer: 'text' } },
            initialData: { name: 'Ada' },
            submitLabel: 'Save role',
            submittingLabel: 'Saving role',
            submit: firstSubmit,
          },
          successMessage: false,
          onSubmitted: (result: unknown) => submitted.push(result),
        }),
        h(FormView, {
          title: 'Custom actions',
          form: {
            schema,
            fields: { name: { renderer: 'text' } },
            initialData: { name: 'Grace' },
            submit: customSubmit,
          },
          successMessage: false,
          onSubmitted: (result: unknown) => submitted.push(result),
        }, {
          actions: (scope: Record<string, unknown>) => {
            customScopes.push(scope)
            return h('button', { type: 'submit', 'data-custom-save': '' }, 'Save custom')
          },
        }),
      ]),
    })
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: Host }] })
    await router.push('/')
    const app = createApp(defineComponent({ setup: () => () => h(RouterView) }))
    app.use(router)
    app.use(FrameworkPlugin, { queryClient: createFrameworkQueryClient({ retry: 0, staleTime: 0 }) })
    app.mount(host)
    await router.isReady()
    apps.push(app)

    await vi.waitFor(() => {
      expect(host.querySelector('.is-form-view-controls button[type="submit"]')?.textContent).toBe('Save role')
      expect(customScopes.length).toBeGreaterThan(0)
    })
    expect(customScopes[0]).toEqual(expect.objectContaining({
      submit: expect.any(Function),
      reset: expect.any(Function),
      submitting: false,
      submitPending: false,
      validating: false,
      dirty: false,
      inputPending: false,
    }))

    host.querySelector<HTMLButtonElement>('.is-form-view-controls button[type="submit"]')!.click()
    await browserFrame()
    expect(firstSubmit).toHaveBeenCalledOnce()
    expect(host.querySelector('.is-form-view-controls button[type="submit"]')?.textContent).toBe('Saving role')

    host.querySelector<HTMLButtonElement>('[data-custom-save]')!.click()
    await browserFrame()
    expect(customSubmit).toHaveBeenCalledOnce()
    expect(customScopes.at(-1)).toEqual(expect.objectContaining({ submitting: true, submitPending: true }))

    firstSave.resolve({ id: 'first' })
    customSave.resolve({ id: 'custom' })
    await browserFrame()
    expect(submitted).toEqual([{ id: 'first' }, { id: 'custom' }])
  })

  it('passes DateInput string models to the form schema without conversion', async () => {
    const submitResult = vi.fn(async (data: { date: string }) => data.date)
    const view = mountCore(Form, {
      schema: z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
      fields: { date: { renderer: 'date', props: { inline: true, teleport: false } } },
      initialData: { date: '2026-02-15' },
      submit: submitResult,
    })
    mountedForms.push(view)
    await flush()
    await vi.waitFor(() => expect(view.host.querySelector('.dp__active_date')?.textContent?.trim()).toBe('15'))

    const day = [...view.host.querySelectorAll<HTMLElement>('.dp__cell_inner:not(.dp__cell_offset):not(.dp__cell_disabled)')]
      .find((cell) => cell.textContent?.trim() === '20')
    if (!day) throw new Error('DateInput did not render the selected month.')
    day.click()
    await vi.waitFor(() => expect(view.host.querySelector('.dp__active_date')?.textContent?.trim()).toBe('20'))

    const save = [...view.host.querySelectorAll<HTMLButtonElement>('form button')]
      .find((button) => button.type === 'submit')
    if (!save) throw new Error('The Save action did not render.')
    save.click()
    await vi.waitFor(() => expect(submitResult).toHaveBeenCalledOnce())

    expect(submitResult).toHaveBeenCalledWith({ date: '2026-02-20' })
  })

  it('blocks Save when the real DateInput retains invalid pasted text', async () => {
    const submitResult = vi.fn(async (data: { date?: string }) => data)
    const view = mountCore(Form, {
      schema: z.object({ date: z.string().optional() }),
      fields: { date: { renderer: 'date', props: { teleport: false } } },
      initialData: { date: '2026-02-15' },
      submit: submitResult,
    })
    mountedForms.push(view)
    await flush()
    await vi.waitFor(() => expect(view.host.querySelector('[data-test-id="dp-input"]')).not.toBeNull())

    const input = view.host.querySelector<HTMLInputElement>('[data-test-id="dp-input"]')
    if (!input) throw new Error('DateInput did not render its real text input.')
    input.focus()
    const clipboard = new DataTransfer()
    clipboard.setData('text/plain', 'not-a-date')
    input.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, clipboardData: clipboard }))
    input.value = 'not-a-date'
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste', data: 'not-a-date' }))
    await vi.waitFor(() => expect(input.value).toBe('not-a-date'))
    expect(view.exposed().draft).toMatchObject({ date: '2026-02-15' })

    const save = [...view.host.querySelectorAll<HTMLButtonElement>('form button')]
      .find((button) => button.type === 'submit')
    if (!save) throw new Error('The Save action did not render.')
    save.click()
    await flush()

    expect(submitResult).not.toHaveBeenCalled()
    expect(view.text()).toContain('Enter a valid date.')

    input.value = '2026-02-20'
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: '2026-02-20' }))
    await vi.waitFor(() => expect(view.exposed().draft).toMatchObject({ date: '2026-02-20' }))
    save.click()
    await vi.waitFor(() => expect(submitResult).toHaveBeenCalledOnce())

    expect(submitResult).toHaveBeenCalledWith({ date: '2026-02-20' })
  })

  it('lets Save supersede deferred blur validation and dispatches once', async () => {
    const blurValidation = deferred<void>()
    const blurValidator = vi.fn(async () => blurValidation.promise)
    const submitResult = vi.fn(async (data: { amount: number }) => data.amount)
    const view = mountCore(Form, {
      schema: z.object({ amount: z.number() }),
      fields: { amount: { renderer: 'number' } },
      initialData: { amount: 12 },
      validators: [{ validate: blurValidator, triggers: ['blur'] }],
      submit: submitResult,
    })
    mountedForms.push(view)
    await flush()
    await vi.waitFor(() => expect(view.host.querySelector('input')).not.toBeNull())

    const input = view.host.querySelector<HTMLInputElement>('input')
    const save = view.host.querySelector<HTMLButtonElement>('button')
    if (!input || !save) throw new Error('The number field and Save action must render.')
    input.focus()
    input.value = '13'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.blur()
    await vi.waitFor(() => expect(blurValidator).toHaveBeenCalledOnce())
    expect(save.disabled).toBe(false)

    save.click()
    save.click()
    await vi.waitFor(() => expect(submitResult).toHaveBeenCalledOnce())
    blurValidation.resolve()
    await flush()

    expect(submitResult).toHaveBeenCalledWith({ amount: 13 })
  })

  it.each([
    ['defineForm constructor', true],
    ['equivalent plain object', false],
  ])('keeps one editing contract for the %s', async (_label, useConstructor) => {
    transformCalls = 0
    defaultCalls = 0
    ownerFactoryCalls = 0
    originalCalls = 0
    dialogCalls = 0
    originalValues = []
    validatorValues = []
    const view = await mountParity(useConstructor)
    await vi.waitFor(() => {
      expect(document.body.querySelectorAll('form')).toHaveLength(4)
      expect(Object.values(view.firstOwners)).toHaveLength(4)
      expect(form('base-form').querySelector('label[for$="field-name"]')?.textContent?.trim()).toBe('Name *')
      expect(field(viewForm(view.host), 'dependent')).toBeDefined()
    })

    const formElement = form('base-form')
    const dialogFormElement = form('dialog-form')
    const editors = [
      formElement,
      dialogFormElement,
      viewForm(view.host),
      form('resource-form'),
    ]
    expect(new Set(editors.map((editor) => editor.id)).size).toBe(4)
    for (const editor of editors) {
      expect(editor.querySelector('label[for$="field-name"]')?.textContent?.trim()).toBe('Name *')
      expect(field(editor, 'dependent')).toBeDefined()
      expect(editor.querySelector('[id$="field-hidden"]')).toBeNull()
    }
    expect(defaultCalls).toBe(12)
    expect(ownerFactoryCalls).toBe(4)
    const ownerDefaults = Object.values(view.firstOwners)
    expect(ownerDefaults).toHaveLength(4)
    expect(new Set(ownerDefaults).size).toBe(4)
    const defaultOwners = ownerDefaults.map((value) => {
      if (!Array.isArray(value)) throw new Error('Each editor must receive its mutable owner default.')
      const owner = value[0]
      if (typeof owner !== 'object' || owner === null) throw new Error('Each owner default must contain a record.')
      return owner
    })
    expect(defaultOwners.map((owner) => Reflect.get(owner, 'id'))).toEqual(Array(4).fill('owner-default'))
    expect(defaultOwners[0]).toEqual(defaultOwners[1])
    expect(defaultOwners[0]).toEqual(defaultOwners[2])
    expect(defaultOwners[0]).toEqual(defaultOwners[3])
    const profiles = defaultOwners.map((owner) => {
      const profile = Reflect.get(owner, 'profile')
      if (typeof profile !== 'object' || profile === null) throw new Error('Each owner default must contain a profile.')
      return profile
    })
    expect(new Set(profiles).size).toBe(4)
    Reflect.set(profiles[0], 'region', 'West')
    for (const profile of profiles.slice(1)) expect(Reflect.get(profile, 'region')).toBe('East')

    view.setters.form?.([view.selectedOwner])
    await vi.waitFor(() => expect(view.currentOwners.form).not.toBe(view.firstOwners.form))
    expect(Array.isArray(view.currentOwners.form)).toBe(true)
    if (!Array.isArray(view.currentOwners.form)) throw new Error('The select input did not keep a record array.')
    const selected = view.currentOwners.form[0]
    expect(selected).toEqual(view.selectedOwner)
    expect(selected).not.toBe(view.selectedOwner)
    if (typeof selected !== 'object' || selected === null) throw new Error('The select input did not keep the selected record.')
    const profile = Reflect.get(selected, 'profile')
    if (typeof profile !== 'object' || profile === null) throw new Error('The selected record did not keep its profile.')
    Reflect.set(profile, 'region', 'North')
    expect(view.selectedOwner.profile.region).toBe('East')
    Reflect.set(profile, 'region', 'East')
    for (const surface of ['dialog', 'view', 'resource'] as const) {
      expect(view.currentOwners[surface]).toBe(view.firstOwners[surface])
    }

    for (const currentForm of editors) {
      enter(currentForm, 'name', 'hide')
      await vi.waitFor(() => expect(currentForm.querySelector('[id$="field-dependent"]')).toBeNull())
      enter(currentForm, 'name', 'show edited')
      await vi.waitFor(() => expect(field(currentForm, 'dependent')).toBeDefined())
      enter(currentForm, 'dependent', 'dependent edited')
    }

    for (const currentForm of editors) {
      const submit = currentForm.querySelector<HTMLButtonElement>('button[type="submit"]')
      if (!submit) throw new Error('Each editor must render its submit action.')
      submit.click()
    }

    await vi.waitFor(() => {
      expect(originalCalls).toBe(3)
      expect(dialogCalls).toBe(1)
      expect(view.formSubmitted).toHaveLength(1)
      expect(view.dialogSubmitted).toHaveLength(1)
      expect(view.viewSubmitted).toHaveLength(1)
      expect(view.resourceSubmitted).toHaveLength(1)
    })
    expect(transformCalls).toBe(4)
    expect(validatorValues).toEqual(Array(4).fill('show edited:parsed'))
    const expectedInput = {
      name: 'show edited:parsed',
      dependent: 'dependent edited',
      owners: [{ id: 'owner-default', name: 'Owner', profile: { region: 'East' } }],
      retained: 'retained without a control',
    }
    const expectedResult = { id: 'saved-user', ...expectedInput }
    expect(originalValues).toEqual([expectedInput, expectedInput, expectedInput])
    expect(view.dialogValues).toEqual([expectedInput])
    expect(view.formSubmitted).toEqual([expectedResult])
    expect(view.dialogSubmitted).toEqual([18])
    expect(view.viewSubmitted).toEqual([expectedResult])
    expect(view.resourceSubmitted).toEqual([expectedResult])
  })

  it('keeps a malformed resource write out of FormView completion and does not retry it', async () => {
    const submit = vi.fn(async (_input: { name: string }) => ({ name: 'Saved without an id' }))
    const afterSubmit = vi.fn()
    const submitted = vi.fn()
    const errors: unknown[] = []
    const resource = defineResource({
      key: 'browser-invalid-result',
      identity: (record: { id?: string }) => record.id as string,
      create: {
        permission: null,
        defaultTo: '/complete',
        afterSubmit,
        form: {
          schema: z.object({ name: z.string() }),
          fields: { name: { renderer: 'text' } },
          submit,
        },
      },
    })
    const view = mountCore(FormView, {
      ...resource.create,
      form: { ...resource.create.form, name: 'invalid-result-form' },
      successMessage: false,
      onSubmitted: submitted,
      onError: (error: unknown) => errors.push(error),
    })
    mountedForms.push(view)
    await flush()

    const formElement = viewForm(view.host)
    enter(formElement, 'name', 'Attempt')
    await vi.waitFor(() => expect(field(formElement, 'name').value).toBe('Attempt'))
    const save = formElement.querySelector<HTMLButtonElement>('button[type="submit"]')
    if (!save) throw new Error('FormView did not render its Save action.')
    save.click()
    await vi.waitFor(() => {
      expect(submit).toHaveBeenCalledOnce()
      expect(errors).toHaveLength(1)
    })
    await flush()

    expect(submit).toHaveBeenCalledWith({ name: 'Attempt' })
    expect(errors[0]).toMatchObject({ code: 'RESOURCE_RESULT_INVALID', operation: 'create', retryable: false, postWrite: true })
    expect(submitted).not.toHaveBeenCalled()
    expect(afterSubmit).not.toHaveBeenCalled()
    expect(view.router.currentRoute.value.fullPath).toBe('/')
  })
})
