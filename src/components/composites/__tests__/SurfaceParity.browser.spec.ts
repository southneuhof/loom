import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, type App } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { z } from 'zod'
import type { FormDefinition, FormFields } from '../../../contracts/forms'
import { defineForm } from '../../../forms/defineForm'
import { FrameworkPlugin } from '../../../adapters/plugin'
import { createFrameworkQueryClient } from '../../../query'
import { defineResource, resetResourceRuntimeForTests } from '../../../resources'
import DialogForm from '../DialogForm.vue'
import Form from '../../core/Form.vue'
import FormView from '../../views/FormView.vue'

const apps: App[] = []
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
      behavior: { visible: ({ draft }: { draft: Partial<Input> }) => draft.name?.startsWith('show') === true },
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
  resetResourceRuntimeForTests()
  document.body.innerHTML = ''
})

describe('form surface browser parity', () => {
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
})
