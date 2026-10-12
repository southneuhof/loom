import { afterEach, describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
import { createApp, defineComponent, h, nextTick, ref, type App, type Component } from 'vue'
import '@vuepic/vue-datepicker/dist/main.css'
import DateInput from '../DateInput.vue'
import MonthInput from '../MonthInput.vue'
import { FrameworkPlugin } from '../../../adapters/plugin'

const apps: App[] = []

async function frame(times = 4) {
  for (let attempt = 0; attempt < times; attempt += 1) {
    await Promise.resolve()
    await nextTick()
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    await nextTick()
  }
}

function mountDate(initial: string | null) {
  const model = ref<string | null>(initial)
  const host = document.createElement('div')
  document.body.append(host)
  const app = createApp(defineComponent({
    setup: () => () => h(DateInput, {
      inline: true,
      teleport: false,
      modelValue: model.value,
      'onUpdate:modelValue': (value: string | null) => { model.value = value },
    }),
  }))
  app.use(FrameworkPlugin)
  app.mount(host)
  apps.push(app)
  return { host, model }
}

function mountPicker(component: Component, props: Record<string, unknown>) {
  const model = ref<unknown>(null)
  const host = document.createElement('div')
  document.body.append(host)
  const app = createApp(defineComponent({
    setup: () => () => h(component, {
      ...props,
      modelValue: model.value,
      'onUpdate:modelValue': (value: unknown) => { model.value = value },
    }),
  }))
  app.use(FrameworkPlugin)
  app.mount(host)
  apps.push(app)
  return { host, model }
}

afterEach(() => {
  apps.splice(0).forEach((app) => app.unmount())
  document.body.innerHTML = ''
})

describe('DateInput real calendar', () => {
  it('shows an initial edit value and commits a picked day', async () => {
    const view = mountDate('2026-02-15')
    await frame(6)

    expect(view.host.querySelector('.dp__menu, .dp__calendar')).not.toBeNull()
    expect(view.host.querySelector('.dp__active_date')?.textContent?.trim()).toBe('15')

    const day = [...view.host.querySelectorAll<HTMLElement>('.dp__cell_inner:not(.dp__cell_offset):not(.dp__cell_disabled)')]
      .find((cell) => cell.textContent?.trim() === '20')!
    expect(day).not.toBeUndefined()
    day.click()
    await frame()

    expect(view.model.value).toBe('2026-02-20')
    expect(view.host.querySelector('.dp__active_date')?.textContent?.trim()).toBe('20')
  })

  it('keeps an empty model empty until a calendar day commits', async () => {
    const view = mountDate(null)
    await frame(6)

    expect(view.model.value).toBeNull()

    const header = [...view.host.querySelectorAll<HTMLElement>('.dp__month_year_row, .dp__month_year_row *, .dp__inner_nav')]
    expect(header.length).toBeGreaterThan(0)
    const day = [...view.host.querySelectorAll<HTMLElement>('.dp__cell_inner:not(.dp__cell_offset):not(.dp__cell_disabled)')]
      .find((cell) => cell.textContent?.trim() === '20')
    day?.click()
    await frame()

    expect(view.model.value).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('keeps text entry, focus, and the calendar affordance on a date input', async () => {
    const view = mountPicker(DateInput, {
      id: 'date-control',
      label: 'Date',
      placeholder: 'Enter a date',
      helperMessage: 'Use year-month-day format.',
    })
    await frame(6)

    const input = view.host.querySelector<HTMLInputElement>('#date-control')!
    expect(input.inputMode).toBe('text')
    expect(input.placeholder).toBe('Enter a date')
    expect(input.classList.contains('dp__input')).toBe(true)
    expect(input.classList.contains('dp__input_icon_pad')).toBe(true)
    const helper = view.host.querySelector<HTMLElement>('[id$="-helper"]')!
    expect(input.getAttribute('aria-describedby')).toContain(helper.id)
    const calendarIcon = view.host.querySelector<HTMLElement>('.dp__input_icon')
    expect(calendarIcon).not.toBeNull()
    calendarIcon!.click()
    await frame()
    expect(document.querySelector('.dp__menu')).not.toBeNull()

    input.focus()
    expect(document.activeElement).toBe(input)
    await frame()
    expect(input.classList.contains('dp__input_focus')).toBe(true)
    await userEvent.type(input, '2026-03-20')
    await frame()
    expect(view.model.value).toBe('2026-03-20')
  })

  it('keeps the month placeholder and stock read-only input affordances', async () => {
    const view = mountPicker(MonthInput, {
      id: 'month-control',
      label: 'Month',
      placeholder: 'Choose a month',
    })
    await frame(6)

    const input = view.host.querySelector<HTMLInputElement>('#month-control')!
    expect(input.placeholder).toBe('Choose a month')
    expect(input.inputMode).toBe('none')
    expect(input.readOnly).toBe(true)
    expect(input.classList.contains('dp__input_readonly')).toBe(true)
    expect(input.classList.contains('dp__input_reg')).toBe(true)
    expect(view.host.querySelector('.dp__input_icon')).not.toBeNull()

    view.host.querySelector<HTMLElement>('.dp__input_icon')!.click()
    await frame()
    expect(document.querySelector('.dp__menu')).not.toBeNull()
  })
})
