import { describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import Button from '../Button.vue'
import ListItem from '../ListItem.vue'
import ChipFilter from '../../composites/ChipFilter.vue'
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

describe('ChipFilter', () => {
  it('renders accessible toggle buttons with aria-pressed and leading check icon on the selected item', async () => {
    const changes: Array<string | null | undefined> = []
    const view = mountCore(ChipFilter, {
      label: 'Status filter',
      selection: 'optional',
      modelValue: 'active',
      items: [
        { id: 'active', label: 'Active' },
        { id: 'retired', label: 'Retired' },
      ],
      'onUpdate:modelValue': (value: string | null | undefined) => changes.push(value),
    })
    await flush()

    const group = view.find<HTMLElement>('[role="group"]')!
    expect(group.getAttribute('aria-label')).toBe('Status filter')
    const buttons = view.all<HTMLButtonElement>('button')
    expect(buttons).toHaveLength(2)
    expect(buttons[0]?.getAttribute('aria-pressed')).toBe('true')
    expect(buttons[1]?.getAttribute('aria-pressed')).toBe('false')
    expect(buttons[0]?.querySelector('i[aria-hidden="true"]')?.className).toContain('ri-check-line')

    buttons[0]?.click()
    buttons[1]?.click()
    expect(changes).toEqual([null, 'retired'])
    view.unmount()
  })
})
