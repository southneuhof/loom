import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref, type App } from 'vue'
import { z } from 'zod/v4'
import type { FormDraftSnapshot } from '../../../contracts/forms'
import { defineForm } from '../../../forms/defineForm'
import { FrameworkPlugin } from '../../../adapters/plugin'
import { createFrameworkQueryClient } from '../../../query'
import DialogForm from '../DialogForm.vue'
import Form from '../../core/Form.vue'
import SelectInput from '../../inputs/SelectInput.vue'
import type { SelectModelValue } from '../../inputs/selectInput.types'
import type { FormRendererProps } from '../../../renderers/formContracts'

const apps: App[] = []
const choiceProps = {
  data: [{ id: 1, name: 'One' }, { id: 2, name: 'Two' }],
  pick: 'id',
  view: 'name',
  searchable: false,
  clearable: false,
} satisfies FormRendererProps<'select'>

async function frame() {
  await nextTick()
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  await nextTick()
}

function openAndSelect(selector: string) {
  const trigger = document.querySelector<HTMLElement>(`${selector} .focus-within\\:outline-secondary`)
  if (!trigger) throw new Error(`SelectInput trigger was not found for ${selector}.`)
  trigger.click()
}

async function chooseOne() {
  await frame()
  const popover = document.querySelector<HTMLElement>('[data-reka-popper-content-wrapper]')
  if (!popover) throw new Error('SelectInput did not render its option popover.')
  const option = [...popover.querySelectorAll<HTMLElement>('*')]
    .find((element) => element.textContent?.trim() === 'One')
  if (!option) throw new Error('SelectInput did not render the One option.')
  option.click()
  await frame()
}

afterEach(() => {
  apps.splice(0).forEach((app) => app.unmount())
  document.body.innerHTML = ''
})

describe('SelectInput form parity', () => {
  it('uses one numeric choice prop bag in standalone, Form, and DialogForm controls', async () => {
    const directValue = ref<SelectModelValue>(2)
    const directUpdates: SelectModelValue[] = []
    const formUpdates: FormDraftSnapshot<{ ownerId: number }>[] = []
    const dialogUpdates: FormDraftSnapshot<{ ownerId: number }>[] = []
    const definition = defineForm({
      schema: z.object({ ownerId: z.number() }),
      fields: { ownerId: { renderer: 'select', props: choiceProps } },
      submit: async (value) => value,
    })
    const host = document.createElement('div')
    document.body.append(host)
    const app = createApp(defineComponent({
      setup: () => () => h('div', [
        h('section', { 'data-surface': 'standalone' }, [
          h(SelectInput, {
            ...choiceProps,
            modelValue: directValue.value,
            'onUpdate:modelValue': (value: SelectModelValue) => {
              directValue.value = value
              directUpdates.push(value)
            },
          }),
        ]),
        h('section', { 'data-surface': 'form' }, [
          h(Form, {
            ...definition,
            modelValue: { ownerId: 2 },
            'onUpdate:modelValue': (value) => formUpdates.push(value),
          }),
        ]),
        h(DialogForm, {
          ...definition,
          open: true,
          title: 'Edit owner',
          description: 'Choose an owner.',
          modelValue: { ownerId: 2 },
          'data-surface': 'dialog',
          'onUpdate:modelValue': (value) => dialogUpdates.push(value),
        }, {
          trigger: () => h('button', { type: 'button' }, 'Edit owner'),
        }),
      ]),
    }))
    app.use(FrameworkPlugin, { queryClient: createFrameworkQueryClient({ retry: 0, staleTime: 0 }) })
    app.mount(host)
    apps.push(app)

    await frame()
    const standalone = document.querySelector('[data-surface="standalone"]')!
    const formHost = document.querySelector('[data-surface="form"]')!
    const dialogHost = document.querySelector('[data-surface="dialog"]')!
    expect(standalone.textContent).toContain('Two')
    await vi.waitFor(() => {
      expect(formHost.textContent).toContain('Two')
      expect(dialogHost.textContent).toContain('Two')
    })

    openAndSelect('[data-surface="standalone"]')
    await chooseOne()
    openAndSelect('[data-surface="form"]')
    await chooseOne()
    openAndSelect('[data-surface="dialog"]')
    await chooseOne()

    expect(directValue.value).toBe(1)
    expect(directUpdates.at(-1)).toBe(1)
    expect(formUpdates.at(-1)?.ownerId).toBe(1)
    expect(dialogUpdates.at(-1)?.ownerId).toBe(1)
    expect(standalone.textContent).toContain('One')
    expect(formHost.textContent).toContain('One')
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('One')
  })
})
