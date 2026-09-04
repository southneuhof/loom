import { describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { flush, mountCore } from '../../core/__tests__/harness'
import NavigationHeader from '../NavigationHeader.vue'

async function mountHeader(
  props: Record<string, unknown> = {},
  slots: Record<string, () => ReturnType<typeof h>> = {},
  options: { uiDefaults?: { backLabel?: string } } = {},
) {
  const view = mountCore(NavigationHeader, props, { slots, uiDefaults: options.uiDefaults })
  await flush()
  return { router: view.router, view }
}

describe('NavigationHeader', () => {
  it('renders title, description, controls, and a real target link', async () => {
    const { view } = await mountHeader(
      { title: 'Request Overtime', description: 'Add request.', backTo: '/records' },
      { controls: () => h('button', { 'data-control': '' }, 'Submit') },
    )

    expect(view.find('h1')?.textContent).toBe('Request Overtime')
    expect(view.text()).toContain('Add request.')
    expect(view.find('[data-control]')).not.toBeNull()
    expect(view.find<HTMLAnchorElement>('a[aria-label="Back"]')?.getAttribute('href')).toBe('/records')
    view.unmount()
  })

  it('lets header slot replace default heading content', async () => {
    const { view } = await mountHeader(
      { title: 'Default', description: 'Default description' },
      { header: () => h('h2', 'Custom heading') },
    )

    expect(view.find('h1')).toBeNull()
    expect(view.text()).toContain('Custom heading')
    expect(view.text()).not.toContain('Default description')
    view.unmount()
  })

  it('falls back to router history and keeps button keyboard semantics', async () => {
    const { router, view } = await mountHeader({ backLabel: 'Go back' })
    const go = vi.spyOn(router.options.history, 'go').mockImplementation(() => {})
    const button = view.find<HTMLButtonElement>('button[aria-label="Go back"]')!

    expect(button.tagName).toBe('BUTTON')
    button.click()
    expect(go).toHaveBeenCalledWith(-1)
    go.mockRestore()
    view.unmount()
  })

  it('resolves the back label as prop, then app default, then "Back"', async () => {
    const injected = await mountHeader({}, {}, { uiDefaults: { backLabel: 'Kembali' } })
    expect(injected.view.find('button[aria-label="Kembali"]')).not.toBeNull()
    injected.view.unmount()

    const propWins = await mountHeader({ backLabel: 'Terug' }, {}, { uiDefaults: { backLabel: 'Kembali' } })
    expect(propWins.view.find('button[aria-label="Terug"]')).not.toBeNull()
    expect(propWins.view.find('button[aria-label="Kembali"]')).toBeNull()
    propWins.view.unmount()

    const plain = await mountHeader()
    expect(plain.view.find('button[aria-label="Back"]')).not.toBeNull()
    plain.view.unmount()
  })
})
