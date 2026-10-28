import { createApp, defineComponent, h, nextTick, ref } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import { FrameworkPlugin } from '../../../adapters/plugin'
import NumberInput from '../NumberInput.vue'

const mounted: Array<ReturnType<typeof createApp>> = []

afterEach(() => {
  for (const app of mounted.splice(0)) app.unmount()
  document.body.innerHTML = ''
})

describe('text-like input surfaces', () => {
  it('keeps digits in place while a currency amount is typed', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const model = ref(0)
    const app = createApp(defineComponent({
      setup: () => () => h(NumberInput, {
        currency: 'IDR',
        locale: 'id-ID',
        modelValue: model.value,
        'onUpdate:modelValue': (value: number) => { model.value = value },
      }),
    }))
    app.use(FrameworkPlugin)
    mounted.push(app)
    app.mount(host)

    const input = host.querySelector<HTMLInputElement>('input')
    if (!input) throw new Error('NumberInput did not render its input.')
    input.focus()
    for (const value of ['4', '40', '400', '4000', '40000']) {
      input.value = value
      input.dispatchEvent(new Event('input', { bubbles: true }))
      await nextTick()
      expect(input.value).toBe(value)
    }
    expect(model.value).toBe(40000)

    input.blur()
    await nextTick()
    expect(input.value).toBe('40.000')
  })
})
