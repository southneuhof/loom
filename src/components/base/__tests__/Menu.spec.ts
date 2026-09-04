import { createApp, h, nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Menu from '../Menu.vue'

const mounted: Array<ReturnType<typeof createApp>> = []

function mountMenu(action = vi.fn()) {
  const host = document.createElement('div')
  document.body.append(host)

  const app = createApp({
    render() {
      return h(
        Menu,
        { items: [{ name: 'Archive', action }] },
        {
          trigger: () => h('button', { type: 'button' }, 'Open menu'),
        },
      )
    },
  })

  mounted.push(app)
  app.mount(host)

  return { host, action }
}

afterEach(() => {
  for (const app of mounted.splice(0)) app.unmount()
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('Menu', () => {
  it('opens from the trigger and calls the selected item action', async () => {
    const { host, action } = mountMenu()
    const trigger = host.querySelector('button') as HTMLButtonElement

    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()

    const item = document.body.querySelector('[role="menuitem"]') as HTMLElement
    expect(item?.textContent).toContain('Archive')

    item.dispatchEvent(new Event('select', { bubbles: true }))
    item.click()
    await nextTick()

    expect(action).toHaveBeenCalled()
  })
})
