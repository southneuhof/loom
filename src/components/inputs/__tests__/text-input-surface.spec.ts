import { createApp, defineComponent, h, nextTick, ref, type Component } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FrameworkPlugin } from '../../../adapters/plugin'
import TextInput from '../TextInput.vue'
import TextareaInput from '../TextareaInput.vue'
import NumberInput from '../NumberInput.vue'
import PasswordInput from '../PasswordInput.vue'
import SelectInput from '../SelectInput.vue'

const mounted: Array<ReturnType<typeof createApp>> = []

async function mountInput(component: Component, props: Record<string, unknown> = {}) {
  const host = document.createElement('div')
  document.body.append(host)
  const model = ref('')
  const app = createApp(defineComponent({
    setup: () => () => h(component, {
      modelValue: model.value,
      'onUpdate:modelValue': (value: string) => { model.value = value },
      ...props,
    }),
  }))
  app.use(FrameworkPlugin )
  mounted.push(app)
  app.mount(host)
  await nextTick()

  return host
}

afterEach(() => {
  for (const app of mounted.splice(0)) app.unmount()
  document.body.innerHTML = ''
})

describe('text-like input surfaces', () => {
  it.each([
    ['text', TextInput, {}],
    ['textarea', TextareaInput, {}],
    ['number', NumberInput, {}],
    ['currency', NumberInput, { currency: 'IDR', locale: 'id-ID' }],
    ['select', SelectInput, { data: [{ id: '1', name: 'Admin' }] }],
  ])('keeps the %s control transparent with a subtle secondary focus ring', async (_name, component, props) => {
    const host = await mountInput(component, props)
    const control = [...host.querySelectorAll<HTMLElement>('div')].find((element) => element.classList.contains('focus-within:outline-secondary'))

    expect(control).toBeDefined()
    expect(control?.classList.contains('bg-transparent')).toBe(true)
    expect(control?.classList.contains('outline-1')).toBe(true)
    expect(control?.classList.contains('focus-within:ring-1')).toBe(true)
    expect(control?.classList.contains('transition-[outline-color,box-shadow]')).toBe(true)
    expect(control?.classList.contains('bg-surface')).toBe(false)
    expect(control?.classList.contains('bg-surface-container')).toBe(false)
    expect(control?.classList.contains('!bg-surface-variant/50')).toBe(false)
  })

  it('recreates a currency input through NumberInput props', async () => {
    const host = await mountInput(NumberInput, {
      currency: 'IDR',
      locale: 'id-ID',
      modelValue: 125000,
    })

    expect(host.querySelector('p')?.textContent).toBe('Rp')
    expect(host.querySelector('input')?.value).toBe('125.000')
  })

  it('keeps digits in place while a currency amount is typed', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const model = ref(0)
    const app = createApp(defineComponent({
      setup: () => () => h(NumberInput, {
        currency: 'IDR',
        locale: 'id-ID',
        modelValue: model.value,
        'onUpdate:modelValue': (value: number) => { model.value = value },
      }),
    }))
    app.use(FrameworkPlugin)
    mounted.push(app)
    app.mount(host)

    const input = host.querySelector('input')!
    input.focus()
    for (const value of ['4', '40', '400', '4000', '40000']) {
      input.value = value
      input.dispatchEvent(new Event('input', { bubbles: true }))
      await nextTick()
      expect(input.value).toBe(value)
    }
    expect(model.value).toBe(40000)

    input.blur()
    await nextTick()
    expect(input.value).toBe('40.000')
  })

  it.each([
    ['en-US', '1,000'],
    ['id-ID', '1.000'],
  ])('accepts valid %s grouped numbers', async (locale, text) => {
    const host = document.createElement('div')
    document.body.append(host)
    const model = ref<number | null | undefined>()
    const validationErrors = vi.fn()
    const app = createApp(defineComponent({
      setup: () => () => h(NumberInput, {
        locale,
        modelValue: model.value,
        'onUpdate:modelValue': (value: number | null | undefined) => { model.value = value },
        'onValidation:error': validationErrors,
      }),
    }))
    app.use(FrameworkPlugin)
    mounted.push(app)
    app.mount(host)

    const input = host.querySelector<HTMLInputElement>('input')
    if (!input) throw new Error('NumberInput did not render its input.')
    input.value = text
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste', data: text }))
    await nextTick()

    expect(model.value).toBe(1000)
    expect(validationErrors).toHaveBeenLastCalledWith(undefined)
  })

  it('reports invalid pasted and partial number text without replacing the number model', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const model = ref<number | undefined>(8)
    const validationErrors = vi.fn()
    const app = createApp(defineComponent({
      setup: () => () => h(NumberInput, {
        modelValue: model.value,
        'onUpdate:modelValue': (value: number | undefined) => { model.value = value },
        'onValidation:error': validationErrors,
      }),
    }))
    app.use(FrameworkPlugin)
    mounted.push(app)
    app.mount(host)

    const input = host.querySelector<HTMLInputElement>('input')
    if (!input) throw new Error('NumberInput did not render its input.')
    input.value = '12abc'
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste', data: '12abc' }))
    await nextTick()
    expect(input.value).toBe('12abc')
    expect(model.value).toBe(8)
    expect(validationErrors).toHaveBeenLastCalledWith('Enter a valid number.')

    input.value = '-'
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: '-' }))
    await nextTick()

    expect(input.value).toBe('-')
    expect(model.value).toBe(8)
    expect(validationErrors).toHaveBeenLastCalledWith('Enter a valid number.')

    input.value = '12'
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: '12' }))
    await nextTick()

    expect(model.value).toBe(12)
    expect(validationErrors).toHaveBeenLastCalledWith(undefined)
  })

  it('emits an unset number when the control is cleared', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const model = ref<number | undefined>(9)
    const validationErrors = vi.fn()
    const app = createApp(defineComponent({
      setup: () => () => h(NumberInput, {
        modelValue: model.value,
        'onUpdate:modelValue': (value: number | undefined) => { model.value = value },
        'onValidation:error': validationErrors,
      }),
    }))
    app.use(FrameworkPlugin)
    mounted.push(app)
    app.mount(host)

    const input = host.querySelector<HTMLInputElement>('input')
    if (!input) throw new Error('NumberInput did not render its input.')
    input.value = ''
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward', data: null }))
    await nextTick()

    expect(model.value).toBeUndefined()
    expect(validationErrors).toHaveBeenLastCalledWith(undefined)
  })

  it('keeps invalid numeric textarea drafts local and emits valid number and unset values', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const model = ref<string | number | undefined>(9)
    const validationErrors = vi.fn()
    const app = createApp(defineComponent({
      setup: () => () => h(TextareaInput, {
        constraint: ['number'] as const,
        modelValue: model.value,
        'onUpdate:modelValue': (value: string | number | undefined) => { model.value = value },
        'onValidation:error': validationErrors,
      }),
    }))
    app.use(FrameworkPlugin)
    mounted.push(app)
    app.mount(host)

    const textarea = host.querySelector<HTMLTextAreaElement>('textarea')
    if (!textarea) throw new Error('TextareaInput did not render its textarea.')
    textarea.value = '.'
    textarea.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: '.' }))
    await nextTick()

    expect(textarea.value).toBe('.')
    expect(model.value).toBe(9)
    expect(validationErrors).toHaveBeenLastCalledWith('Enter a valid number.')

    textarea.value = '12abc'
    textarea.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste', data: '12abc' }))
    await nextTick()

    expect(textarea.value).toBe('12abc')
    expect(model.value).toBe(9)
    expect(validationErrors).toHaveBeenLastCalledWith('Enter a valid number.')

    textarea.value = '6'
    textarea.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: '6' }))
    await nextTick()

    expect(model.value).toBe(6)
    expect(validationErrors).toHaveBeenLastCalledWith(undefined)

    textarea.value = ''
    textarea.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward', data: null }))
    await nextTick()

    expect(model.value).toBeUndefined()
    expect(validationErrors).toHaveBeenLastCalledWith(undefined)
    model.value = undefined
    await nextTick()

    expect(textarea.value).toBe('')
  })

  it('keeps a numeric PasswordInput clear unset through its text model', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const model = ref<string | undefined>('9')
    const app = createApp(defineComponent({
      setup: () => () => h(PasswordInput, {
        constraint: ['number'] as const,
        modelValue: model.value,
        'onUpdate:modelValue': (value: string | undefined) => { model.value = value },
      }),
    }))
    app.use(FrameworkPlugin)
    mounted.push(app)
    app.mount(host)

    const input = host.querySelector<HTMLInputElement>('input')
    if (!input) throw new Error('PasswordInput did not render its input.')
    input.value = ''
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward', data: null }))
    await nextTick()

    expect(model.value).toBeUndefined()

    input.value = '6'
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: '6' }))
    await nextTick()

    expect(model.value).toBe('6')
  })

  it('replaces retained invalid text when the parent replaces the number model', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const model = ref<number | null | undefined>(8)
    const validationErrors = vi.fn()
    const app = createApp(defineComponent({
      setup: () => () => h(NumberInput, {
        modelValue: model.value,
        'onUpdate:modelValue': (value: number | null | undefined) => { model.value = value },
        'onValidation:error': validationErrors,
      }),
    }))
    app.use(FrameworkPlugin)
    mounted.push(app)
    app.mount(host)

    const input = host.querySelector<HTMLInputElement>('input')
    if (!input) throw new Error('NumberInput did not render its input.')
    input.focus()
    input.value = '12abc'
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste', data: '12abc' }))
    await nextTick()
    expect(input.value).toBe('12abc')
    expect(validationErrors).toHaveBeenLastCalledWith('Enter a valid number.')

    model.value = 24
    await nextTick()

    expect(input.value).toBe('24')
    expect(validationErrors).toHaveBeenLastCalledWith(undefined)
  })
})
