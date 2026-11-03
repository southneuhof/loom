import { defineComponent, h, onMounted, onUnmounted, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import Form from '../Form.vue'
import TextInput from '../../inputs/TextInput.vue'
import type { FormFieldContext } from '../../../contracts/forms'
import type { FormPublisher } from '../../../forms/outputs'
import { useFormInputPending } from '../useFormInputState'
import { deferred, flush, mountCore } from './harness'
import { defineFormOutput } from '../../../forms/outputs'
import type { FrameworkAdaptersInput } from '../../../adapters/projectAdapters'

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
  it('isolates published outputs from drafts, writes and other editor identities', async () => {
    const output = defineFormOutput<{ eligible: boolean }>()
    const Publisher = defineComponent({
      props: { modelValue: String },
      emits: { evaluated: (_value: { eligible: boolean }) => true, 'update:modelValue': (_value: string) => true },
      setup(_props, { emit }) { return () => h('button', { type: 'button', onClick: () => emit('evaluated', { eligible: true }) }, 'Evaluate') },
    })
    const write = vi.fn(async (value: object) => value)
    const id = ref(1)
    let previousPublish: FormPublisher | undefined
    const fields = {
      name: ({ publish }: FormFieldContext<{ name: string; dependent?: string }>) => {
        previousPublish ??= publish
        return { renderer: Publisher, props: { onEvaluated: (value: { eligible: boolean }) => publish(output, value) } }
      },
      dependent: ({ outputs }: FormFieldContext<{ name: string; dependent?: string }>) => ({ renderer: 'text', visible: outputs.get(output)?.eligible === true }),
    }
    const form = { schema: z.object({ name: z.string(), dependent: z.string().optional() }), fields, initialData: { name: 'Ada' }, submit: write }
    const Host = defineComponent({ setup: () => () => h(Form, { ...form, id: id.value }) })
    const first = mountCore(Host, {})
    const second = mount(form)
    mounted.push(first)
    await flush()
    first.find<HTMLButtonElement>('button')!.click()
    await flush()
    expect(first.find('input')).not.toBeNull()
    expect(second.find('input')).toBeNull()
    const inner = first.find('form')!
    inner.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await flush()
    expect(write.mock.calls[0]?.[0]).toEqual({ name: 'Ada' })
    second.find<HTMLButtonElement>('button')!.click()
    await flush()
    expect(second.find('input')).not.toBeNull()
    expect(second.exposed().dirty).toBe(false)
    const reset = second.exposed().reset
    if (typeof reset !== 'function') throw new Error('Missing reset')
    reset()
    await flush()
    expect(second.find('input')).toBeNull()
    id.value = 2
    await flush()
    expect(first.find('input')).toBeNull()
    previousPublish?.(output, { eligible: true })
    await flush()
    expect(first.find('input')).toBeNull()
  })

  it('applies attempt visibility to control validity without clearing the editable draft', async () => {
    const Invalid = defineComponent({
      props: { modelValue: String },
      emits: { 'validation:error': (_message: string) => true },
      setup(_props, { emit }) { onMounted(() => emit('validation:error', 'Complete all answers')); return () => h('input') },
    })
    const write = vi.fn(async (value: object) => value)
    const view = mount({
      schema: z.object({ intent: z.enum(['pending', 'complete']).default('complete'), answers: z.string().optional() }),
      initialData: { intent: 'complete', answers: 'partial' },
      fields: { answers: ({ draft }: FormFieldContext<{ intent: 'pending' | 'complete'; answers?: string }>) => ({ renderer: Invalid, visible: draft.intent !== 'pending' }) },
      submit: write,
    })
    await flush()
    const run = view.exposed().submit
    if (typeof run !== 'function') throw new Error('Missing submit')
    await run({ values: { intent: 'pending' } })
    expect(write.mock.calls[0]?.[0]).toEqual({ intent: 'pending' })
    expect(view.exposed().draft).toEqual({ intent: 'complete', answers: 'partial' })
    await run()
    expect(write).toHaveBeenCalledOnce()
    expect(view.exposed().dirty).toBe(false)
  })

  it('renders a direct component without registration and retains form validation and disabled state', async () => {
    const LocalInput = defineComponent({
      props: { modelValue: String, disabled: Boolean, error: String, required: Boolean, id: String },
      emits: { 'update:modelValue': (value: string) => typeof value === 'string' },
      setup(props, { emit }) {
        return () => h(TextInput, { ...props, constraint: ['text'], 'onUpdate:modelValue': (value) => emit('update:modelValue', String(value)) })
      },
    })
    const disabled = ref(false)
    const write = vi.fn(async (value: { name: string }) => value)
    const view = mount({
      schema: z.object({ name: z.string().min(2) }),
      fields: { name: () => ({ renderer: LocalInput, props: { disabled: disabled.value } }) },
      initialData: { name: '' },
      submit: write,
    })
    await flush()
    submit(view)
    await flush()
    expect(write).not.toHaveBeenCalled()
    expect(view.find('[aria-invalid="true"]')).not.toBeNull()
    setText(view, 'name', 'Ada')
    await flush()
    submit(view)
    await flush()
    expect(write).toHaveBeenCalledExactlyOnceWith({ name: 'Ada' }, expect.objectContaining({ context: {} }))
    disabled.value = true
    await flush()
    expect(view.find<HTMLInputElement>('input')?.disabled).toBe(true)
  })

  it('remounts a changed direct renderer while retaining its form-owned draft', async () => {
    const leftUnmounted = vi.fn()
    const rightMounted = vi.fn()
    const Left = defineComponent({
      setup() {
        onUnmounted(leftUnmounted)
        return () => h(TextInput)
      },
    })
    const Right = defineComponent({
      setup() {
        onMounted(rightMounted)
        return () => h(TextInput)
      },
    })
    const renderer = ref(Left)
    const view = mount({
      schema: z.object({ name: z.string() }),
      fields: { name: () => ({ renderer: renderer.value }) },
      initialData: { name: 'Ada' },
      submit: vi.fn(),
    })
    await flush()
    renderer.value = Right
    await flush()
    expect(leftUnmounted).toHaveBeenCalledOnce()
    expect(rightMounted).toHaveBeenCalledOnce()
    expect(view.exposed().draft).toEqual({ name: 'Ada' })
  })

  it('uses attempt values before validation without changing the draft or the next native submit', async () => {
    const validator = vi.fn((_context: unknown) => undefined)
    const write = vi.fn(async (value: { intent: string; name: string }) => value)
    const view = mount({
      schema: z
        .object({ name: z.string(), intent: z.enum(['pending', 'complete']).default('complete') })
        .refine((value) => value.intent !== 'pending', { message: 'Pending rejected' })
        .transform((value) => ({ ...value, name: value.name.toUpperCase() })),
      initialData: { name: 'Ada' },
      fields: { name: { renderer: 'text' } },
      validators: [{ validate: validator }],
      submit: write,
    })
    await flush()
    const run = view.exposed().submit
    if (typeof run !== 'function') throw new Error('Missing submit')
    await run({ values: { intent: 'pending' } })
    expect(view.text()).toContain('Pending rejected')
    expect(write).not.toHaveBeenCalled()
    expect(view.exposed().draft).toEqual({ name: 'Ada' })
    expect(view.exposed().dirty).toBe(false)
    submit(view)
    await flush()
    expect(write).toHaveBeenCalledExactlyOnceWith({ name: 'ADA', intent: 'complete' }, expect.objectContaining({ context: {} }))
    expect(validator).toHaveBeenCalledOnce()
  })

  it('captures the first attempt values and keeps hidden fields omitted', async () => {
    const waiting = deferred<void>()
    const seen: unknown[] = []
    const write = vi.fn(async (value: object) => {
      seen.push(value)
      await waiting.promise
      return value
    })
    const validator = vi.fn((_context: unknown) => undefined)
    const view = mount({
      schema: z.object({ name: z.string(), secret: z.string().optional(), intent: z.string() }),
      fields: { name: { renderer: 'text' }, secret: { renderer: 'text', visible: false } },
      initialData: { name: 'Ada', secret: 'saved', intent: 'complete' },
      validators: [{ validate: validator }],
      submit: write,
    })
    await flush()
    const run = view.exposed().submit
    if (typeof run !== 'function') throw new Error('Missing submit')
    const values = { intent: 'pending', secret: 'injected' }
    const first = run({ values })
    values.intent = 'changed'
    const second = run({ values: { intent: 'complete' } })
    await flush()
    expect(seen).toEqual([{ name: 'Ada', intent: 'pending' }])
    expect(validator.mock.calls[0]?.[0]).toMatchObject({ draft: { intent: 'pending' }, data: { intent: 'pending' } })
    expect(view.exposed().dirty).toBe(false)
    expect(view.exposed().draft).toEqual({ name: 'Ada', secret: 'saved', intent: 'complete' })
    waiting.resolve()
    await Promise.all([first, second])
    expect(write).toHaveBeenCalledOnce()
  })



  it('shows a rejected unmatched required field in the form summary', async () => {
    const submitResult = vi.fn(async (data: { name: string; secret: string }) => data)
    const view = mount({
      schema: z.object({ name: z.string(), secret: z.string() }),
      fields: { name: { renderer: 'text' } },
      initialData: { name: 'Ada' },
      submit: submitResult,
    })
    await flush()

    submit(view)
    await flush()

    const summary = view.host.querySelector<HTMLElement>('[role="alert"]')
    expect(summary?.textContent).toContain('secret:')
    expect(submitResult).not.toHaveBeenCalled()
  })

  it('shows a root validation issue in the form summary', async () => {
    const submitResult = vi.fn(async (data: { name: string }) => data)
    const view = mount({
      schema: z.object({ name: z.string() }).refine(() => false, 'The form is incomplete.'),
      fields: { name: { renderer: 'text' } },
      initialData: { name: 'Ada' },
      submit: submitResult,
    })
    await flush()

    submit(view)
    await flush()

    const summary = view.host.querySelector<HTMLElement>('[role="alert"]')
    expect(summary?.textContent).toContain('The form is incomplete.')
    expect(submitResult).not.toHaveBeenCalled()
  })

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
    expect(submitResult).toHaveBeenCalledWith({ amount: 12 }, expect.objectContaining({ context: {} }))
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
    expect(submitResult).toHaveBeenCalledWith({ amount: 12 }, expect.objectContaining({ context: {} }))
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
    const fields = { amount: ({ context }: { context: { visible: boolean } }) => ({ renderer: 'number', visible: context.visible }) }
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
    expect(submitResult).toHaveBeenCalledWith({}, expect.objectContaining({ context: { visible: false } }))

    view.find<HTMLButtonElement>('[data-testid="toggle-amount"]')?.click()
    await flush()
    await vi.waitFor(() => expect(view.host.querySelector('input')).not.toBeNull())
    submit(view)
    await flush()

    expect(submitResult).toHaveBeenCalledTimes(2)
    expect(submitResult).toHaveBeenLastCalledWith({}, expect.objectContaining({ context: { visible: true } }))
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
    expect(submitResult).toHaveBeenLastCalledWith({ amount: 15 }, expect.objectContaining({ context: { visible: true } }))
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
    expect(submitResult).toHaveBeenCalledWith({ name: 'ADA' }, expect.objectContaining({ context: {} }))
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

  it('passes disabled to managed controls and custom slots during submission', async () => {
    const pending = deferred<void>()
    const view = mountCore(Form, {
      schema: z.object({ name: z.string(), custom: z.string() }),
      fields: { name: { renderer: 'text' }, custom: { renderer: 'text' } },
      initialData: { name: 'Ada', custom: 'Value' },
      submit: () => pending.promise,
    }, { slots: { 'input:custom': (scope) => h('input', { 'data-custom': '', disabled: scope.disabled }) } })
    mounted.push(view)
    await flush()
    submit(view)
    await flush()
    expect(view.find<HTMLInputElement>('input:not([data-custom])')?.disabled).toBe(true)
    expect(view.find<HTMLInputElement>('[data-custom]')?.disabled).toBe(true)
    pending.resolve()
    await flush()
    expect(view.find<HTMLInputElement>('input:not([data-custom])')?.disabled).toBe(false)
    expect(view.find<HTMLInputElement>('[data-custom]')?.disabled).toBe(false)
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
        hidden: { renderer: 'text', visible: false },
      },
      initialData: { shown: 'visible', hidden: 'secret', retained: 'kept' },
      submit: submitResult,
    })
    await flush()
    expect(view.exposed().draft).toMatchObject({ shown: 'visible', hidden: 'secret', retained: 'kept' })

    submit(view)
    await flush()

    expect(submitResult).toHaveBeenCalledOnce()
    expect(submitResult).toHaveBeenCalledWith({ shown: 'visible', retained: 'kept', fallback: 'schema default' }, expect.objectContaining({ context: {} }))
  })
})
