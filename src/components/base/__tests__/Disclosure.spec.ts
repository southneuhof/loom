import { createApp, h, nextTick, ref } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import Disclosure from '../Disclosure.vue'

const mounted: Array<ReturnType<typeof createApp>> = []

function mountDisclosure(initialOpen = false) {
  const host = document.createElement('div')
  document.body.append(host)
  const open = ref(initialOpen)

  const app = createApp({
    render() {
      return h(Disclosure, { title: 'Advanced', description: 'More filters', open: open.value }, { default: () => h('div', 'Panel content') })
    },
  })

  mounted.push(app)
  app.mount(host)

  return { host, open }
}

afterEach(() => {
  for (const app of mounted.splice(0)) app.unmount()
  document.body.innerHTML = ''
})

describe('Disclosure', () => {
  it('renders closed and toggles open from the trigger', async () => {
    const { host } = mountDisclosure()
    const trigger = host.querySelector('button') as HTMLButtonElement

    expect(trigger.getAttribute('aria-expanded')).toBe('false')

    trigger.click()
    await nextTick()

    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(host.textContent).toContain('Panel content')
  })

  it('syncs from the open prop', async () => {
    const { host, open } = mountDisclosure()
    const trigger = host.querySelector('button') as HTMLButtonElement

    open.value = true
    await nextTick()

    expect(trigger.getAttribute('aria-expanded')).toBe('true')
  })
})
