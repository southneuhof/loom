import { createApp, defineComponent, h, nextTick, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import BaseInput from '../BaseInput.vue'

describe('BaseInput', () => {
  it('renders linked label, control, helper, and error in order and emits touch when focus leaves', async () => {
    const touch = vi.fn()
    const current = ref({
      id: 'name-field',
      label: 'Name',
      helperMessage: 'Help',
      error: 'Required',
      'aria-describedby': 'authored-hint authored-hint',
      required: true,
    })
    const host = document.createElement('div')
    const app = createApp(defineComponent({
      setup: () => () => h(BaseInput, {
        ...current.value,
        'onValidation:touch': touch,
      }, ({ controlBindings }) => [h('input', controlBindings), h('button')]),
    }))
    app.mount(host)

    const label = host.querySelector<HTMLLabelElement>('label')
    const input = host.querySelector<HTMLInputElement>('input')
    const helper = Array.from(host.querySelectorAll<HTMLElement>('*')).find((element) => element.textContent === 'Help')
    const error = Array.from(host.querySelectorAll<HTMLElement>('*')).find((element) => element.textContent === 'Required')
    expect(label?.htmlFor).toBe('name-field')
    expect(host.textContent).toContain('*')
    expect(input?.id).toBe('name-field')
    expect(helper?.textContent).toBe('Help')
    expect(error?.textContent).toBe('Required')
    expect(error?.getAttribute('role')).toBe('alert')
    expect(input?.getAttribute('aria-invalid')).toBe('true')
    expect(input?.getAttribute('aria-describedby')?.split(' ')).toEqual([
      'authored-hint',
      helper?.id,
      error?.id,
    ])
    expect(label?.compareDocumentPosition(input!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(input?.compareDocumentPosition(helper!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(helper?.compareDocumentPosition(error!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    const button = host.querySelector('button')!
    input!.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: button }))
    await nextTick()
    expect(touch).not.toHaveBeenCalled()
    button.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    await nextTick()
    expect(touch).toHaveBeenCalledTimes(1)
    app.unmount()
  })

  it('renders helper and error without a label and removes only the cleared message link', async () => {
    const current = ref({
      helperMessage: 'Help',
      error: 'Required',
      'aria-describedby': 'authored-hint',
      required: true,
    })
    const host = document.createElement('div')
    const app = createApp(defineComponent({
      setup: () => () => h(BaseInput, current.value, ({ controlBindings }) => h('input', controlBindings)),
    }))
    app.mount(host)

    const input = host.querySelector<HTMLInputElement>('input')
    const helper = Array.from(host.querySelectorAll<HTMLElement>('*')).find((element) => element.textContent === 'Help')
    const error = Array.from(host.querySelectorAll<HTMLElement>('*')).find((element) => element.textContent === 'Required')
    expect(host.querySelector('label')).toBeNull()
    expect(input?.id).toBeTruthy()
    expect(input?.required).toBe(true)
    expect(input?.getAttribute('aria-describedby')?.split(' ')).toEqual([
      'authored-hint',
      helper?.id,
      error?.id,
    ])
    expect(new Set([helper?.id, error?.id]).size).toBe(2)

    current.value = { ...current.value, error: '' }
    await nextTick()

    expect(Array.from(host.querySelectorAll<HTMLElement>('*')).some((element) => element.textContent === 'Required')).toBe(false)
    expect(input?.getAttribute('aria-describedby')?.split(' ')).toEqual(['authored-hint', helper?.id])
    expect(input?.getAttribute('aria-invalid')).toBeNull()
    app.unmount()
  })

  it('does not render an orphan required marker without a local label', () => {
    const host = document.createElement('div')
    const app = createApp(defineComponent({
      setup: () => () => h(BaseInput, { required: true }, ({ controlBindings }) => h('input', controlBindings)),
    }))
    app.mount(host)

    expect(host.textContent).not.toContain('*')
    expect(host.querySelector('input')?.required).toBe(true)
    app.unmount()
  })
})
