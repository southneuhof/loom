import { describe, expect, it } from 'vitest'
import { createApp, defineComponent, h, nextTick } from 'vue'
import { createRendererRegistries, createRendererRegistry, useRendererRegistries } from '../registry'
import { FrameworkPlugin } from '../../adapters/plugin'
import TextInput from '../../components/inputs/TextInput.vue'

const Chip = defineComponent({ name: 'Chip', setup: () => () => h('span') })
const ProjectChip = defineComponent({ name: 'ProjectChip', setup: () => () => h('em') })

declare module '../displayContracts' {
  interface DisplayRendererComponents {
    chip: typeof Chip
  }
}

function mountWithRenderers(renderers: Parameters<typeof createRendererRegistries>[0]) {
  let registries: ReturnType<typeof useRendererRegistries> | undefined
  const app = createApp(
    defineComponent({
      setup() {
        registries = useRendererRegistries()
        return () => h('div')
      },
    }),
  )
  app.use(FrameworkPlugin, { renderers })
  app.mount(document.createElement('div'))
  return { app, registries: registries! }
}

describe('renderer registry', () => {
  it('uses number for currency amounts without a second renderer', () => {
    const registry = createRendererRegistries().form
    expect(registry.has('number')).toBe(true)
    expect(registry.has('currency')).toBe(false)
  })

  it('uses TextInput with its Vue model and component-owned validity event', async () => {
    const updated: unknown[] = []
    const host = document.createElement('div')
    const app = createApp(defineComponent({
      setup: () => () => h(TextInput, {
        id: 'field-name',
        modelValue: 'Admin',
        error: 'Sudah dipakai',
        disabled: true,
        class: 'custom-control',
        'aria-invalid': 'true',
        'aria-describedby': 'error-name',
        'onUpdate:modelValue': (value: string | number | undefined) => updated.push(value),
        'onValidation:touch': () => updated.push('touched'),
      }),
    }))
    app.mount(host)

    const wrapper = host.firstElementChild!
    const input = host.querySelector<HTMLInputElement>('input')!
    const control = input.parentElement!
    expect(input.value).toBe('Admin')
    expect(input.id).toBe('field-name')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(input.getAttribute('aria-describedby')).toBe('error-name')
    expect(input.classList.contains('custom-control')).toBe(false)
    expect(wrapper.classList.contains('custom-control')).toBe(true)
    expect(control.classList.contains('outline-error')).toBe(true)
    expect(control.classList.contains('bg-transparent')).toBe(true)
    expect(control.classList.contains('outline-1')).toBe(true)
    expect(control.classList.contains('focus-within:outline-error')).toBe(true)
    expect(control.classList.contains('focus-within:ring-error/30')).toBe(true)
    expect(control.classList.contains('transition-[outline-color,box-shadow]')).toBe(true)
    expect(wrapper.classList.contains('bg-surface-variant/50')).toBe(false)
    expect(control.classList.contains('cursor-not-allowed')).toBe(true)

    input.value = 'Editor'
    input.dispatchEvent(new Event('input'))
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    await nextTick()
    expect(updated).toEqual(['Editor', 'touched'])
    app.unmount()
  })

  it('looks up registered display renderers', () => {
    const registry = createRendererRegistry('display', { chip: Chip })

    expect(registry.get('chip')).toBe(Chip)
    expect(registry.has('chip')).toBe(true)
    expect(registry.keys()).toEqual(['chip'])
  })

  it('reports missing keys with the registered alternatives', () => {
    const registry = createRendererRegistry('form', { text: Chip })

    expect(() => registry.require('date')).toThrow('No form renderer registered for "date". Registered: text.')
    expect(() => createRendererRegistry('table').require('chip')).toThrow('Registered: none.')
  })

  it('lets a later display registration override an earlier one', () => {
    const registry = createRendererRegistry('display', { chip: Chip })
    registry.register('chip', ProjectChip)

    expect(registry.get('chip')).toBe(ProjectChip)
  })

  it('keeps surfaces independent', () => {
    const registries = createRendererRegistries({ display: { chip: Chip }, form: { text: ProjectChip } })

    expect(registries.display.has('text')).toBe(false)
    expect(registries.form.has('chip')).toBe(false)
  })

  it('registers display components in one shared display registry', () => {
    const mounted = mountWithRenderers({ display: { chip: Chip } })

    expect(mounted.registries.display.get('chip')).toBe(Chip)
    expect(mounted.registries.form.has('chip')).toBe(false)
    mounted.app.unmount()
  })

  it('reports unknown display renderer keys', () => {
    const registry = createRendererRegistry('display')

    expect(() => registry.require('unknown')).toThrow(
      '[loom][RENDERER_NOT_REGISTERED] No display renderer registered for "unknown". Registered: none.',
    )
  })

  it('isolates registries between apps', () => {
    const first = mountWithRenderers({ display: { chip: Chip } })
    const second = mountWithRenderers({ display: { chip: ProjectChip } })

    expect(first.registries.display.get('chip')).toBe(Chip)
    expect(second.registries.display.get('chip')).toBe(ProjectChip)

    first.registries.display.register('extra', Chip)
    expect(second.registries.display.has('extra')).toBe(false)

    first.app.unmount()
    second.app.unmount()
  })
})
