import { defineComponent, h } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
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
  it('keeps a disabled checked switch visibly active', async () => {
    const view = mount(defineComponent({
      setup: () => () => h('div', [
        h(Switch, { id: 'locked-on', disabled: true, modelValue: true, label: 'Locked on' }),
        h(Switch, { id: 'locked-off', disabled: true, modelValue: false, label: 'Locked off' }),
      ]),
    }))
    await flush()

    const checked = view.find<HTMLButtonElement>('#locked-on')
    const unchecked = view.find<HTMLButtonElement>('#locked-off')
    expect(checked?.getAttribute('aria-checked')).toBe('true')
    expect(checked?.hasAttribute('disabled')).toBe(true)
    expect(unchecked?.getAttribute('aria-checked')).toBe('false')

    const checkedThumb = checked?.firstElementChild?.firstElementChild
    const uncheckedThumb = unchecked?.firstElementChild?.firstElementChild
    expect(checkedThumb?.classList.contains('translate-x-[22px]')).toBe(true)
    expect(uncheckedThumb?.classList.contains('translate-x-[22px]')).toBe(false)
    expect(checked?.classList.contains('bg-primary/[38%]')).toBe(true)
    expect(unchecked?.classList.contains('bg-surface-container-highest')).toBe(true)
  })
})
