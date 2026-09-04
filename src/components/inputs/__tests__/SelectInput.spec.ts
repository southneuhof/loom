import { createApp, defineComponent, h, nextTick, ref, type App } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import { FrameworkPlugin } from '../../../adapters/plugin'
import SelectInput from '../SelectInput.vue'

const apps: App[] = []

async function mountSelect(initial: unknown, multi = true) {
  const model = ref(initial)
  const host = document.createElement('div')
  document.body.append(host)
  const app = createApp(defineComponent({
    setup: () => () => h(SelectInput, {
      data: [{ id: 'one', name: 'One' }, { id: 'two', name: 'Two' }],
      modelValue: model.value,
      multi,
      'onUpdate:modelValue': (value: unknown) => { model.value = value },
    }),
  }))
  app.use(FrameworkPlugin)
  app.mount(host)
  apps.push(app)
  await nextTick()
  return { host, model }
}

afterEach(() => {
  apps.splice(0).forEach((app) => app.unmount())
  document.body.innerHTML = ''
})

describe('SelectInput multi value contract', () => {
  it('emits selected records and clears to an empty record array', async () => {
    const view = await mountSelect([])
    const trigger = view.host.querySelector('[class*="focus-within:outline-secondary"]') as HTMLElement
    trigger.click()
    await nextTick()

    const option = [...document.body.querySelectorAll<HTMLElement>('*')].find((element) => element.textContent === 'Two')
    expect(option).toBeDefined()
    option?.click()
    await nextTick()
    expect(view.model.value).toEqual([{ id: 'two', name: 'Two' }])

    const clear = view.host.querySelector('button') as HTMLButtonElement
    clear.click()
    await nextTick()
    expect(view.model.value).toEqual([])
  })
})

describe('SelectInput single value contract', () => {
  it('clears to null', async () => {
    const view = await mountSelect('one', false)
    const clear = view.host.querySelector('button') as HTMLButtonElement
    clear.click()
    await nextTick()
    expect(view.model.value).toBeNull()
  })
})
