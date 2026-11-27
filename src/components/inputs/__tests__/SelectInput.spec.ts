import { createApp, defineComponent, h, nextTick, ref, type App } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FrameworkPlugin } from '../../../adapters/plugin'
import { createFrameworkQueryClient } from '../../../query'
import SelectInput from '../SelectInput.vue'
import { mountInput } from './harness'

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
  it('clears to null without submitting a parent form and exposes accessible controls', async () => {
    const model = ref<string | null>('one')
    const submitted = vi.fn()
    const host = document.createElement('div')
    document.body.append(host)
    const app = createApp(defineComponent({
      setup: () => () => h('form', {
        onSubmit: (event: Event) => {
          event.preventDefault()
          submitted()
        },
      }, [
        h(SelectInput, {
          data: [{ id: 'one', name: 'One' }, { id: 'two', name: 'Two' }],
          modelValue: model.value,
          multi: false,
          'onUpdate:modelValue': (value: unknown) => { model.value = value as string | null },
        }),
      ]),
    }))
    app.use(FrameworkPlugin)
    app.mount(host)
    apps.push(app)
    await nextTick()

    const clear = host.querySelector('button[aria-label="Clear selection"]') as HTMLButtonElement
    expect(clear).not.toBeNull()
    expect(clear.type).toBe('button')
    clear.click()
    await nextTick()

    expect(model.value).toBeNull()
    expect(submitted).not.toHaveBeenCalled()
    expect(host.querySelector('button[aria-label="Clear selection"]')).toBeNull()
  })

  it('hides the clear button when multi selection is empty and recovers async load errors via retry', async () => {
    const emptyMulti = await mountSelect([], true)
    expect(emptyMulti.host.querySelector('button[aria-label="Clear selection"]')).toBeNull()

    let attempt = 0
    const load = vi.fn(async () => {
      attempt += 1
      if (attempt === 1) throw new Error('Zone load failed.')
      return { data: [{ id: 'z1', name: 'North Region' }] }
    })
    const mounted = mountInput<string | null>(SelectInput, {
      model: null,
      props: { load, namespace: 'select-retry-test', multi: false },
      queryClient: createFrameworkQueryClient({ retry: 0 }),
    })
    try {
      await mounted.flush()
      const trigger = mounted.host.querySelector('[class*="focus-within:outline-secondary"]') as HTMLElement
      trigger.click()
      await mounted.flush()

      await vi.waitFor(() => {
        const alert = document.body.querySelector('[role="alert"]')
        expect(alert?.textContent).toContain('Zone load failed.')
      })
      const retry = document.body.querySelector('[role="alert"] button') as HTMLButtonElement
      expect(retry.textContent?.trim()).toBe('Retry')

      retry.click()
      await vi.waitFor(() => {
        expect(document.body.textContent).toContain('North Region')
      })
      expect(load).toHaveBeenCalledTimes(2)
    } finally {
      mounted.cleanup()
    }
  })
})
