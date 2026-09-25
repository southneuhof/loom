import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref, type App } from 'vue'
import { z } from 'zod/v4'
import { FrameworkPlugin } from '../../../adapters/plugin'
import { createFrameworkQueryClient } from '../../../query'
import { defineForm } from '../../../forms/defineForm'
import Form from '../Form.vue'
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
})
