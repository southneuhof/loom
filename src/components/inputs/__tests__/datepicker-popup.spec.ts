import { createApp, defineComponent, h, nextTick, type Component } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DateInput from '../DateInput.vue'
import DateRangeInput from '../DateRangeInput.vue'
import MonthInput from '../MonthInput.vue'
import TimeInput from '../TimeInput.vue'
import YearInput from '../YearInput.vue'

const picker = vi.hoisted(() => ({
  latest: {} as Record<string, unknown>,
  triggerBlur: undefined as (() => void) | undefined,
  triggerModelUpdate: undefined as (() => void) | undefined,
}))

vi.mock('@vuepic/vue-datepicker', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    default: defineComponent({
      inheritAttrs: false,
      props: {
        modelValue: null,
        teleport: null,
        config: null,
        autoApply: Boolean,
        inline: Boolean,
        timePicker: Boolean,
        range: Boolean,
        weekPicker: Boolean,
        monthPicker: Boolean,
        yearPicker: Boolean,
        format: Function,
      },
      setup(props, { attrs, emit }) {
        return () => {
          picker.latest = { ...props, class: attrs.class }
          picker.triggerBlur = () => emit('blur')
          picker.triggerModelUpdate = () => emit('update:model-value')
          return h('div', {
            'data-testid': 'mock-datepicker',
            class: attrs.class,
            onFocusout: attrs.onFocusout,
          })
        }
      },
      emits: ['blur', 'update:model-value'],
    }),
  }
})

const inputs: Array<[string, Component]> = [
  ['Date', DateInput],
  ['Time', TimeInput],
  ['DateRange', DateRangeInput],
  ['Month', MonthInput],
  ['Year', YearInput],
]

async function mountInput(component: Component, props: Record<string, unknown> = {}, listeners: Record<string, unknown> = {}) {
  const host = document.createElement('div')
  const app = createApp(defineComponent({
    setup: () => () => h(component, { ...props, ...listeners }),
  }))
  app.mount(host)
  await nextTick()
  return {
    host,
    unmount: () => {
      app.unmount()
      host.remove()
    },
  }
}

describe('datepicker popup safety', () => {
  beforeEach(() => {
    picker.latest = {}
    picker.triggerBlur = undefined
    picker.triggerModelUpdate = undefined
  })

  it.each(inputs)('%s uses shared popup defaults', async (_name, component) => {
    const view = await mountInput(component)

    expect(picker.latest.teleport).toBe(true)
    expect(picker.latest.config).toEqual({
      allowPreventDefault: false,
      allowStopPropagation: true,
    })
    expect(picker.latest.class).toContain('pointer-events-auto')
    view.unmount()
  })

  it.each(inputs)('%s preserves an explicit teleport target', async (_name, component) => {
    const view = await mountInput(component, { teleport: '#picker-root' })

    expect(picker.latest.teleport).toBe('#picker-root')
    view.unmount()
  })

  it.each(inputs)('%s validates on picker blur, not internal focusout', async (_name, component) => {
    const touch = vi.fn()
    const view = await mountInput(component, {}, { 'onValidation:touch': touch })
    const pickerRoot = view.host.querySelector<HTMLElement>('[data-testid="mock-datepicker"]')!
    const outside = document.createElement('button')
    document.body.append(outside)

    pickerRoot.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: outside }))
    expect(touch).not.toHaveBeenCalled()

    picker.triggerBlur?.()
    expect(touch).toHaveBeenCalledOnce()

    outside.remove()
    view.unmount()
  })

  it.each(inputs.filter(([, component]) => component !== TimeInput))('%s treats a model update as input, not validation', async (_name, component) => {
    const touch = vi.fn()
    const view = await mountInput(component, {}, { 'onValidation:touch': touch })

    picker.triggerModelUpdate?.()
    picker.triggerBlur?.()
    await nextTick()
    expect(touch).not.toHaveBeenCalled()

    picker.triggerBlur?.()
    expect(touch).toHaveBeenCalledOnce()

    view.unmount()
  })

  it('Time validates a committed model update on picker blur', async () => {
    const touch = vi.fn()
    const view = await mountInput(TimeInput, {}, { 'onValidation:touch': touch })
    picker.triggerModelUpdate?.()
    picker.triggerBlur?.()

    expect(touch).toHaveBeenCalledOnce()
    view.unmount()
  })

  it('preserves inline and specialized picker modes', async () => {
    let view = await mountInput(DateInput, { inline: true })
    expect(picker.latest.inline).toBe(true)
    view.unmount()

    view = await mountInput(TimeInput)
    expect(picker.latest.timePicker).toBe(true)
    view.unmount()

    view = await mountInput(DateRangeInput, { unit: 'week' })
    expect(picker.latest.weekPicker).toBe(true)
    view.unmount()

    view = await mountInput(MonthInput)
    expect(picker.latest.monthPicker).toBe(true)
    view.unmount()

    view = await mountInput(YearInput)
    expect(picker.latest.yearPicker).toBe(true)
    view.unmount()
  })

  it('parses DateRangeInput date-only values at local midnight and formats using default UI locale', async () => {
    const view = await mountInput(DateRangeInput, { modelValue: ['2026-11-10', '2026-11-12'] })
    const internal = picker.latest.modelValue as Date[]
    expect(internal).toHaveLength(2)
    expect([internal[0].getFullYear(), internal[0].getMonth(), internal[0].getDate(), internal[0].getHours()]).toEqual([2026, 10, 10, 0])
    expect([internal[1].getFullYear(), internal[1].getMonth(), internal[1].getDate(), internal[1].getHours()]).toEqual([2026, 10, 12, 0])

    const formatter = picker.latest.format as (value: Date[]) => string
    const formatted = formatter(internal)
    expect(formatted).toContain('November 10, 2026')
    expect(formatted).toContain('November 12, 2026')
    view.unmount()
  })
})
