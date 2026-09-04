import { createApp, defineComponent, nextTick, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

import ColorInput from '../ColorInput.vue'

const mounted: Array<ReturnType<typeof createApp>> = []

async function mountColorInput(initialValue = '#FF0000FF', extraProps: Record<string, unknown> = {}) {
  const host = document.createElement('div')
  document.body.append(host)

  const model = ref(initialValue)
  const props = ref(extraProps)

  const Harness = defineComponent({
    components: { ColorInput },
    setup() {
      return {
        model,
        props,
      }
    },
    template: `
      <ColorInput
        v-model="model"
        label="Theme Color"
        helper-message="Use a hex color"
        :enable-helper-message="true"
        v-bind="props"
      />
    `,
  })

  const app = createApp(Harness)
  mounted.push(app)
  app.mount(host)

  await nextTick()

  const trigger = host.querySelector('[data-testid="color-trigger"]') as HTMLElement | null
  if (trigger && !String(extraProps.disabled ?? false).includes('true')) {
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()
  }

  return {
    host,
    model,
    props,
    setModel: async (value: string) => {
      model.value = value
      await nextTick()
    },
  }
}

afterEach(() => {
  for (const app of mounted.splice(0)) app.unmount()
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('ColorInput', () => {
  it('renders through the shared BaseInput contract', async () => {
    const { host } = await mountColorInput('#FF0000FF')

    expect(host.textContent).toContain('Theme Color')
    expect(host.textContent).toContain('Use a hex color')
    expect((host.querySelector('[data-testid="color-trigger"]') as HTMLElement).textContent).toContain('FF0000')
  })

  it('updates the model from hex and alpha inputs', async () => {
    const { model } = await mountColorInput('#FF0000FF')

    const hexInput = document.body.querySelector('[data-testid="color-hex-input"]') as HTMLInputElement
    hexInput.value = '00ff00'
    hexInput.dispatchEvent(new Event('input', { bubbles: true }))
    hexInput.dispatchEvent(new FocusEvent('blur', { bubbles: true }))
    await nextTick()

    expect(model.value).toBe('#00FF00FF')

    const alphaInput = document.body.querySelector('[data-testid="color-alpha-input"]') as HTMLInputElement
    alphaInput.value = '50'
    alphaInput.dispatchEvent(new Event('input', { bubbles: true }))
    alphaInput.dispatchEvent(new FocusEvent('blur', { bubbles: true }))
    await nextTick()

    expect(model.value).toBe('#00FF0080')
  })

  it('updates the model from the hue slider and saturation area', async () => {
    const { model } = await mountColorInput('#FF0000FF')

    const hueSlider = document.body.querySelector('[data-testid="color-hue-slider"]') as HTMLInputElement
    hueSlider.value = '240'
    hueSlider.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()

    expect(model.value).toBe('#0000FFFF')

    const saturationArea = document.body.querySelector('[data-testid="color-saturation-area"]') as HTMLElement
    Object.defineProperty(saturationArea, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ left: 0, top: 0, width: 100, height: 100 }),
    })

    saturationArea.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 0, clientY: 0 }))
    await nextTick()

    expect(model.value).toBe('#FFFFFFFF')
  })

  it('applies preset colors directly', async () => {
    const { model } = await mountColorInput('', {
      presetColors: [{ id: 'brand', label: 'Brand', value: '#2B74DD' }],
    })

    const preset = document.body.querySelector('[data-testid="color-preset"]') as HTMLButtonElement
    preset.click()
    await nextTick()

    expect(model.value).toBe('#2B74DDFF')
  })

  it('clears an existing color value', async () => {
    const { model, host } = await mountColorInput('#FF0000FF')

    const clearButton = document.body.querySelector('[data-testid="color-clear-button"]') as HTMLButtonElement
    clearButton.click()
    await nextTick()

    expect(model.value).toBe('')
    expect(host.textContent).toContain('Select color')
    expect(document.body.querySelector('[data-testid="color-clear-button"]')).toBeNull()
  })

  it('respects disabled mode', async () => {
    const { host } = await mountColorInput('#FF0000FF', { disabled: true })

    expect((host.querySelector('[data-testid="color-trigger"]') as HTMLElement).className).toContain('pointer-events-none')
    expect(document.body.querySelector('[data-testid="color-hex-input"]')).toBeNull()
  })

  it('syncs external model updates back into the editor state', async () => {
    const { setModel } = await mountColorInput('#FF0000FF')

    await setModel('#11223344')

    expect((document.body.querySelector('[data-testid="color-hex-input"]') as HTMLInputElement).value).toBe('112233')
    expect((document.body.querySelector('[data-testid="color-alpha-input"]') as HTMLInputElement).value).toBe('27')
  })
})
