import { createApp, h, nextTick, ref } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import Tabs from '../Tabs.vue'

const mounted: Array<ReturnType<typeof createApp>> = []

const items = [
  { value: 'one', label: 'One' },
  { value: 'two', label: 'Two' },
]

function mountTabs(
  props: Record<string, unknown> = {},
  tabItems = items,
) {
  const host = document.createElement('div')
  document.body.append(host)
  const model = ref('one')
  const app = createApp({
    render() {
      return h(Tabs, {
        modelValue: model.value,
        'onUpdate:modelValue': (value: string) => (model.value = value),
        items: tabItems,
        label: 'Example tabs',
        ...props,
      })
    },
  })
  mounted.push(app)
  app.mount(host)
  return { host, model }
}

afterEach(() => {
  for (const app of mounted.splice(0)) app.unmount()
  document.body.innerHTML = ''
})

describe('Tabs', () => {
  it('uses string values and updates the parent model', async () => {
    const { host, model } = mountTabs()
    await nextTick()

    const tabs = host.querySelectorAll('[role="tab"]')
    expect(tabs).toHaveLength(2)
    expect(host.querySelector('[role="tablist"]')?.getAttribute('aria-label')).toBe('Example tabs')
    tabs[1].dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }))
    await nextTick()

    expect(model.value).toBe('two')
    expect(tabs[1].getAttribute('aria-selected')).toBe('true')
  })

  it('keeps keyboard selection accessible', async () => {
    const { host, model } = mountTabs()
    await nextTick()

    const first = host.querySelector('[role="tab"]') as HTMLElement
    first.focus()
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    await nextTick()
    await nextTick()

    expect(model.value).toBe('two')
    expect(host.querySelectorAll('[role="tab"]')[1]?.getAttribute('aria-selected')).toBe('true')
  })

  it('does not select a disabled item', async () => {
    const { host, model } = mountTabs({}, [
      { value: 'one', label: 'One' },
      { value: 'two', label: 'Two', disabled: true },
    ])
    await nextTick()

    const disabled = host.querySelectorAll('[role="tab"]')[1] as HTMLButtonElement
    expect(disabled.disabled).toBe(true)
    disabled.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }))
    await nextTick()

    expect(model.value).toBe('one')
  })

  it('does not write router query state', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', name: 'tabs', component: { render: () => h('div') } }],
    })
    await router.push({ name: 'tabs', query: { view: 'one' } })
    await router.isReady()

    const host = document.createElement('div')
    document.body.append(host)
    const model = ref('one')
    const app = createApp({
      render: () => h(Tabs, {
        modelValue: model.value,
        'onUpdate:modelValue': (value: string) => (model.value = value),
        items,
        label: 'Example tabs',
      }),
    })
    app.use(router)
    mounted.push(app)
    app.mount(host)
    await nextTick()

    host.querySelectorAll('[role="tab"]')[1]?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }))
    await nextTick()

    expect(model.value).toBe('two')
    expect(router.currentRoute.value.query).toEqual({ view: 'one' })
  })
})
