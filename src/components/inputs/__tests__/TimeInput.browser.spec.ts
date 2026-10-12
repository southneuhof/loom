import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref, type App } from 'vue'
import { z } from 'zod/v4'
import '@vuepic/vue-datepicker/dist/main.css'
import { FrameworkPlugin } from '../../../adapters/plugin'
import { createFrameworkQueryClient } from '../../../query'
import { defineForm } from '../../../forms/defineForm'
import Form from '../../core/Form.vue'

const apps: App[] = []

async function frame(times = 4) {
  for (let attempt = 0; attempt < times; attempt += 1) {
    await Promise.resolve()
    await nextTick()
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    await nextTick()
  }
}

afterEach(() => {
  apps.splice(0).forEach((app) => app.unmount())
  document.body.innerHTML = ''
})

describe('TimeInput form confirmation', () => {
  it('validates the confirmed time without reopening the picker', async () => {
    const submitted = vi.fn(async (value: { time: string }) => value)
    const model = ref({ time: '' })
    const updates: Array<{ time: string }> = []
    const definition = defineForm({
      schema: z.object({ time: z.string().min(1, 'Choose a time.') }),
      fields: { time: { renderer: 'time' } },
      submit: submitted,
    })
    const host = document.createElement('div')
    document.body.append(host)
    const app = createApp(defineComponent({
      setup: () => () => h(Form, {
        ...definition,
        modelValue: model.value,
        'onUpdate:modelValue': (value: { time: string }) => {
          model.value = value
          updates.push(value)
        },
      }),
    }))
    app.use(FrameworkPlugin, { queryClient: createFrameworkQueryClient({ retry: 0, staleTime: 0 }) })
    app.mount(host)
    apps.push(app)
    await frame()

    host.querySelector<HTMLButtonElement>('button[type="submit"]')!.click()
    await vi.waitFor(() => expect(host.textContent).toContain('Choose a time.'))

    const input = host.querySelector<HTMLInputElement>('input[id$="-field-time"]')!
    input.closest('.dp__main')?.querySelector<HTMLElement>('.dp__input_icon')?.click()
    await frame()

    const select = document.querySelector<HTMLButtonElement>('.dp__action_select')
    expect(select).not.toBeNull()
    const updateCount = updates.length

    const chooseOverlayValue = async (control: 'hours' | 'minutes', value: string) => {
      document.querySelector<HTMLButtonElement>(`[data-test-id="${control}-toggle-overlay-btn-0"]`)!.click()
      await frame()
      const option = [...document.querySelectorAll<HTMLElement>('.dp__overlay[role="dialog"] [role="gridcell"]')]
        .find((cell) => cell.textContent?.trim() === value || cell.textContent?.trim() === String(Number(value)))
      expect(option).not.toBeUndefined()
      option!.click()
      await frame()
    }

    await chooseOverlayValue('hours', '09')
    await chooseOverlayValue('minutes', '30')
    await frame()
    expect(model.value.time).toBe('')
    expect(updates).toHaveLength(updateCount)

    select!.click()
    await frame()

    const confirmed = updates.at(-1)?.time
    expect(confirmed).toBe('09:30:00')
    expect([...host.querySelectorAll('p')].some((message) => message.textContent?.trim() === 'Choose a time.')).toBe(false)

    host.querySelector<HTMLButtonElement>('button[type="submit"]')!.click()
    await vi.waitFor(() => expect(submitted).toHaveBeenCalledOnce())
    expect(submitted).toHaveBeenCalledWith({ time: confirmed })
  })
})
