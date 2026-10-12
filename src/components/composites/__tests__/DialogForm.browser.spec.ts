import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref, type App } from 'vue'
import { z } from 'zod/v4'
import { FrameworkPlugin } from '../../../adapters/plugin'
import { createFrameworkQueryClient } from '../../../query'
import { defineForm } from '../../../forms/defineForm'
import DialogForm from '../DialogForm.vue'

const apps: App[] = []
const schema = z.object({ name: z.string().min(1, 'Enter a name.') })

async function frame(times = 4) {
  for (let attempt = 0; attempt < times; attempt += 1) {
    await Promise.resolve()
    await nextTick()
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    await nextTick()
  }
}

function input(): HTMLInputElement {
  const element = document.querySelector<HTMLInputElement>('[role="dialog"] input')
  if (!element) throw new Error('DialogForm did not render its input.')
  return element
}

function button(label: string): HTMLButtonElement {
  const element = [...document.querySelectorAll<HTMLButtonElement>('button')]
    .find((candidate) => candidate.textContent?.trim() === label)
  if (!element) throw new Error(`DialogForm did not render the ${label} button.`)
  return element
}

function enterName(value: string): void {
  const element = input()
  element.focus()
  element.value = value
  element.dispatchEvent(new Event('input', { bubbles: true }))
  element.blur()
}

function addExitAnimation(): void {
  const style = document.createElement('style')
  style.dataset.testId = 'dialog-exit-animation'
  style.textContent = '.dialog-lifecycle-test[data-state="closed"] { animation: dialog-lifecycle-exit 60000ms linear; } @keyframes dialog-lifecycle-exit { from { opacity: 1; } to { opacity: 0; } }'
  document.head.append(style)
}

afterEach(() => {
  apps.splice(0).forEach((app) => app.unmount())
  document.body.innerHTML = ''
  document.head.querySelector('[data-testid="dialog-exit-animation"]')?.remove()
})

beforeEach(() => {
  addExitAnimation()
})

describe('DialogForm close lifecycle', () => {
  it('keeps and replaces an unbound form during its close animation', async () => {
    const open = ref(true)
    const definition = defineForm({
      schema,
      fields: { name: { renderer: 'text' } },
      submit: async (value) => value,
    })
    const host = document.createElement('div')
    document.body.append(host)
    const app = createApp(defineComponent({
      setup: () => () => h(DialogForm, {
        ...definition,
        open: open.value,
        initialData: { name: 'Seed' },
        title: 'Edit name',
        description: 'Update the name.',
        class: 'dialog-lifecycle-test',
        'onUpdate:open': (value: boolean) => { open.value = value },
      }, {
        trigger: () => h('button', { type: 'button', 'data-testid': 'open-unbound' }, 'Open unbound'),
      }),
    }))
    app.use(FrameworkPlugin, { queryClient: createFrameworkQueryClient({ retry: 0, staleTime: 0 }) })
    app.mount(host)
    apps.push(app)
    await frame()

    expect(input().value).toBe('Seed')
    enterName('Edited')
    await frame()
    enterName('')
    await vi.waitFor(() => expect(document.querySelector('[role="alert"]')?.textContent).toBe('Enter a name.'))

    button('Cancel').click()
    await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')?.getAttribute('data-state')).toBe('closed'))
    expect(document.querySelector('[role="dialog"] form')).not.toBeNull()
    expect(input().value).toBe('')

    button('Open unbound').click()
    await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')?.getAttribute('data-state')).toBe('open'))
    expect(input().value).toBe('Seed')
    expect(document.querySelector('[role="alert"]')).toBeNull()

    button('Cancel').click()
    await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')?.getAttribute('data-state')).toBe('closed'))
    const closedDialog = document.querySelector<HTMLElement>('[role="dialog"]')!
    closedDialog.dispatchEvent(new AnimationEvent('animationend', { animationName: 'dialog-lifecycle-exit' }))
    await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull())
  })

  it('keeps the parent draft when a controlled form reopens during its exit', async () => {
    const open = ref(false)
    const model = ref({ name: 'Parent value' })
    const definition = defineForm({
      schema,
      fields: { name: { renderer: 'text' } },
      submit: async (value) => value,
    })
    const host = document.createElement('div')
    document.body.append(host)
    const app = createApp(defineComponent({
      setup: () => () => h(DialogForm, {
        ...definition,
        open: open.value,
        modelValue: model.value,
        title: 'Edit name',
        description: 'Update the name.',
        class: 'dialog-lifecycle-test',
        'onUpdate:open': (value: boolean) => { open.value = value },
        'onUpdate:modelValue': (value: { name: string }) => { model.value = value },
      }, {
        trigger: () => h('button', { type: 'button', 'data-testid': 'open-controlled' }, 'Open controlled'),
      }),
    }))
    app.use(FrameworkPlugin, { queryClient: createFrameworkQueryClient({ retry: 0, staleTime: 0 }) })
    app.mount(host)
    apps.push(app)

    button('Open controlled').click()
    await vi.waitFor(() => expect(document.querySelector('[role="dialog"] input')?.value).toBe('Parent value'))
    enterName('Updated value')
    await frame()
    expect(model.value).toEqual({ name: 'Updated value' })

    button('Cancel').click()
    await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')?.getAttribute('data-state')).toBe('closed'))
    expect(document.querySelector('[role="dialog"] form')).not.toBeNull()

    button('Open controlled').click()
    await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')?.getAttribute('data-state')).toBe('open'))
    expect(input().value).toBe('Updated value')
  })
})
