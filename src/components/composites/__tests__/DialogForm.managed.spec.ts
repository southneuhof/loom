import { defineComponent, h, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import type { FormFields } from '../../../contracts/forms'
import DialogForm from '../DialogForm.vue'
import { deferred, flush, mountCore } from '../../core/__tests__/harness'

const schema = z.object({ name: z.string() })
type Input = z.input<typeof schema>
const fields = { name: { renderer: 'text' } } satisfies FormFields<Input>

const mounted: Array<ReturnType<typeof mountCore>> = []

function mount(component: Parameters<typeof mountCore>[0]) {
  const view = mountCore(component, {})
  mounted.push(view)
  return view
}

function dialog(): HTMLElement | null {
  return document.body.querySelector<HTMLElement>('[role="dialog"]')
}

function button(container: ParentNode, label: string): HTMLButtonElement | undefined {
  const element = [...container.querySelectorAll('button')].find((entry) => entry.textContent?.trim() === label)
  return element instanceof HTMLButtonElement ? element : undefined
}

function input(): HTMLInputElement {
  const element = dialog()?.querySelector<HTMLInputElement>('input')
  if (!element) throw new Error('DialogForm did not render its input.')
  return element
}

function enterName(value: string): void {
  const element = input()
  element.value = value
  element.dispatchEvent(new Event('input', { bubbles: true }))
}

afterEach(() => {
  for (const view of mounted.splice(0)) view.unmount()
  document.body.innerHTML = ''
})

describe('DialogForm session lifecycle', () => {
  it('starts closed and creates fresh defaults and a new load for each opening', async () => {
    const show = ref(false)
    let defaultCalls = 0
    let loadCalls = 0
    const load = vi.fn(async () => ({ name: `loaded-${++loadCalls}` }))
    const Host = defineComponent({
      setup: () => () => h('div', [
        h('button', { type: 'button', onClick: () => { show.value = true } }, 'Open parent'),
        h('button', { type: 'button', onClick: () => { show.value = false } }, 'Close parent'),
        h(DialogForm, {
          schema,
          fields: { name: { renderer: 'text', initialValue: () => `default-${++defaultCalls}` } },
          load,
          submit: async () => 'saved',
          open: show.value,
          'onUpdate:open': (value: boolean) => { show.value = value },
          title: 'Edit record',
        }),
      ]),
    })
    const view = mount(Host)

    expect(dialog()).toBeNull()
    button(view.host, 'Open parent')?.click()
    await flush(12)
    expect(dialog()).not.toBeNull()
    expect(load).toHaveBeenCalledTimes(1)
    expect(input().value).toBe('loaded-1')
    enterName('edited')

    button(view.host, 'Close parent')?.click()
    await flush()
    expect(dialog()).toBeNull()
    button(view.host, 'Open parent')?.click()
    await flush(12)

    expect(dialog()).not.toBeNull()
    expect(load).toHaveBeenCalledTimes(2)
    expect(input().value).toBe('loaded-2')
    expect(defaultCalls).toBe(2)
  })

  it('restores the parent supplied draft after the editing Form unmounts', async () => {
    const show = ref(false)
    const draft = ref<Partial<Input>>({ name: 'Parent value' })
    const updateDraft = vi.fn((value: Partial<Input>) => { draft.value = value })
    const Host = defineComponent({
      setup: () => () => h('div', [
        h('button', { type: 'button', onClick: () => { show.value = true } }, 'Open parent'),
        h('button', { type: 'button', onClick: () => { show.value = false } }, 'Close parent'),
        h(DialogForm, {
          schema,
          fields,
          modelValue: draft.value,
          open: show.value,
          'onUpdate:modelValue': (value: Partial<Input>) => updateDraft(value),
          'onUpdate:open': (value: boolean) => { show.value = value },
        }),
      ]),
    })
    const view = mount(Host)

    button(view.host, 'Open parent')?.click()
    await flush()
    expect(input().value).toBe('Parent value')
    enterName('Changed by parent model')
    await flush()
    expect(updateDraft).toHaveBeenCalledOnce()
    expect(draft.value).toEqual({ name: 'Changed by parent model' })

    button(view.host, 'Close parent')?.click()
    await flush()
    button(view.host, 'Open parent')?.click()
    await flush()

    expect(input().value).toBe('Changed by parent model')
  })

  it('keeps a late save from changing a reopened dialog session', async () => {
    const first = deferred<string>()
    const second = deferred<string>()
    const show = ref(false)
    const submitted: string[] = []
    let submitCalls = 0
    const submit = vi.fn(() => submitCalls++ === 0 ? first.promise : second.promise)
    const Host = defineComponent({
      setup: () => () => h('div', [
        h('button', { type: 'button', onClick: () => { show.value = true } }, 'Open parent'),
        h('button', { type: 'button', onClick: () => { show.value = false } }, 'Close parent'),
        h(DialogForm, {
          schema,
          fields,
          initialData: { name: 'Ada' },
          submit,
          submitLabel: 'Save',
          closeOnSubmitted: false,
          open: show.value,
          'onUpdate:open': (value: boolean) => { show.value = value },
          onSubmitted: (result: string) => submitted.push(result),
        }),
      ]),
    })
    const view = mount(Host)

    button(view.host, 'Open parent')?.click()
    await flush()
    button(dialog()!, 'Save')?.click()
    await flush()
    expect(submit).toHaveBeenCalledOnce()

    button(view.host, 'Close parent')?.click()
    await flush()
    expect(dialog()).toBeNull()

    button(view.host, 'Open parent')?.click()
    await flush()
    button(dialog()!, 'Save')?.click()
    await flush()
    expect(submit).toHaveBeenCalledTimes(2)

    first.resolve('old result')
    await flush()

    expect(submitted).toEqual([])
    expect(dialog()).not.toBeNull()
    expect(button(dialog()!, 'Save')?.disabled).toBe(true)

    second.resolve('current result')
    await flush()

    expect(submitted).toEqual(['current result'])
    expect(dialog()).not.toBeNull()
  })
})
