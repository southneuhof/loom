import { defineComponent, h, onMounted, ref, shallowRef } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import Form from '../Form.vue'
import { useFormInputPending } from '../useFormInputState'
import { deferred, flush, mountCore } from './harness'
import type { FrameworkAdaptersInput } from '../../../adapters/projectAdapters'
import { testAssetAdapter } from '../../inputs/__tests__/harness'

const mounted: Array<ReturnType<typeof mountCore>> = []

function mount(props: Record<string, unknown>, slots?: Record<string, (scope: Record<string, unknown>) => unknown>, adapters?: FrameworkAdaptersInput) {
  const view = mountCore(Form, props, { slots, adapters })
  mounted.push(view)
  return view
}

function setText(view: ReturnType<typeof mountCore>, key: string, value: string): void {
  const input = view.find<HTMLInputElement>(`[id$="-field-${key}"]`)
  if (!input) throw new Error(`Form field "${key}" did not render an input.`)
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

function submit(view: ReturnType<typeof mountCore>): void {
  const form = view.find<HTMLFormElement>('form')
  if (!form) throw new Error('Form did not render a form element.')
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
}

afterEach(() => {
  for (const view of mounted.splice(0)) view.unmount()
  document.body.innerHTML = ''
})

describe('Form session', () => {
  it('keeps per-session defaults and IDs, with explicit falsey and undefined values above factories', async () => {
    let defaultCalls = 0
    let overriddenFactoryCalls = 0
    const schema = z.object({
      text: z.string().optional(),
      amount: z.number().optional(),
      active: z.boolean().optional(),
      nullable: z.string().nullable().optional(),
      missing: z.string().optional(),
      generated: z.string().optional(),
    })
    const fields = {
      text: { renderer: 'text', initialValue: () => `default-${++overriddenFactoryCalls}` },
      amount: { renderer: 'number', initialValue: () => 7 },
      active: { renderer: 'switch', initialValue: () => true },
      nullable: { renderer: 'text', initialValue: () => { overriddenFactoryCalls += 1; return 'nullable factory' } },
      missing: { renderer: 'text', initialValue: () => { overriddenFactoryCalls += 1; return 'factory' } },
      generated: { renderer: 'text', initialValue: () => `generated-${++defaultCalls}` },
    }
    const props = {
      schema,
      fields,
      initialData: { text: '', amount: 0, active: false, nullable: null, missing: undefined },
      submit: async () => undefined,
    }
    const captures: [Map<string, unknown>, Map<string, unknown>] = [new Map(), new Map()]
    const capture = (index: 0 | 1, key: string) => (scope: { value: unknown }) => {
      captures[index].set(key, scope.value)
      return h('span')
    }
    const Host = defineComponent({
      setup: () => () => h('div', [
        h(Form, props, {
          'input:text': capture(0, 'text'),
          'input:amount': capture(0, 'amount'),
          'input:active': capture(0, 'active'),
          'input:nullable': capture(0, 'nullable'),
          'input:missing': capture(0, 'missing'),
          'input:generated': capture(0, 'generated'),
        }),
        h(Form, props, {
          'input:text': capture(1, 'text'),
          'input:amount': capture(1, 'amount'),
          'input:active': capture(1, 'active'),
          'input:nullable': capture(1, 'nullable'),
          'input:missing': capture(1, 'missing'),
          'input:generated': capture(1, 'generated'),
        }),
      ]),
    })
    const view = mountCore(Host, {})
    mounted.push(view)
    const forms = view.all('form')
    await flush()

    expect(forms).toHaveLength(2)
    expect(forms[0]?.id).not.toBe(forms[1]?.id)
    expect(captures[0].get('text')).toBe('')
    expect(captures[0].get('amount')).toBe(0)
    expect(captures[0].get('active')).toBe(false)
    expect(captures[0].get('nullable')).toBeNull()
    expect(captures[0].has('missing')).toBe(true)
    expect(captures[0].get('missing')).toBeUndefined()
    expect(new Set([captures[0].get('generated'), captures[1].get('generated')]).size).toBe(2)
    expect(defaultCalls).toBe(2)
    expect(overriddenFactoryCalls).toBe(0)
  })

  it('keeps null in the draft while the non-nullable schema rejects it', async () => {
    const submitResult = vi.fn(async (data: { name: string }) => data)
    const view = mount({
      schema: z.object({ name: z.string() }),
      fields: { name: { renderer: 'text' } },
      modelValue: { name: null },
      submit: submitResult,
    })
    await flush()

    submit(view)
    await flush()

    expect(view.exposed().draft).toMatchObject({ name: null })
    expect(submitResult).not.toHaveBeenCalled()
  })

  it('keeps exposed draft values detached from the session and from their input sources', async () => {
    const date = new Date('2026-09-24T12:00:00.000Z')
    const initialData = {
      name: 'Ada',
      profile: { region: 'East', date },
      tags: ['first'],
    }
    const submitResult = vi.fn(async (data: typeof initialData) => data)
    const view = mount({
      schema: z.object({
        name: z.string(),
        profile: z.object({ region: z.string(), date: z.date() }),
        tags: z.array(z.string()),
      }),
      fields: {
        name: { renderer: 'text' },
        profile: { renderer: 'select' },
        tags: { renderer: 'select' },
      },
      initialData,
      submit: submitResult,
    })
    await flush()

    const draft = view.exposed().draft as typeof initialData
    expect(Reflect.set(draft, 'name', 'Grace')).toBe(false)
    expect(Reflect.set(draft.profile, 'region', 'West')).toBe(false)
    expect(Reflect.set(draft.tags, '0', 'second')).toBe(false)
    draft.profile.date.setUTCFullYear(2040)
    initialData.profile.region = 'North'
    initialData.tags.push('external')
    date.setUTCFullYear(2030)

    submit(view)
    await flush()

    expect(submitResult).toHaveBeenCalledOnce()
    expect(submitResult.mock.calls[0]?.[0]).toEqual({
      name: 'Ada',
      profile: { region: 'East', date: new Date('2026-09-24T12:00:00.000Z') },
      tags: ['first'],
    })
  })

  it('emits a detached model snapshot when a slot setter receives the current value', async () => {
    const date = new Date('2026-09-24T12:00:00.000Z')
    const modelValue = { profile: { date } }
    const updateModel = vi.fn()
    const submitResult = vi.fn(async (data: typeof modelValue) => data)
    let setProfile: (value: unknown) => void = () => undefined
    const view = mount({
      schema: z.object({ profile: z.object({ date: z.date() }) }),
      fields: { profile: { renderer: 'select' } },
      modelValue,
      'onUpdate:modelValue': updateModel,
      submit: submitResult,
    }, {
      'input:profile': (scope) => {
        if (typeof scope.setValue !== 'function') throw new Error('Form input slot did not provide setValue().')
        setProfile = scope.setValue as (value: unknown) => void
        return h('span')
      },
    })
    await flush()

    setProfile(modelValue.profile)
    await flush()
    const emitted = updateModel.mock.calls[0]?.[0] as typeof modelValue
    expect(emitted).not.toBe(modelValue)
    expect(emitted.profile).not.toBe(modelValue.profile)
    emitted.profile.date.setUTCFullYear(2040)

    submit(view)
    await flush()

    expect(submitResult).toHaveBeenCalledOnce()
    expect(submitResult).toHaveBeenCalledWith({ profile: { date: new Date('2026-09-24T12:00:00.000Z') } })
  })

  it.each(['12abc', '-'])('blocks optional number text %s and permits clearing it', async (invalidText) => {
    const submitResult = vi.fn(async (data: { amount?: number }) => data)
    const view = mount({
      schema: z.object({ amount: z.number().optional() }),
      fields: { amount: { renderer: 'number' } },
      submit: submitResult,
    })
    await flush()
    await vi.waitFor(() => expect(view.host.querySelector('input')).not.toBeNull())

    const input = view.host.querySelector<HTMLInputElement>('input')
    if (!input) throw new Error('NumberInput did not render its input.')
    input.value = invalidText
    input.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      inputType: invalidText === '12abc' ? 'insertFromPaste' : 'insertText',
      data: invalidText,
    }))
    await flush()
    submit(view)
    await flush()

    expect(submitResult).not.toHaveBeenCalled()
    expect(view.text()).toContain('Enter a valid number.')

    input.value = '12'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await flush()
    submit(view)
    await flush()

    expect(submitResult).toHaveBeenCalledOnce()
    expect(submitResult).toHaveBeenCalledWith({ amount: 12 })
  })

  it('replaces retained invalid number text when the parent replaces the form model', async () => {
    const modelValue = ref<{ amount?: number | null }>({ amount: 8 })
    const submitResult = vi.fn(async (data: { amount?: number }) => data)
    const schema = z.object({ amount: z.number().optional() })
    const fields = { amount: { renderer: 'number' } }
    const Host = defineComponent({
      setup: () => () => h(Form, {
        schema,
        fields,
        modelValue: modelValue.value,
        'onUpdate:modelValue': (value: { amount?: number | null }) => { modelValue.value = value },
        submit: submitResult,
      }),
    })
    const view = mountCore(Host, {})
    mounted.push(view)
    await flush()
    await vi.waitFor(() => expect(view.host.querySelector('input')).not.toBeNull())

    const input = view.host.querySelector<HTMLInputElement>('input')
    if (!input) throw new Error('NumberInput did not render its input.')
    input.value = '12abc'
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste', data: '12abc' }))
    await flush()
    expect(input.value).toBe('12abc')
    submit(view)
    await flush()
    expect(submitResult).not.toHaveBeenCalled()
    expect(view.text()).toContain('Enter a valid number.')

    modelValue.value = { amount: 24 }
    await flush()

    expect(input.value).toBe('24')
    expect(view.text()).not.toContain('Enter a valid number.')
    submit(view)
    await flush()

    expect(submitResult).toHaveBeenCalledOnce()
    expect(submitResult).toHaveBeenCalledWith({ amount: 24 })
  })

  it('resets retained invalid number text when the canonical value is unchanged', async () => {
    const submitResult = vi.fn(async (data: { amount?: number }) => data)
    const view = mount({
      schema: z.object({ amount: z.number().optional() }),
      fields: { amount: { renderer: 'number' } },
      initialData: { amount: 8 },
      submit: submitResult,
    })
    await flush()
    await vi.waitFor(() => expect(view.host.querySelector('input')).not.toBeNull())

    const input = view.host.querySelector<HTMLInputElement>('input')
    if (!input) throw new Error('NumberInput did not render its input.')
    input.value = '12abc'
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste', data: '12abc' }))
    await flush()
    submit(view)
    await flush()
    expect(submitResult).not.toHaveBeenCalled()
    expect(view.text()).toContain('Enter a valid number.')

    const reset = view.exposed().reset
    if (typeof reset !== 'function') throw new Error('Form does not expose reset().')
    await reset()
    await flush()

    const resetInput = view.host.querySelector<HTMLInputElement>('input')
    if (!resetInput) throw new Error('NumberInput did not render after Form reset.')
    expect(resetInput.value).toBe('8')
    expect(view.text()).not.toContain('Enter a valid number.')
    submit(view)
    await flush()

    expect(submitResult).toHaveBeenCalledOnce()
    expect(submitResult).toHaveBeenCalledWith({ amount: 8 })
  })

  it('resets invalid number text while preserving a pending file upload', async () => {
    const uploadResult = deferred<{ kind: 'file'; id: string; url: string; name: string }>()
    const upload = vi.fn(() => uploadResult.promise)
    const asset = {
      kind: 'file' as const,
      id: 'first.pdf',
      url: 'https://files.test/first.pdf',
      name: 'first.pdf',
    }
    const submitResult = vi.fn(async (data: { amount?: number; name?: string; files: typeof asset[] }) => data)
    let actionReset: (() => void) | undefined
    const view = mount({
      schema: z.object({
        amount: z.number().optional(),
        name: z.string().optional(),
        files: z.array(z.object({
          kind: z.literal('file'),
          id: z.string(),
          url: z.string(),
          name: z.string(),
        })),
      }),
      fields: {
        amount: { renderer: 'number' },
        name: { renderer: 'text' },
        files: { renderer: 'file', props: { multi: true } },
      },
      initialData: { amount: 8, name: 'Ada', files: [] },
      submit: submitResult,
    }, {
      actions: (scope) => {
        actionReset = scope.reset as (() => void) | undefined
        return h('div')
      },
    }, { assets: { ...testAssetAdapter, upload } })
    await flush()
    await vi.waitFor(() => expect(view.host.querySelector('[id$="-field-amount"]')).not.toBeNull())

    const numberInput = [...view.host.querySelectorAll<HTMLInputElement>('input')].find((input) => input.type !== 'file')
    const nameInput = view.host.querySelector<HTMLInputElement>('[id$="-field-name"]')
    const fileInput = view.host.querySelector<HTMLInputElement>('input[type="file"]')
    if (!numberInput || !nameInput || !fileInput) throw new Error('Form did not render all inputs.')
    numberInput.value = '12abc'
    numberInput.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste', data: '12abc' }))
    await flush()
    expect(numberInput.value).toBe('12abc')
    submit(view)
    await flush()
    expect(submitResult).not.toHaveBeenCalled()
    expect(view.text()).toContain('Enter a valid number.')

    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      value: [new File(['first'], 'first.pdf', { type: 'application/pdf' })],
    })
    fileInput.dispatchEvent(new Event('change'))
    await flush()
    expect(upload).toHaveBeenCalledOnce()
    expect(view.exposed().inputPending).toBe(true)
    expect(view.host.querySelector('[data-testid="file-upload-progress"]')).not.toBeNull()

    const reset = view.exposed().reset
    if (typeof reset !== 'function') throw new Error('Form does not expose reset().')
    expect(actionReset).toBe(reset)
    reset()
    await flush()

    const resetNumberInput = [...view.host.querySelectorAll<HTMLInputElement>('input')].find((input) => input.type !== 'file')
    if (!resetNumberInput) throw new Error('Form did not render the number input after reset.')
    expect(resetNumberInput.value).toBe('8')
    expect(resetNumberInput).not.toBe(numberInput)
    expect(view.host.querySelector('[id$="-field-name"]')).toBe(nameInput)
    expect(view.host.querySelector('input[type="file"]')).toBe(fileInput)
    expect(view.exposed().inputPending).toBe(true)
    expect(view.host.querySelector('[data-testid="file-upload-progress"]')).not.toBeNull()

    uploadResult.resolve(asset)
    await flush()
    expect(view.exposed().inputPending).toBe(false)
    submit(view)
    await flush()

    expect(submitResult).toHaveBeenCalledOnce()
    expect(submitResult).toHaveBeenCalledWith({ amount: 8, name: 'Ada', files: [asset] })

    if (!actionReset) throw new Error('Form actions slot did not provide reset().')
    actionReset()
    await flush()

    expect(view.exposed().draft).toMatchObject({ amount: 8, files: [] })
    expect(view.text()).not.toContain('first.pdf')
  })

  it('keeps invalid number text from submitting a previously committed value', async () => {
    const submitResult = vi.fn(async (data: { amount?: number }) => data)
    const view = mount({
      schema: z.object({ amount: z.number().optional() }),
      fields: { amount: { renderer: 'number' } },
      initialData: { amount: 12 },
      submit: submitResult,
    })
    await flush()
    await vi.waitFor(() => expect(view.host.querySelector('input')).not.toBeNull())

    const input = view.host.querySelector<HTMLInputElement>('input')
    if (!input) throw new Error('NumberInput did not render its input.')
    input.value = '-'
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: '-' }))
    await flush()
    submit(view)
    await flush()

    expect(submitResult).not.toHaveBeenCalled()
    expect(view.text()).toContain('Enter a valid number.')

    input.value = '12'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await flush()
    submit(view)
    await flush()

    expect(submitResult).toHaveBeenCalledOnce()
    expect(submitResult).toHaveBeenCalledWith({ amount: 12 })
  })

  it('unsets a cleared optional number instead of submitting zero', async () => {
    const submitResult = vi.fn(async (data: { amount?: number }) => data)
    const view = mount({
      schema: z.object({ amount: z.number().optional() }),
      fields: { amount: { renderer: 'number' } },
      initialData: { amount: 12 },
      submit: submitResult,
    })
    await flush()
    await vi.waitFor(() => expect(view.host.querySelector('input')).not.toBeNull())

    const input = view.host.querySelector<HTMLInputElement>('input')
    if (!input) throw new Error('NumberInput did not render its input.')
    input.value = ''
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward', data: null }))
    await flush()
    submit(view)
    await flush()

    expect(view.exposed().draft).toMatchObject({ amount: undefined })
    expect(submitResult).toHaveBeenCalledOnce()
    expect(submitResult.mock.calls[0]?.[0]?.amount).toBeUndefined()
  })

  it('clears a hidden control error and validates a fresh optional control when shown', async () => {
    const visible = ref(true)
    const schema = z.object({ amount: z.number().optional() })
    const fields = { amount: { renderer: 'number', behavior: { visible: ({ context }) => context.visible === true } } }
    const submitResult = vi.fn(async (data: { amount?: number }) => data)
    const Host = defineComponent({
      setup: () => () => h('div', [
        h('button', {
          type: 'button',
          'data-testid': 'toggle-amount',
          onClick: () => { visible.value = !visible.value },
        }, 'Toggle amount'),
        h(Form, {
          schema,
          fields,
          context: { visible: visible.value },
          submit: submitResult,
        }),
      ]),
    })
    const view = mountCore(Host, {})
    mounted.push(view)
    await flush()
    await vi.waitFor(() => expect(view.host.querySelector('input')).not.toBeNull())

    const input = view.host.querySelector<HTMLInputElement>('input')
    if (!input) throw new Error('NumberInput did not render its input.')
    input.value = '12abc'
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste', data: '12abc' }))
    await flush()

    view.find<HTMLButtonElement>('[data-testid="toggle-amount"]')?.click()
    await flush()
    expect(view.host.querySelector('input')).toBeNull()
    submit(view)
    await flush()
    expect(submitResult).toHaveBeenCalledOnce()
    expect(submitResult).toHaveBeenCalledWith({})

    view.find<HTMLButtonElement>('[data-testid="toggle-amount"]')?.click()
    await flush()
    await vi.waitFor(() => expect(view.host.querySelector('input')).not.toBeNull())
    submit(view)
    await flush()

    expect(submitResult).toHaveBeenCalledTimes(2)
    expect(submitResult).toHaveBeenLastCalledWith({})
    expect(view.text()).not.toContain('Enter a valid number.')

    const shownInput = view.host.querySelector<HTMLInputElement>('input')
    if (!shownInput) throw new Error('NumberInput did not render after the field was shown.')
    expect(shownInput.value).toBe('')
    shownInput.value = '12abc'
    shownInput.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste', data: '12abc' }))
    await flush()
    submit(view)
    await flush()

    expect(submitResult).toHaveBeenCalledTimes(2)
    expect(view.text()).toContain('Enter a valid number.')

    shownInput.value = '15'
    shownInput.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: '15' }))
    await flush()
    submit(view)
    await flush()

    expect(submitResult).toHaveBeenCalledTimes(3)
    expect(submitResult).toHaveBeenLastCalledWith({ amount: 15 })
  })

  it('cancels pending validation when a remounted control reports the same error text', async () => {
    const visible = ref(true)
    const validationGate = deferred<void>()
    const schema = z.object({ amount: z.number().optional() })
    const fields = { amount: { renderer: 'number', behavior: { visible: ({ context }) => context.visible === true } } }
    let validationSignal: AbortSignal | undefined
    const validator = vi.fn(async ({ signal }: { signal: AbortSignal }) => {
      validationSignal = signal
      await validationGate.promise
    })
    const submitResult = vi.fn(async (data: { amount?: number }) => data)
    const Host = defineComponent({
      setup: () => () => h('div', [
        h('button', {
          type: 'button',
          'data-testid': 'toggle-amount',
          onClick: () => { visible.value = !visible.value },
        }, 'Toggle amount'),
        h(Form, {
          schema,
          fields,
          context: { visible: visible.value },
          validators: [{ validate: validator }],
          submit: submitResult,
        }),
      ]),
    })
    const view = mountCore(Host, {})
    mounted.push(view)
    await flush()
    await vi.waitFor(() => expect(view.host.querySelector('input')).not.toBeNull())

    const input = view.host.querySelector<HTMLInputElement>('input')
    if (!input) throw new Error('NumberInput did not render its input.')
    input.value = '12abc'
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste', data: '12abc' }))
    await flush()

    view.find<HTMLButtonElement>('[data-testid="toggle-amount"]')?.click()
    await flush()
    submit(view)
    await flush()
    expect(validator).toHaveBeenCalledOnce()

    view.find<HTMLButtonElement>('[data-testid="toggle-amount"]')?.click()
    await flush()
    const shownInput = view.host.querySelector<HTMLInputElement>('input')
    if (!shownInput) throw new Error('NumberInput did not render after the field was shown.')
    shownInput.value = '12abc'
    shownInput.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste', data: '12abc' }))
    await flush()
    validationGate.resolve()
    await flush()

    expect(validationSignal?.aborted).toBe(true)
    expect(submitResult).not.toHaveBeenCalled()
    submit(view)
    await flush()
    expect(validator).toHaveBeenCalledOnce()
    expect(submitResult).not.toHaveBeenCalled()
    expect(view.text()).toContain('Enter a valid number.')
  })

  it('invalidates submit validation when a control reports local text errors', async () => {
    const validationGate = deferred<void>()
    let validatorSignal: AbortSignal | undefined
    const validator = vi.fn(async ({ signal }: { signal: AbortSignal }) => {
      validatorSignal = signal
      await validationGate.promise
    })
    const submitResult = vi.fn(async (data: { amount?: number }) => data)
    const view = mount({
      schema: z.object({ amount: z.number().optional() }),
      fields: { amount: { renderer: 'number' } },
      initialData: { amount: 12 },
      validators: [{ validate: validator }],
      submit: submitResult,
    })
    await flush()
    await vi.waitFor(() => expect(view.host.querySelector('input')).not.toBeNull())

    submit(view)
    await flush()
    expect(validator).toHaveBeenCalledOnce()

    const input = view.host.querySelector<HTMLInputElement>('input')
    if (!input) throw new Error('NumberInput did not render its input.')
    input.value = '1.2.3'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await flush()
    validationGate.resolve()
    await flush()

    expect(validatorSignal?.aborted).toBe(true)
    expect(submitResult).not.toHaveBeenCalled()
    expect(view.text()).toContain('Enter a valid number.')
  })

  it('parses once before async validators and invokes the accepted submit once', async () => {
    const validatorGate = deferred<void>()
    let transformCalls = 0
    let validatorData: unknown
    const schema = z.object({
      name: z.string().transform((value) => {
        transformCalls += 1
        return value.trim().toUpperCase()
      }),
    })
    const submitResult = vi.fn(async (data: { name: string }) => ({ id: data.name }))
    const view = mount({
      schema,
      fields: { name: { renderer: 'text' } },
      initialData: { name: 'Ada' },
      validators: [{
        validate: async ({ data }: { data: { name: string } }) => {
          validatorData = data
          await validatorGate.promise
        },
      }],
      submit: submitResult,
    })
    await flush()

    submit(view)
    await flush()
    expect(transformCalls).toBe(1)
    expect(validatorData).toEqual({ name: 'ADA' })
    expect(submitResult).not.toHaveBeenCalled()

    validatorGate.resolve()
    await flush()

    expect(submitResult).toHaveBeenCalledOnce()
    expect(submitResult).toHaveBeenCalledWith({ name: 'ADA' })
  })

  it('discards validation when the draft changes before the validator resolves', async () => {
    const validatorGate = deferred<void>()
    const submitResult = vi.fn(async () => 'saved')
    const view = mount({
      schema: z.object({ name: z.string() }),
      fields: { name: { renderer: 'text' } },
      initialData: { name: 'Ada' },
      validators: [{ validate: async () => validatorGate.promise }],
      submit: submitResult,
    })
    await flush()

    submit(view)
    await flush()
    setText(view, 'name', 'Grace')
    await flush()
    validatorGate.resolve()
    await flush()

    expect(submitResult).not.toHaveBeenCalled()
    expect(view.exposed().draft).toMatchObject({ name: 'Grace' })
  })

  it('does not retarget pending validation when the submit handler changes', async () => {
    const validationGate = deferred<void>()
    const originalSubmit = vi.fn(async () => 'original')
    const replacementSubmit = vi.fn(async () => 'replacement')
    const currentSubmit = shallowRef(originalSubmit)
    const Host = defineComponent({
      setup: () => () => h(Form, {
        schema: z.object({ name: z.string() }),
        fields: { name: { renderer: 'text' } },
        initialData: { name: 'Ada' },
        validators: [{ validate: async () => validationGate.promise }],
        submit: currentSubmit.value,
      }),
    })
    const view = mountCore(Host, {})
    mounted.push(view)
    await flush()

    submit(view)
    await flush()
    currentSubmit.value = replacementSubmit
    await flush()
    validationGate.resolve()
    await flush()

    expect(originalSubmit).not.toHaveBeenCalled()
    expect(replacementSubmit).not.toHaveBeenCalled()
  })

  it('blocks submission while a child input has pending work', async () => {
    const PendingControl = defineComponent({
      setup() {
        const pending = useFormInputPending()
        let release = () => undefined
        onMounted(() => {
          release = pending.begin().release
        })
        return () => h('button', { type: 'button', onClick: () => release() }, 'Finish upload')
      },
    })
    const submitResult = vi.fn(async () => 'saved')
    const view = mount({
      schema: z.object({ file: z.string().optional() }),
      fields: { file: { renderer: 'text' } },
      submit: submitResult,
    }, {
      'input:file': () => h(PendingControl),
    })
    await flush()

    expect(view.exposed().inputPending).toBe(true)
    submit(view)
    await flush()
    expect(submitResult).not.toHaveBeenCalled()

    view.find<HTMLButtonElement>('button')?.click()
    await flush()
    expect(view.exposed().inputPending).toBe(false)
    submit(view)
    await flush()
    expect(submitResult).toHaveBeenCalledOnce()
  })

  it.each(['fulfill', 'reject'] as const)('keeps a late %s mutation result with its original session', async (settlement) => {
    const first = deferred<string>()
    const second = deferred<string>()
    const id = ref<'first' | 'second'>('first')
    const invalidated: string[] = []
    const submitted: string[] = []
    const errors: unknown[] = []
    const submitResult = vi.fn(async () => {
      const owner = id.value
      try {
        return await (owner === 'first' ? first.promise : second.promise)
      } finally {
        invalidated.push(owner)
      }
    })
    const Host = defineComponent({
      setup: () => () => h(Form, {
        schema: z.object({ name: z.string() }),
        fields: { name: { renderer: 'text' } },
        id: id.value,
        initialData: { name: id.value },
        submit: submitResult,
        onSubmitted: (result: string) => submitted.push(result),
        onError: (error: unknown) => errors.push(error),
      }),
    })
    const view = mountCore(Host, {})
    mounted.push(view)
    await flush()

    submit(view)
    await flush()
    expect(view.find<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true)

    id.value = 'second'
    await flush()
    submit(view)
    await flush()
    expect(submitResult).toHaveBeenCalledTimes(2)

    if (settlement === 'fulfill') first.resolve('first result')
    else first.reject(new Error('first failure'))
    await flush()

    expect(invalidated).toEqual(['first'])
    expect(submitted).toEqual([])
    expect(errors).toEqual([])
    expect(view.find<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true)

    second.resolve('second result')
    await flush()

    expect(invalidated).toEqual(['first', 'second'])
    expect(submitted).toEqual(['second result'])
    expect(errors).toEqual([])
  })

  it('omits hidden controls, retains unrendered schema values, and leaves schema defaults to parsing', async () => {
    const submitResult = vi.fn(async (data: { shown?: string; hidden?: string; retained: string; fallback?: string }) => data)
    const view = mount({
      schema: z.object({
        shown: z.string().optional(),
        hidden: z.string().optional(),
        retained: z.string(),
        fallback: z.string().default('schema default'),
      }),
      fields: {
        shown: { renderer: 'text' },
        hidden: { renderer: 'text', behavior: { visible: () => false } },
      },
      initialData: { shown: 'visible', hidden: 'secret', retained: 'kept' },
      submit: submitResult,
    })
    await flush()
    expect(view.exposed().draft).toMatchObject({ shown: 'visible', hidden: 'secret', retained: 'kept' })

    submit(view)
    await flush()

    expect(submitResult).toHaveBeenCalledOnce()
    expect(submitResult).toHaveBeenCalledWith({ shown: 'visible', retained: 'kept', fallback: 'schema default' })
  })
})
