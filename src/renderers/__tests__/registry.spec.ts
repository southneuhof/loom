import { describe, expect, it } from 'vitest'
import { createApp, defineComponent, h } from 'vue'
import { createRendererRegistries, createRendererRegistry, useRendererRegistries } from '../registry'
import { FrameworkPlugin } from '../../adapters/plugin'
import { adaptVModelInput, builtInFormRenderers } from '../form'

const Chip = defineComponent({ name: 'Chip', setup: () => () => h('span') })
const ProjectChip = defineComponent({ name: 'ProjectChip', setup: () => () => h('em') })

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
  it('adapts core controlled state to Vue v-model without leaking core-only props', () => {
    const received: Record<string, unknown> = {}
    const updated: unknown[] = []
    const Input = defineComponent({
      inheritAttrs: false,
      props: { modelValue: null, id: String, disabled: Boolean, error: String },
      emits: ['update:modelValue', 'validation:touch'],
      setup(props, { attrs, emit }) {
        Object.assign(received, props, attrs)
        return () => h('button', {
          onClick: () => {
            emit('update:modelValue', 'next')
            emit('validation:touch')
          },
        })
      },
    })
    const host = document.createElement('div')
    const app = createApp(defineComponent({
      setup: () => () => h(adaptVModelInput(Input), {
        value: 'current',
        setValue: (value: unknown) => updated.push(value),
        id: 'asset',
        disabled: true,
        error: 'bad',
        ordinary: 'yes',
        draft: { hidden: true },
        field: { hidden: true },
        touched: true,
        'onValidation:touch': () => updated.push('touch'),
      }),
    }))
    app.mount(host)
    host.querySelector('button')!.click()
    expect(received).toMatchObject({ modelValue: 'current', id: 'asset', disabled: true, error: 'bad', ordinary: 'yes' })
    expect(received).not.toHaveProperty('draft')
    expect(received).not.toHaveProperty('field')
    expect(received).not.toHaveProperty('touched')
    expect(updated).toEqual(['next', 'touch'])
    app.unmount()
  })
  it('renders the core text control with native value, ARIA, and state behavior', () => {
    const updated: unknown[] = []
    const host = document.createElement('div')
    const app = createApp(defineComponent({
      setup: () => () => h(builtInFormRenderers.text, {
        id: 'field-name',
        value: 'Admin',
        error: 'Sudah dipakai',
        disabled: true,
        class: 'custom-control',
        'aria-invalid': 'true',
        'aria-describedby': 'error-name',
        setValue: (value: unknown) => updated.push(value),
        'onValidation:touch': () => updated.push('touched'),
      }),
    }))
    app.mount(host)

    const wrapper = host.firstElementChild!
    const input = host.querySelector<HTMLInputElement>('input')!
    expect(input.value).toBe('Admin')
    expect(input.id).toBe('field-name')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(input.getAttribute('aria-describedby')).toBe('error-name')
    expect(input.classList.contains('custom-control')).toBe(false)
    expect(wrapper.classList.contains('custom-control')).toBe(true)
    expect(wrapper.classList.contains('outline-error')).toBe(true)
    expect(wrapper.classList.contains('bg-transparent')).toBe(true)
    expect(wrapper.classList.contains('outline-1')).toBe(true)
    expect(wrapper.classList.contains('focus-within:outline-error')).toBe(true)
    expect(wrapper.classList.contains('focus-within:ring-error/30')).toBe(true)
    expect(wrapper.classList.contains('transition-[outline-color,box-shadow]')).toBe(true)
    expect(wrapper.classList.contains('bg-surface-variant/50')).toBe(false)
    expect(wrapper.classList.contains('cursor-not-allowed')).toBe(true)

    input.value = 'Editor'
    input.dispatchEvent(new Event('input'))
    input.dispatchEvent(new Event('blur'))
    expect(updated).toEqual(['Editor', 'touched'])
    app.unmount()
  })

  it('looks up registered renderers per surface', () => {
    const registry = createRendererRegistry('table', { chip: Chip })

    expect(registry.get('chip')).toBe(Chip)
    expect(registry.has('chip')).toBe(true)
    expect(registry.keys()).toEqual(['chip'])
  })

  it('reports missing keys with the registered alternatives', () => {
    const registry = createRendererRegistry('form', { text: Chip })

    expect(() => registry.require('date')).toThrow('No form renderer registered for "date". Registered: text.')
    expect(() => createRendererRegistry('table').require('chip')).toThrow('Registered: none.')
  })

  it('lets a later registration override an earlier one', () => {
    const registry = createRendererRegistry('detail', { chip: Chip })
    registry.register('chip', ProjectChip)

    expect(registry.get('chip')).toBe(ProjectChip)
  })

  it('keeps surfaces independent', () => {
    const registries = createRendererRegistries({ table: { chip: Chip }, form: { text: ProjectChip } })

    expect(registries.table.has('text')).toBe(false)
    expect(registries.form.has('chip')).toBe(false)
  })

  it('isolates registries between apps', () => {
    const first = mountWithRenderers({ table: { chip: Chip } })
    const second = mountWithRenderers({ table: { chip: ProjectChip } })

    expect(first.registries.table.get('chip')).toBe(Chip)
    expect(second.registries.table.get('chip')).toBe(ProjectChip)

    first.registries.table.register('extra', Chip)
    expect(second.registries.table.has('extra')).toBe(false)

    first.app.unmount()
    second.app.unmount()
  })
})
