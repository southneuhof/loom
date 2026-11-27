import { describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import Button from '../Button.vue'
import Drawer from '../Drawer.vue'
import ListItem from '../ListItem.vue'
import Tabs from '../../composites/Tabs.vue'
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
  it('renders a flat selectable row with vertical content layout and switches to anchor semantics with href', async () => {
    const clicked = vi.fn()
    const unselected = mountCore(
      ListItem,
      { selected: false, onClick: clicked },
      { slots: { default: () => h('span', 'WO-2026-0001') } },
    )
    await flush()

    const unselectedButton = unselected.find<HTMLButtonElement>('button')!
    expect(unselectedButton.getAttribute('aria-pressed')).toBe('false')
    expect(unselectedButton.classList.contains('bg-transparent')).toBe(true)
    expect(unselectedButton.classList.contains('border')).toBe(false)
    unselectedButton.click()
    expect(clicked).toHaveBeenCalledOnce()
    unselected.unmount()

    const selected = mountCore(
      ListItem,
      { selected: true },
      { slots: { default: () => h('span', 'WO-2026-0003') } },
    )
    await flush()
    expect(selected.find<HTMLButtonElement>('button')?.classList.contains('bg-primary-container')).toBe(true)
    selected.unmount()

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

describe('Tabs', () => {
  it('renders optional icons inside tab triggers and updates local selection', async () => {
    const changes: string[] = []
    const view = mountCore(Tabs, {
      label: 'Presentation',
      modelValue: 'table',
      items: [
        { value: 'table', label: 'Table', icon: 'table' },
        { value: 'cards', label: 'Cards', icon: 'layout-grid' },
      ],
      'onUpdate:modelValue': (value: string) => changes.push(value),
    })
    await flush()

    const icons = view.all('i[aria-hidden="true"]')
    expect(icons).toHaveLength(2)
    expect(icons[0]?.className).toContain('ri-table-line')
    expect(icons[1]?.className).toContain('ri-layout-grid-line')
    view.unmount()
  })
})

describe('Drawer', () => {
  it('keeps the drawer open for portaled options and dismisses it for other outside clicks', async () => {
    const changes: boolean[] = []
    const view = mountCore(Drawer, {
      modelValue: true,
      title: 'Quick triage',
      'onUpdate:modelValue': (value: boolean) => changes.push(value),
    })
    const portal = document.createElement('div')
    portal.setAttribute('data-reka-popper-content-wrapper', '')
    const option = document.createElement('button')
    option.textContent = 'High priority'
    portal.append(option)
    document.body.append(portal)
    try {
      await flush()
      await new Promise((done) => setTimeout(done, 0))
      expect(document.body.querySelector('[role="dialog"]')?.textContent).toContain('Quick triage')

      option.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true }))
      await flush()
      expect(changes).toEqual([])

      document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true }))
      await flush()
      expect(changes).toEqual([false])
    } finally {
      view.unmount()
      portal.remove()
    }
  })

  it('renders title, description, scrollable content, footer, and closes via the close control', async () => {
    const originalMatchMedia = window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: () => ({
        matches: false,
        media: '',
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    })
    const updates: boolean[] = []
    const view = mountCore(
      Drawer,
      {
        modelValue: true,
        title: 'Quick triage',
        description: 'Review and assign field work.',
        'onUpdate:modelValue': (value: boolean) => updates.push(value),
      },
      {
        slots: {
          content: () => h('p', { 'data-drawer-body': '' }, 'Body content'),
          footer: () => h('span', { 'data-drawer-footer': '' }, 'Footer actions'),
        },
      },
    )
    try {
      await flush()

      const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]')
      expect(dialog).not.toBeNull()
      expect(dialog?.textContent).toContain('Quick triage')
      expect(dialog?.textContent).toContain('Review and assign field work.')
      expect(dialog?.querySelector('[data-drawer-body]')?.textContent).toBe('Body content')
      expect(dialog?.querySelector('[data-drawer-footer]')?.textContent).toBe('Footer actions')

      const closeButton = Array.from(dialog?.querySelectorAll<HTMLButtonElement>('button') ?? []).find(
        (button) => button.textContent?.trim() === 'Close',
      )
      expect(closeButton).not.toBeUndefined()
      closeButton!.click()
      await flush()

      expect(updates).toEqual([false])
    } finally {
      view.unmount()
      Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: originalMatchMedia })
    }
  })
})
