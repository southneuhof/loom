import { describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import Button from '../Button.vue'
import ListItem from '../ListItem.vue'
import { flush, mountCore } from '../../core/__tests__/harness'

describe('Button selected state on label buttons', () => {
  it('applies selected styling and aria-pressed on toggle label buttons', async () => {
    const toggled = vi.fn()
    const view = mountCore(
      Button,
      { variant: 'outlined', toggle: true, selected: true, 'onUpdate:selected': toggled },
      { slots: { default: () => 'Cards' } },
    )
    await flush()

    const button = view.find<HTMLButtonElement>('button')!
    expect(button.getAttribute('aria-pressed')).toBe('true')
    expect(button.classList.contains('bg-primary')).toBe(true)
    expect(button.classList.contains('text-on-primary')).toBe(true)

    button.click()
    expect(toggled).toHaveBeenCalledWith(false)
    view.unmount()
  })
})

describe('ListItem', () => {
  it('renders an accessible selectable row and switches to anchor semantics when href is provided', async () => {
    const clicked = vi.fn()
    const selectable = mountCore(
      ListItem,
      { selected: true, onClick: clicked },
      { slots: { default: () => h('span', 'WO-2026-0003') } },
    )
    await flush()

    const button = selectable.find<HTMLButtonElement>('button')!
    expect(button.getAttribute('aria-pressed')).toBe('true')
    expect(button.classList.contains('bg-primary-container')).toBe(true)
    button.click()
    expect(clicked).toHaveBeenCalledOnce()
    selectable.unmount()

    const link = mountCore(
      ListItem,
      { selected: true, href: '/orders/3' },
      { slots: { default: () => h('span', 'WO-2026-0003') } },
    )
    await flush()

    const anchor = link.find<HTMLAnchorElement>('a')!
    expect(anchor.getAttribute('href')).toBe('/orders/3')
    expect(anchor.getAttribute('aria-current')).toBe('page')
    expect(anchor.hasAttribute('aria-pressed')).toBe(false)
    link.unmount()
  })
})
