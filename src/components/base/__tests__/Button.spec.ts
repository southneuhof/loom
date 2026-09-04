import { createApp, h, nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Button from '../Button.vue'

const mounted: Array<ReturnType<typeof createApp>> = []

function mountButton(props: Record<string, unknown> = {}, slots: Record<string, any> = {}) {
  const host = document.createElement('div')
  document.body.append(host)

  const app = createApp({
    render() {
      return h(Button, props, {
        default: () => 'Save',
        ...slots,
      })
    },
  })

  mounted.push(app)
  app.mount(host)

  return {
    host,
    root: host.firstElementChild as HTMLElement,
  }
}

afterEach(() => {
  for (const app of mounted.splice(0)) app.unmount()
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('Button', () => {
  it('renders a submit button by default', () => {
    const { root } = mountButton()

    expect(root.tagName).toBe('BUTTON')
    expect(root.getAttribute('type')).toBe('submit')
    expect(root.className).toContain('bg-primary')
    expect(root.className).toContain('text-on-primary')
  })

  it('renders an anchor for href and forwards target', () => {
    const { root } = mountButton({ href: '/save', target: '_blank' })

    expect(root.tagName).toBe('A')
    expect(root.getAttribute('href')).toBe('/save')
    expect(root.getAttribute('target')).toBe('_blank')
    expect(root.getAttribute('type')).toBeNull()
  })

  it('maps regular variants to Material role classes', () => {
    expect(mountButton({ variant: 'elevated' }).root.className).toContain('bg-surface-container-low')
    expect(mountButton({ variant: 'filled' }).root.className).toContain('bg-primary')
    expect(mountButton({ variant: 'tonal' }).root.className).toContain('bg-secondary-container')
    expect(mountButton({ variant: 'outlined' }).root.className).toContain('border-outline')
    expect(mountButton({ variant: 'text' }).root.className).toContain('bg-transparent')
  })

  it('maps semantic colors across button variants', () => {
    expect(mountButton({ color: 'info', variant: 'filled' }).root.className).toContain('bg-info')
    expect(mountButton({ color: 'success', variant: 'tonal' }).root.className).toContain('bg-success-container')
    expect(mountButton({ color: 'warning', variant: 'outlined' }).root.className).toContain('text-warning')
    expect(mountButton({ color: 'error', variant: 'text' }).root.className).toContain('text-error')
    expect(mountButton({ color: 'error', variant: 'elevated' }).root.className).toContain('text-error')
  })

  it('uses semantic color for selected standard icon buttons', () => {
    const { root } = mountButton(
      {
        kind: 'icon',
        variant: 'standard',
        color: 'error',
        toggle: true,
        selected: true,
        ariaLabel: 'Add favorite',
      },
      { icon: () => h('span') },
    )

    expect(root.className).toContain('bg-error')
    expect(root.className).toContain('text-on-error')
  })

  it('uses aria-label for icon buttons and warns when missing in development', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    const { root } = mountButton(
      { kind: 'icon', variant: 'standard', ariaLabel: 'Search' },
      { icon: () => h('span', { 'data-testid': 'icon' }) },
    )

    expect(root.getAttribute('aria-label')).toBe('Search')
    expect(root.className).toContain('text-on-surface-variant')

    mountButton({ kind: 'icon', variant: 'standard' }, { icon: () => h('span') })

    expect(warn).toHaveBeenCalledWith('[Button] kind="icon" requires aria-label for accessible icon-only usage.')
  })

  it('emits toggle events for icon buttons', async () => {
    const events = {
      updateSelected: vi.fn(),
      input: vi.fn(),
      change: vi.fn(),
    }

    const { root } = mountButton(
      {
        kind: 'icon',
        variant: 'filled',
        toggle: true,
        selected: false,
        ariaLabel: 'Add favorite',
        'onUpdate:selected': events.updateSelected,
        onInput: events.input,
        onChange: events.change,
      },
      { icon: () => h('span') },
    )

    root.click()
    await nextTick()

    expect(root.getAttribute('aria-pressed')).toBe('false')
    expect(events.updateSelected).toHaveBeenCalledWith(true)
    expect(events.input).toHaveBeenCalledTimes(1)
    expect(events.change).toHaveBeenCalledTimes(1)
  })

  it('prevents native disabled button clicks', async () => {
    const click = vi.fn()
    const { root } = mountButton({ disabled: true, onClick: click })

    root.click()
    await nextTick()

    expect((root as HTMLButtonElement).disabled).toBe(true)
    expect(click).not.toHaveBeenCalled()
  })

  it('keeps soft-disabled buttons focusable and suppresses clicks', async () => {
    const click = vi.fn()
    const { root } = mountButton({ softDisabled: true, onClick: click })

    root.focus()
    root.click()
    await nextTick()

    expect(root.getAttribute('aria-disabled')).toBe('true')
    expect(root.getAttribute('tabindex')).toBe('0')
    expect(document.activeElement).toBe(root)
    expect(click).not.toHaveBeenCalled()
  })

  it('renders split buttons with two interactive children and emits trailing-click', async () => {
    const trailingClick = vi.fn()
    const { root } = mountButton({ kind: 'split', variant: 'filled', menuAriaLabel: 'More save options', onTrailingClick: trailingClick }, { icon: () => h('span') })
    const buttons = root.querySelectorAll('button')

    expect(root.getAttribute('role')).toBe('group')
    expect(buttons).toHaveLength(2)
    expect(buttons[1].getAttribute('aria-haspopup')).toBe('menu')

    buttons[1].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()

    expect(trailingClick).toHaveBeenCalledTimes(1)
  })

  it('exposes split menu state and aria expansion', async () => {
    const { root } = mountButton(
      { kind: 'split', variant: 'filled', menuAriaLabel: 'More save options' },
      {
        menu: ({ open, close }: { open: boolean; close: () => void }) =>
          h('button', { type: 'button', 'data-open': String(open), onClick: close }, 'Close'),
      },
    )

    const trailing = root.querySelectorAll('button')[1]
    expect(trailing.getAttribute('aria-expanded')).toBe('false')

    trailing.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()

    expect(trailing.getAttribute('aria-expanded')).toBe('true')
    expect(document.body.querySelector('[data-open="true"]')).toBeTruthy()
  })

  it('falls back for invalid kind and variant combinations', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    expect(mountButton({ kind: 'button', variant: 'standard' }).root.className).toContain('text-primary')
    expect(mountButton({ kind: 'icon', variant: 'text', ariaLabel: 'Search' }).root.className).toContain('text-on-surface-variant')

    const { root } = mountButton({ kind: 'split', variant: 'standard' })
    const firstButton = root.querySelector('button')

    expect(firstButton?.className).toContain('bg-primary')
  })
})
