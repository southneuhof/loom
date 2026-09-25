import { defineComponent, h, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import type { FormFields } from '../../../contracts/forms'
import type { DialogFormCloseContext, DialogFormCloseReason } from '../../../forms/props'
import { defineForm } from '../../../forms/defineForm'
import DialogForm from '../DialogForm.vue'
import { deferred, flush, mountCore } from '../../core/__tests__/harness'

vi.mock('../../base/Dialog.vue', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    default: defineComponent({
      inheritAttrs: false,
      props: { modelValue: Boolean },
      emits: ['update:modelValue', 'open', 'close'],
      setup(props, { attrs, emit, slots }) {
        const setOpen = (value: boolean) => {
          emit('update:modelValue', value)
          emit(value ? 'open' : 'close')
        }
        return () => h('section', { ...attrs, class: ['dialog-mock', attrs.class], 'data-dialog-root': '' }, [
          slots.trigger?.({ setOpen, disabled: false, 'data-trigger-binding': '' }),
          props.modelValue ? h('div', { role: 'dialog' }, [
            slots.title?.({ setOpen }),
            slots.description?.({ setOpen }),
            slots.content?.({ setOpen }),
            h('button', { type: 'button', onClick: () => setOpen(false) }, 'Dismiss'),
          ]) : null,
        ])
      },
    }),
  }
})

const schema = z.object({ name: z.string() })
type Input = z.input<typeof schema>
const fields = { name: { renderer: 'text' } } satisfies FormFields<Input>

interface DialogSlotScope {
  setOpen?: (value: boolean) => void
  requestClose?: (reason: DialogFormCloseReason) => Promise<boolean>
  value?: unknown
  touched?: boolean
  field?: unknown
  setValue?: (value: unknown) => void
  dirty?: boolean
  submit?: () => Promise<void>
  reset?: () => void
  [key: string]: unknown
}

interface DialogMountOptions {
  definition?: object
  props?: Record<string, unknown>
  slots?: Record<string, (scope: DialogSlotScope) => unknown>
  initialOpen?: boolean
  boundOpen?: boolean
}

interface DialogEvents {
  submitted: unknown[]
  errors: unknown[]
  resets: number
  modelUpdates: Partial<Input>[]
  openUpdates: boolean[]
}

function mountDialogForm(options: DialogMountOptions = {}) {
  const initialOpen = options.initialOpen ?? options.props?.open === true
  const open = ref(initialOpen)
  const events: DialogEvents = {
    submitted: [],
    errors: [],
    resets: 0,
    modelUpdates: [],
    openUpdates: [],
  }
  const Host = defineComponent({
    setup(_, { expose }) {
      expose({ open })
      return () => {
        const props: Record<string, unknown> = {
          schema,
          fields,
          submit: async () => 'saved',
          ...options.definition,
          ...options.props,
          onSubmitted: (result: unknown) => events.submitted.push(result),
          onError: (error: unknown) => events.errors.push(error),
          onReset: () => { events.resets += 1 },
          'onUpdate:modelValue': (value: Partial<Input>) => events.modelUpdates.push(value),
        }
        if (options.boundOpen !== false || Object.hasOwn(options.props ?? {}, 'open')) {
          props.open = open.value
          props['onUpdate:open'] = (value: boolean) => {
            events.openUpdates.push(value)
            open.value = value
          }
        }
        return h(DialogForm, props, options.slots)
      }
    },
  })
  const view = mountCore(Host, {})
  return { view, events, setParentOpen: (value: boolean) => { open.value = value } }
}

function input(view: ReturnType<typeof mountCore>): HTMLInputElement {
  const element = view.find<HTMLInputElement>('input')
  if (!element) throw new Error('DialogForm did not render its input.')
  return element
}

function enterName(view: ReturnType<typeof mountCore>, value: string): void {
  const element = input(view)
  element.value = value
  element.dispatchEvent(new Event('input', { bubbles: true }))
}

function button(view: ReturnType<typeof mountCore>, label: string): HTMLButtonElement | undefined {
  const element = view.all('button').find((entry) => entry.textContent?.trim() === label)
  return element instanceof HTMLButtonElement ? element : undefined
}

const mounted: Array<ReturnType<typeof mountDialogForm>['view']> = []

function mount(options: DialogMountOptions = {}) {
  const result = mountDialogForm(options)
  mounted.push(result.view)
  return result
}

afterEach(() => {
  for (const view of mounted.splice(0)) view.unmount()
  document.body.innerHTML = ''
})

describe('DialogForm', () => {
  it('forwards native form attributes and dialog styling, and uses the effective submit once', async () => {
    let transformCalls = 0
    const paritySchema = z.object({
      name: z.string().transform((value) => {
        transformCalls += 1
        return value.trim().toUpperCase()
      }),
    })
    type ParityInput = z.input<typeof paritySchema>
    const parityFields = { name: { renderer: 'text' } } satisfies FormFields<ParityInput>
    const originalSubmit = vi.fn(async (data: z.output<typeof paritySchema>) => `original-${data.name}`)
    const effectiveSubmit = vi.fn(async (data: z.output<typeof paritySchema>) => `effective-${data.name}`)
    const validated: z.output<typeof paritySchema>[] = []
    const definition = defineForm({
      schema: paritySchema,
      fields: parityFields,
      submit: originalSubmit,
    })
    const view = mount({
      definition,
      initialOpen: true,
      props: {
        schema: paritySchema,
        fields: parityFields,
        submit: effectiveSubmit,
        validators: [{ validate: async ({ data }: { data: z.output<typeof paritySchema> }) => { validated.push(data) } }],
        name: 'profile-form',
        autocomplete: 'off',
        'aria-label': 'Profile editor',
        'data-testid': 'profile-dialog-form',
        class: 'profile-dialog',
        style: { maxWidth: '42rem' },
      },
    })
    await flush()

    expect(view.view.all('form')).toHaveLength(1)
    expect(view.view.find('form')?.getAttribute('name')).toBe('profile-form')
    expect(view.view.find('form')?.getAttribute('autocomplete')).toBe('off')
    expect(view.view.find('form')?.getAttribute('aria-label')).toBe('Profile editor')
    expect(view.view.find('form')?.getAttribute('data-testid')).toBe('profile-dialog-form')
    expect(view.view.find('[data-dialog-root]')?.classList.contains('profile-dialog')).toBe(true)
    expect(view.view.find('[data-dialog-root]')?.getAttribute('style')).toContain('max-width: 42rem')
    expect(button(view.view, 'Cancel')).toBeDefined()
    expect(button(view.view, 'Submit')).toBeDefined()

    enterName(view.view, '  Ada  ')
    await flush()
    button(view.view, 'Submit')?.click()
    await flush()

    expect(transformCalls).toBe(1)
    expect(validated).toEqual([{ name: 'ADA' }])
    expect(originalSubmit).not.toHaveBeenCalled()
    expect(effectiveSubmit).toHaveBeenCalledOnce()
    expect(effectiveSubmit).toHaveBeenCalledWith({ name: 'ADA' })
    expect(view.events.submitted).toEqual(['effective-ADA'])
    expect(view.view.exposed().open).toBe(false)
    expect(view.events.openUpdates).toEqual([false])
    expect(view.view.find('[role="dialog"]')).toBeNull()
  })

  it('preserves an explicitly undefined model and forwards its updates once without loading', async () => {
    const load = vi.fn(async () => ({ name: 'loaded' }))
    const inputScopes: DialogSlotScope[] = []
    const view = mount({
      initialOpen: true,
      props: {
        schema,
        fields: { name: { renderer: 'text', initialValue: () => 'factory' } },
        modelValue: undefined,
        submit: undefined,
        initialData: { name: 'initial' },
        load,
      },
      slots: {
        'input:name': (scope) => {
          inputScopes.push(scope)
          return h('span', { 'data-input-slot': '' }, String(scope.value ?? ''))
        },
      },
    })
    await flush()

    expect(load).not.toHaveBeenCalled()
    expect(view.events.modelUpdates).toEqual([{ name: 'initial' }])
    expect(inputScopes[0]?.value).toBe('initial')
    expect(inputScopes[0]?.touched).toBe(false)
    expect(inputScopes[0]?.field).toMatchObject({ key: 'name', label: 'name' })
    expect(view.view.find('[data-input-slot]')?.textContent).toBe('initial')
  })

  it('guards duplicate close requests while a dirty draft awaits approval', async () => {
    const decision = deferred<boolean>()
    const contexts: DialogFormCloseContext[] = []
    const beforeClose = vi.fn((context: DialogFormCloseContext) => {
      contexts.push(context)
      return decision.promise
    })
    const view = mount({
      initialOpen: true,
      props: { beforeClose },
    })
    await flush()
    enterName(view.view, 'Ada')

    button(view.view, 'Cancel')?.click()
    await flush()
    expect(contexts).toEqual([{ reason: 'cancel', dirty: true, submitting: false, validating: false }])
    expect(button(view.view, 'Cancel')?.disabled).toBe(true)
    button(view.view, 'Dismiss')?.click()
    await flush()
    expect(beforeClose).toHaveBeenCalledOnce()

    decision.resolve(true)
    await flush()
    expect(view.events.openUpdates).toEqual([false])
    expect(view.view.find('[role="dialog"]')).toBeNull()
  })

  it('keeps the dialog open when a close guard rejects', async () => {
    const beforeClose = vi.fn(async () => { throw new Error('Leave denied') })
    const view = mount({ initialOpen: true, props: { beforeClose } })
    await flush()

    button(view.view, 'Dismiss')?.click()
    await flush()

    expect(beforeClose).toHaveBeenCalledOnce()
    expect(view.view.find('[role="dialog"]')).not.toBeNull()
    expect(view.events.openUpdates).toEqual([])
  })

  it('keeps the dialog open when a close guard returns false', async () => {
    const contexts: DialogFormCloseContext[] = []
    const beforeClose = vi.fn(async (context: DialogFormCloseContext) => {
      contexts.push(context)
      return false
    })
    const view = mount({ initialOpen: true, props: { beforeClose } })
    await flush()

    button(view.view, 'Dismiss')?.click()
    await flush()

    expect(contexts).toEqual([{ reason: 'dismiss', dirty: false, submitting: false, validating: false }])
    expect(view.view.find('[role="dialog"]')).not.toBeNull()
    expect(view.events.openUpdates).toEqual([])
  })

  it('accepts a parent-controlled close without calling the user close guard', async () => {
    const beforeClose = vi.fn(async () => false)
    const view = mount({ initialOpen: true, props: { beforeClose } })
    await flush()

    view.setParentOpen(false)
    await flush()

    expect(beforeClose).not.toHaveBeenCalled()
    expect(view.view.all('form')).toHaveLength(0)
    expect(view.view.find('[role="dialog"]')).toBeNull()
    expect(view.events.openUpdates).toEqual([])
  })

  it('keeps the dialog open after success when closeOnSubmitted is false', async () => {
    const submit = vi.fn(async () => 'saved')
    const view = mount({ initialOpen: true, props: { submit, closeOnSubmitted: false, initialData: { name: 'Ada' } } })
    await flush()

    button(view.view, 'Submit')?.click()
    await flush()

    expect(submit).toHaveBeenCalledOnce()
    expect(view.events.submitted).toEqual(['saved'])
    expect(view.view.find('[role="dialog"]')).not.toBeNull()
    expect(view.events.openUpdates).toEqual([])
  })

  it('forwards one reset and one submit error while preserving the open dialog', async () => {
    const submit = vi.fn(async () => { throw new Error('Save rejected') })
    const actionScopes: DialogSlotScope[] = []
    const view = mount({
      initialOpen: true,
      props: { submit, initialData: { name: 'Initial' } },
      slots: {
        actions: (scope) => {
          actionScopes.push(scope)
          return h('div', [
            h('button', { type: 'button', onClick: () => scope.reset?.() }, 'Reset'),
            h('button', { type: 'submit' }, 'Save'),
          ])
        },
      },
    })
    await flush()
    enterName(view.view, 'Changed')
    await flush()
    button(view.view, 'Reset')?.click()
    await flush()
    expect(input(view.view).value).toBe('Initial')
    expect(view.events.resets).toBe(1)
    expect(actionScopes[0]?.reset).toBeTypeOf('function')

    enterName(view.view, 'Changed again')
    await flush()
    button(view.view, 'Save')?.click()
    await flush()

    expect(submit).toHaveBeenCalledOnce()
    expect(view.events.errors).toHaveLength(1)
    expect(view.view.find('[role="dialog"]')).not.toBeNull()
  })

  it('passes requestClose to a custom action slot and keeps the Form slot scope', async () => {
    const actionScopes: DialogSlotScope[] = []
    const inputScopes: DialogSlotScope[] = []
    const view = mount({
      initialOpen: true,
      slots: {
        'input:name': (scope) => {
          inputScopes.push(scope)
          return h('span', { 'data-input-slot': '' }, String(scope.value ?? ''))
        },
        actions: (scope) => {
          actionScopes.push(scope)
          return h('button', {
            type: 'button',
            onClick: () => { void scope.requestClose?.('cancel') },
          }, 'Custom cancel')
        },
      },
    })
    await flush()

    expect(actionScopes[0]?.submit).toBeTypeOf('function')
    expect(actionScopes[0]?.requestClose).toBeTypeOf('function')
    expect(inputScopes[0]?.field).toMatchObject({ key: 'name' })
    button(view.view, 'Custom cancel')?.click()
    await flush()
    expect(view.events.openUpdates).toEqual([false])
    expect(view.view.find('[role="dialog"]')).toBeNull()
  })

  it('exposes Form state and methods without creating a second Form', async () => {
    const view = mountCore(DialogForm, {
      schema,
      fields,
      submit: async () => 'saved',
      open: true,
      initialData: { name: 'Ada' },
    })
    mounted.push(view)
    await flush()

    expect(view.all('form')).toHaveLength(1)
    expect(view.exposed()).toHaveProperty('draft')
    expect(view.exposed()).toHaveProperty('dirty')
    expect(view.exposed()).toHaveProperty('submitting')
    expect(view.exposed()).toHaveProperty('validating')
    expect(view.exposed()).toHaveProperty('inputPending')
    expect(view.exposed()).toHaveProperty('validate')
    expect(view.exposed()).toHaveProperty('submit')
    expect(view.exposed()).toHaveProperty('reset')
    expect(view.exposed()).toHaveProperty('refresh')
    expect(view.exposed()).toHaveProperty('requestClose')
    expect(view.exposed()).toHaveProperty('checkingClose')
    expect(view.exposed()).not.toHaveProperty('form')
    enterName(view, 'Grace')
    await flush()
    const exposedReset = view.exposed().reset
    if (typeof exposedReset !== 'function') throw new Error('DialogForm does not expose reset().')
    exposedReset()
    await flush()
    expect(input(view).value).toBe('Ada')
  })
})
