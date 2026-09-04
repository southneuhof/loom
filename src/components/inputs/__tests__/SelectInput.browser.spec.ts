import { createApp, defineComponent, h, nextTick, ref, type App } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import { FrameworkPlugin } from '../../../adapters/plugin'
import SelectInput from '../SelectInput.vue'

const apps: App[] = []

async function settle() {
  await nextTick()
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  await nextTick()
}

afterEach(() => {
  apps.splice(0).forEach((app) => app.unmount())
  document.body.innerHTML = ''
})

describe('SelectInput browser behavior', () => {
  it('uses SearchBox and keeps the popover anchored after selecting an item', async () => {
    const host = document.createElement('div')
    host.style.cssText = 'position: absolute; left: 100px; top: 120px; width: 300px;'
    document.body.append(host)
    const model = ref<string | null>(null)
    const app = createApp(defineComponent({
      setup: () => () => h(SelectInput, {
        data: [{ id: 'one', name: 'One' }, { id: 'two', name: 'Two' }],
        modelValue: model.value,
        multi: false,
        'onUpdate:modelValue': (value: string | null) => { model.value = value },
      }),
    }))
    app.use(FrameworkPlugin)
    app.mount(host)
    apps.push(app)

    await settle()
    const trigger = host.querySelector('[class*="focus-within:outline-secondary"]') as HTMLElement
    trigger.click()
    await settle()

    const search = document.body.querySelector('input[placeholder="Cari..."]') as HTMLInputElement | null
    expect(search).not.toBeNull()
    expect(search?.parentElement?.classList.contains('rounded-full')).toBe(true)

    const option = [...document.body.querySelectorAll<HTMLElement>('*')].find((element) => element.textContent?.trim() === 'Two')
    expect(option).toBeDefined()
    option?.click()
    await settle()

    const selectedTrigger = host.querySelector('[class*="focus-within:outline-secondary"]') as HTMLElement
    const triggerRect = selectedTrigger.getBoundingClientRect()
    selectedTrigger.click()
    await settle()

    const content = document.body.querySelector('[data-reka-popper-content-wrapper]') as HTMLElement
    const contentRect = content.getBoundingClientRect()
    expect(Math.abs(contentRect.left - triggerRect.left)).toBeLessThan(2)
    expect(contentRect.top).toBeGreaterThan(triggerRect.bottom)
  })
})
