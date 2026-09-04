import { createApp, defineComponent, h, nextTick, ref, type Component } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import { FrameworkPlugin } from '../../../adapters/plugin'
import TextInput from '../TextInput.vue'
import TextareaInput from '../TextareaInput.vue'
import NumberInput from '../NumberInput.vue'
import SelectInput from '../SelectInput.vue'

const mounted: Array<ReturnType<typeof createApp>> = []

async function mountInput(component: Component, props: Record<string, unknown> = {}) {
  const host = document.createElement('div')
  document.body.append(host)
  const model = ref('')
  const app = createApp(defineComponent({
    setup: () => () => h(component, {
      modelValue: model.value,
      'onUpdate:modelValue': (value: string) => { model.value = value },
      ...props,
    }),
  }))
  app.use(FrameworkPlugin )
  mounted.push(app)
  app.mount(host)
  await nextTick()

  return host
}

afterEach(() => {
  for (const app of mounted.splice(0)) app.unmount()
  document.body.innerHTML = ''
})

describe('text-like input surfaces', () => {
  it.each([
    ['text', TextInput, {}],
    ['textarea', TextareaInput, {}],
    ['number', NumberInput, {}],
    ['currency', NumberInput, { currency: 'IDR', locale: 'id-ID' }],
    ['select', SelectInput, { data: [{ id: '1', name: 'Admin' }] }],
  ])('keeps the %s control transparent with a subtle secondary focus ring', async (_name, component, props) => {
    const host = await mountInput(component, props)
    const control = [...host.querySelectorAll<HTMLElement>('div')].find((element) => element.classList.contains('focus-within:outline-secondary'))

    expect(control).toBeDefined()
    expect(control?.classList.contains('bg-transparent')).toBe(true)
    expect(control?.classList.contains('outline-1')).toBe(true)
    expect(control?.classList.contains('focus-within:ring-1')).toBe(true)
    expect(control?.classList.contains('transition-[outline-color,box-shadow]')).toBe(true)
    expect(control?.classList.contains('bg-surface')).toBe(false)
    expect(control?.classList.contains('bg-surface-container')).toBe(false)
    expect(control?.classList.contains('!bg-surface-variant/50')).toBe(false)
  })

  it('recreates a currency input through NumberInput props', async () => {
    const host = await mountInput(NumberInput, {
      currency: 'IDR',
      locale: 'id-ID',
      modelValue: 125000,
    })

    expect(host.querySelector('p')?.textContent).toBe('Rp')
    expect(host.querySelector('input')?.value).toBe('125.000')
  })
})
