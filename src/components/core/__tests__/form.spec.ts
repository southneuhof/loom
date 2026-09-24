import { defineComponent, h, onMounted } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import Form from '../Form.vue'
import { useFormInputPending } from '../useFormInputState'
import { deferred, flush, mountCore } from './harness'

const mounted: Array<ReturnType<typeof mountCore>> = []

function mount(props: Record<string, unknown>, slots?: Record<string, (scope: Record<string, unknown>) => unknown>) {
  const view = mountCore(Form, props, { slots })
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
      missing: z.string().optional(),
      generated: z.string().optional(),
    })
    const fields = {
      text: { initialValue: () => `default-${++overriddenFactoryCalls}` },
      amount: { initialValue: () => 7 },
      active: { initialValue: () => true },
      missing: { initialValue: () => { overriddenFactoryCalls += 1; return 'factory' } },
      generated: { initialValue: () => `generated-${++defaultCalls}` },
    }
    const props = {
      schema,
      fields,
      initialData: { text: '', amount: 0, active: false, missing: undefined },
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
          'input:missing': capture(0, 'missing'),
          'input:generated': capture(0, 'generated'),
        }),
        h(Form, props, {
          'input:text': capture(1, 'text'),
          'input:amount': capture(1, 'amount'),
          'input:active': capture(1, 'active'),
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
    expect(captures[0].has('missing')).toBe(true)
    expect(captures[0].get('missing')).toBeUndefined()
    expect(new Set([captures[0].get('generated'), captures[1].get('generated')]).size).toBe(2)
    expect(defaultCalls).toBe(2)
    expect(overriddenFactoryCalls).toBe(0)
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
      fields: { name: {} },
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
      fields: { name: {} },
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
      fields: { file: {} },
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
        shown: {},
        hidden: { behavior: { visible: () => false } },
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
