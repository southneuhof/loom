import { defineComponent, h, ref, type Component } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import type { FormFields } from '../../../contracts/forms'
import type { DialogFormCloseContext, DialogFormCloseReason } from '../../../forms/props'
import { defineForm } from '../../../forms/defineForm'
import { defineResource } from '../../../resources/defineResource'
import DialogForm from '../DialogForm.vue'
import Table from '../../core/Table.vue'
import { toast } from 'vue-sonner'
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
}

interface DialogEvents {
  submitted: unknown[]
  errors: unknown[]
  openUpdates: boolean[]
}

function mountDialogForm(options: DialogMountOptions = {}) {
  const initialOpen = options.initialOpen ?? options.props?.open === true
  const open = ref(initialOpen)
  const dialogForm = ref<Record<string, unknown> | null>(null)
  const events: DialogEvents = {
    submitted: [],
    errors: [],
    openUpdates: [],
  }
  const Host = defineComponent({
    setup(_, { expose }) {
      expose({ open, dialogForm })
      return () => {
        const props: Record<string, unknown> = {
          ref: dialogForm,
          schema,
          fields,
          submit: async () => 'saved',
          ...options.definition,
          ...options.props,
          onSubmitted: (result: unknown) => events.submitted.push(result),
          onError: (error: unknown) => events.errors.push(error),
        }
        props.open = open.value
        props['onUpdate:open'] = (value: boolean) => {
          events.openUpdates.push(value)
          open.value = value
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
  vi.restoreAllMocks()
})

describe('DialogForm', () => {
  it('forwards a confirmed write result and refresh error once before closing', async () => {
    type RecordRow = { id: string; name: string }
    const rowSchema = z.object({ id: z.string(), name: z.string() })
    const draftSchema = z.object({ name: z.string() })
    let reads = 0
    const load = vi.fn(async () => {
      reads += 1
      if (reads > 1) throw new Error('The collection could not be refreshed.')
      return { data: [{ id: 'one', name: 'Current' }] }
    })
    const result = { id: 'two', name: 'Saved' }
    const submit = vi.fn(async () => result)
    const resource = defineResource({
      key: 'dialog-confirmed-completion',
      identity: (record: RecordRow) => record.id,
      list: { permission: null, table: { schema: rowSchema, columns: { name: {} }, load } },
      create: {
        permission: null,
        form: { schema: draftSchema, fields: { name: { renderer: 'text' } }, initialData: { name: 'Saved' }, submit },
      },
    })
    const submitted: Array<[unknown, unknown?]> = []
    const errors: unknown[] = []
    const openUpdates: boolean[] = []
    const open = ref(true)
    const toastWarning = vi.spyOn(toast, 'warning').mockImplementation(() => '')
    const Host = defineComponent({
      setup(_, { expose }) {
        const dialog = ref<Record<string, unknown> | null>(null)
        expose({ submit: () => {
          const method = dialog.value?.submit
          if (typeof method !== 'function') throw new Error('DialogForm did not expose submit().')
          return method()
        } })
        return () => h('div', [
          h(Table as Component, resource.list().table),
          h(DialogForm as Component, {
            ...resource.create().form,
            ref: dialog,
            open: open.value,
            'onUpdate:open': (value: boolean) => { openUpdates.push(value); open.value = value },
            onSubmitted: (writeResult: unknown, refreshError?: unknown) => submitted.push([writeResult, refreshError]),
            onError: (error: unknown) => errors.push(error),
          }),
        ])
      },
    })
    const view = mountCore(Host, {})
    mounted.push(view)

    await vi.waitFor(() => expect(load).toHaveBeenCalledOnce())
    const submitDialog = view.exposed().submit
    if (typeof submitDialog !== 'function') throw new Error('The DialogForm submit method was not exposed.')
    await submitDialog()
    await vi.waitFor(() => expect(submitted).toHaveLength(1))

    expect(submit).toHaveBeenCalledOnce()
    expect(submitted[0]?.[0]).toBe(result)
    expect(submitted[0]?.[1]).toMatchObject({ writeOutcome: 'confirmed', result })
    expect(errors).toEqual([])
    expect(openUpdates).toEqual([false])
    expect(open.value).toBe(false)
    expect(view.find('[role="dialog"]')).toBeNull()
    expect(toastWarning).toHaveBeenCalledOnce()
  })

  it('uses the submit override and closes after success', async () => {
    const originalSubmit = vi.fn(async () => 'original')
    const effectiveSubmit = vi.fn(async () => 'effective')
    const definition = defineForm({ schema, fields, submit: originalSubmit })
    const view = mount({
      definition,
      initialOpen: true,
      props: { submit: effectiveSubmit, initialData: { name: 'Ada' } },
    })
    await flush()

    button(view.view, 'Submit')?.click()
    await flush()

    expect(originalSubmit).not.toHaveBeenCalled()
    expect(effectiveSubmit).toHaveBeenCalledOnce()
    expect(effectiveSubmit).toHaveBeenCalledWith({ name: 'Ada' })
    expect(view.events.submitted).toEqual(['effective'])
    expect(view.view.exposed().open).toBe(false)
    expect(view.events.openUpdates).toEqual([false])
    expect(view.view.find('[role="dialog"]')).toBeNull()
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

  it('ignores deferred close approval after reopen and while submitting', async () => {
    const closeDecisions = [deferred<boolean>(), deferred<boolean>()]
    let closeIndex = 0
    const submitDecision = deferred<string>()
    const submit = vi.fn(() => submitDecision.promise)
    const view = mount({
      initialOpen: true,
      props: {
        submit,
        beforeClose: () => closeDecisions[closeIndex++]!.promise,
        initialData: { name: 'Ada' },
      },
    })
    await flush()

    button(view.view, 'Cancel')?.click()
    await flush()
    expect(closeIndex).toBe(1)
    view.setParentOpen(false)
    await flush()
    view.setParentOpen(true)
    await flush()
    closeDecisions[0]!.resolve(true)
    await flush()

    expect(view.view.find('[role="dialog"]')).not.toBeNull()
    expect(view.events.openUpdates).toEqual([])

    button(view.view, 'Cancel')?.click()
    await flush()
    expect(closeIndex).toBe(2)
    const dialogForm: unknown = view.view.exposed().dialogForm
    if (typeof dialogForm !== 'object' || dialogForm === null || !('submit' in dialogForm)) {
      throw new Error('DialogForm does not expose submit().')
    }
    const submitForm = dialogForm.submit
    if (typeof submitForm !== 'function') throw new Error('DialogForm does not expose submit().')
    const submitting = submitForm()
    await vi.waitFor(() => expect(submit).toHaveBeenCalledOnce())
    closeDecisions[1]!.resolve(true)
    await flush()

    expect(view.view.find('[role="dialog"]')).not.toBeNull()
    expect(view.events.openUpdates).toEqual([])

    submitDecision.resolve('saved')
    await submitting
    await flush()

    expect(view.events.submitted).toEqual(['saved'])
    expect(view.events.openUpdates).toEqual([false])
    expect(view.view.find('[role="dialog"]')).toBeNull()
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

  it('keeps the post-write warning and disables only the default save action', async () => {
    const submit = vi.fn(async () => {
      throw Object.assign(new Error('The write may have completed.'), { postWrite: true })
    })
    const view = mount({ initialOpen: true, props: { submit, initialData: { name: 'Ada' } } })
    await flush()

    button(view.view, 'Submit')?.click()
    const dialogForm = view.view.exposed().dialogForm as Record<string, unknown> | null
    const exposedSubmit = dialogForm?.submit
    if (typeof exposedSubmit !== 'function') throw new Error('DialogForm does not expose submit().')
    await exposedSubmit()
    await flush()

    expect(dialogForm?.postWriteError).toMatchObject({ postWrite: true })
    expect(button(view.view, 'Submit')?.disabled).toBe(true)
    expect(button(view.view, 'Cancel')?.disabled).toBe(false)
    expect(view.view.find('[role="alert"]')?.textContent).toContain('Check the record before starting another save.')
    expect(view.events.errors).toHaveLength(1)
  })

  it('passes the post-write error to custom action slots', async () => {
    const submit = vi.fn(async () => {
      throw Object.assign(new Error('The write may have completed.'), { postWrite: true })
    })
    const actionScopes: DialogSlotScope[] = []
    const view = mount({
      initialOpen: true,
      props: { submit, initialData: { name: 'Ada' } },
      slots: {
        actions: (scope) => {
          actionScopes.push(scope)
          return h('button', { type: 'button', onClick: () => { void scope.submit?.() } }, 'Save')
        },
      },
    })
    await flush()

    button(view.view, 'Save')?.click()
    await vi.waitFor(() => expect(actionScopes.at(-1)?.postWriteError).toMatchObject({ postWrite: true }))

    expect(submit).toHaveBeenCalledOnce()
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

})
