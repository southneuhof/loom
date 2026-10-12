import { defineComponent, h, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Switch from '../Switch.vue'
import { flush, mountCore } from '../../core/__tests__/harness'

const mounted: Array<ReturnType<typeof mountCore>> = []

function mount(component: Parameters<typeof mountCore>[0]) {
  const view = mountCore(component, {})
  mounted.push(view)
  return view
}

afterEach(() => {
  for (const view of mounted.splice(0)) view.unmount()
  document.body.innerHTML = ''
})

describe('Switch control attributes', () => {
  it('routes attributes, names the switch, exposes state, and keeps disabled callbacks inactive', async () => {
    const model = ref(false)
    const updates: boolean[] = []
    const onToggle = vi.fn()
    const onActive = vi.fn()
    const onDeactive = vi.fn()
    const disabledToggle = vi.fn()
    const validationTouch = vi.fn()
    const view = mount(defineComponent({
      setup: () => () => h('div', [
        h(Switch, {
          id: 'email-alerts',
          name: 'emailAlerts',
          label: 'Email alerts',
          'aria-label': 'Send email alerts',
          'aria-describedby': 'account-hint',
          'data-control': 'notifications',
          class: 'switch-wrapper',
          style: { marginTop: '4px' },
          helperMessage: 'Choose which alerts to receive.',
          error: 'Choose at least one alert.',
          required: true,
          modelValue: model.value,
          'onUpdate:modelValue': (value: boolean) => {
            model.value = value
            updates.push(value)
          },
          onToggle,
          onActive,
          onDeactive,
          'onValidation:touch': validationTouch,
        }),
        h(Switch, {
          id: 'locked-preferences',
          description: 'Preferences unavailable',
          disabled: true,
          modelValue: false,
          onToggle: disabledToggle,
        }),
      ]),
    }))
    await flush()

    const control = view.find<HTMLButtonElement>('#email-alerts')
    expect(control).not.toBeNull()
    expect(control!.tagName).toBe('BUTTON')
    expect(control!.type).toBe('button')
    expect(control!.name).toBe('emailAlerts')
    expect(control!.getAttribute('aria-label')).toBe('Send email alerts')
    expect(control!.getAttribute('data-control')).toBe('notifications')
    expect(control!.getAttribute('role')).toBe('switch')
    expect(control!.getAttribute('aria-checked')).toBe('false')
    expect(control!.getAttribute('aria-required')).toBe('true')
    expect(control!.getAttribute('aria-invalid')).toBe('true')
    expect(control!.classList.contains('switch-wrapper')).toBe(false)

    const describedBy = control!.getAttribute('aria-describedby')?.split(/\s+/) ?? []
    expect(describedBy).toContain('account-hint')
    expect(describedBy.map((id) => view.find(`#${id}`)?.textContent?.trim())).toContain('Choose which alerts to receive.')
    expect(describedBy.map((id) => view.find(`#${id}`)?.textContent?.trim())).toContain('Choose at least one alert.')
    expect(view.find('.switch-wrapper')?.style.marginTop).toBe('4px')

    const outside = document.createElement('button')
    document.body.append(outside)
    control!.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: outside }))
    expect(validationTouch).toHaveBeenCalledOnce()
    outside.remove()

    control!.click()
    await flush()
    expect(model.value).toBe(true)
    expect(updates).toEqual([true])
    expect(control!.getAttribute('aria-checked')).toBe('true')
    expect(onToggle).toHaveBeenCalledWith(true)
    expect(onActive).toHaveBeenCalledOnce()

    control!.click()
    await flush()
    expect(model.value).toBe(false)
    expect(updates).toEqual([true, false])
    expect(control!.getAttribute('aria-checked')).toBe('false')
    expect(onToggle).toHaveBeenLastCalledWith(false)
    expect(onDeactive).toHaveBeenCalledOnce()

    const fallbackName = view.find<HTMLButtonElement>('#locked-preferences')
    expect(fallbackName?.getAttribute('aria-label')).toBe('Preferences unavailable')
    fallbackName?.click()
    await flush()
    expect(fallbackName?.getAttribute('aria-checked')).toBe('false')
    expect(disabledToggle).not.toHaveBeenCalled()
  })
})
