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

async function chooseOption(name = 'One') {
  await frame()
  const popover = document.querySelector<HTMLElement>('[data-reka-popper-content-wrapper]')
  if (!popover) throw new Error('SelectInput did not render its option popover.')
  const option = [...popover.querySelectorAll<HTMLElement>('[role="button"]')]
    .find((element) => element.textContent?.trim() === name)
  if (!option) throw new Error(`SelectInput did not render the ${name} option.`)
  option.click()
  await frame()
}

function openField(label: string): HTMLElement {
  const field = [...document.querySelectorAll<HTMLElement>('.is-form-field')]
    .find((element) => element.querySelector('label')?.textContent?.includes(label))
  const trigger = field?.querySelector<HTMLElement>('[class*="focus-within:outline-secondary"]')
  if (!trigger) throw new Error(`SelectInput trigger was not found for ${label}.`)
  trigger.click()
  return trigger
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise })
  return { promise, resolve }
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
    await chooseOption()
    openAndSelect('[data-surface="form"]')
    await chooseOption()
    openAndSelect('[data-surface="dialog"]')
    await chooseOption()

    expect(directValue.value).toBe(1)
    expect(directUpdates.at(-1)).toBe(1)
    expect(formUpdates.at(-1)?.ownerId).toBe(1)
    expect(dialogUpdates.at(-1)?.ownerId).toBe(1)
    expect(standalone.textContent).toContain('One')
    expect(formHost.textContent).toContain('One')
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('One')
  })

  it('keeps a dependent Select clear across a pending uncontrolled Form refresh', async () => {
    type Draft = { divisionId: string; approverId: string | null }
    const northApprover = { id: 'north-1', name: 'North approver' }
    const southApprover = { id: 'south-1', name: 'South approver' }
    const childLoad = vi.fn(async ({ searchParameters }: { searchParameters: Record<string, unknown> }) => ({
      data: searchParameters.divisionId === 'south' ? [southApprover] : [northApprover],
      meta: { total: 1, page: 1, pageSize: 5 },
    }))
    const lateRefresh = deferred<Draft>()
    let formLoadCount = 0
    const load = vi.fn(() => {
      formLoadCount += 1
      return formLoadCount === 1 ? Promise.resolve({ divisionId: 'north', approverId: 'north-1' }) : lateRefresh.promise
    })
    const definition = defineForm({
      schema: z.object({ divisionId: z.string(), approverId: z.string().nullable() }),
      labels: { divisionId: 'Division', approverId: 'Approver' },
      fields: {
        divisionId: {
          renderer: 'select',
          props: { data: [{ id: 'north', name: 'North' }, { id: 'south', name: 'South' }], pick: 'id', view: 'name', searchable: false },
        },
        approverId: {
          renderer: 'select',
          props: { load: childLoad, namespace: 'dependent-refresh-approvers', pick: 'id', view: 'name', searchable: false },
          behavior: {
            disabled: ({ draft }) => !draft.divisionId,
            props: ({ draft }) => ({ searchParameters: { divisionId: draft.divisionId } }),
          },
        },
      },
      submit: async (value) => value,
    })
    const host = document.createElement('div')
    document.body.append(host)
    const formRef = ref<{ refresh: () => Promise<void>; draft: Draft } | null>(null)
    const app = createApp(defineComponent({
      setup: () => () => h(Form, {
        ref: formRef,
        ...definition,
        load,
      }),
    }))
    app.use(FrameworkPlugin, { queryClient: createFrameworkQueryClient({ retry: 0, staleTime: 0 }) })
    app.mount(host)
    apps.push(app)
    await vi.waitFor(() => expect(formRef.value?.draft).toEqual({ divisionId: 'north', approverId: 'north-1' }))

    const refreshing = formRef.value!.refresh()
    let refreshResolved = false
    void refreshing.then(() => { refreshResolved = true })
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(2))
    expect(refreshResolved).toBe(false)

    openField('Division')
    await chooseOption('South')
    await frame()
    expect(formRef.value!.draft).toEqual({ divisionId: 'south', approverId: null })

    lateRefresh.resolve({ divisionId: 'north', approverId: 'north-old' })
    await refreshing
    await frame()
    expect(formRef.value!.draft).toEqual({ divisionId: 'south', approverId: null })
  })

  it('emits one automatic clear and keeps Select callbacks for user choices', async () => {
    type Draft = { divisionId: string; approverId: string | null }
    const southApprover = { id: 'south-1', name: 'South approver' }
    const onSelect = vi.fn()
    const childLoad = vi.fn(async ({ searchParameters }: { searchParameters: Record<string, unknown> }) => ({
      data: searchParameters.divisionId === 'south'
        ? [southApprover]
        : [{ id: 'north-1', name: 'North approver' }],
      meta: { total: 1, page: 1, pageSize: 5 },
    }))
    const model = ref<FormDraftSnapshot<Draft>>({ divisionId: 'north', approverId: 'north-1' })
    const updates: FormDraftSnapshot<Draft>[] = []
    const definition = defineForm({
      schema: z.object({ divisionId: z.string(), approverId: z.string().nullable() }),
      labels: { divisionId: 'Division', approverId: 'Approver' },
      fields: {
        divisionId: {
          renderer: 'select',
          props: { data: [{ id: 'north', name: 'North' }, { id: 'south', name: 'South' }], pick: 'id', view: 'name', searchable: false },
        },
        approverId: {
          renderer: 'select',
          props: { load: childLoad, namespace: 'dependent-controlled-approvers', pick: 'id', view: 'name', searchable: false, onSelect },
          behavior: {
            disabled: ({ draft }) => !draft.divisionId,
            props: ({ draft }) => ({ searchParameters: { divisionId: draft.divisionId } }),
          },
        },
      },
      submit: async (value) => value,
    })
    const host = document.createElement('div')
    document.body.append(host)
    const app = createApp(defineComponent({
      setup: () => () => h(Form, {
        ...definition,
        modelValue: model.value,
        'onUpdate:modelValue': (value: FormDraftSnapshot<Draft>) => {
          model.value = value
          updates.push(value)
        },
      }),
    }))
    app.use(FrameworkPlugin, { queryClient: createFrameworkQueryClient({ retry: 0, staleTime: 0 }) })
    app.mount(host)
    apps.push(app)
    await frame()

    const updateStart = updates.length
    openField('Division')
    await chooseOption('South')
    await vi.waitFor(() => expect(model.value).toEqual({ divisionId: 'south', approverId: null }))
    expect(updates.slice(updateStart).filter((value) => value.approverId === null)).toHaveLength(1)
    expect(onSelect).not.toHaveBeenCalled()

    const approverTrigger = openField('Approver')
    await frame()
    expect(approverTrigger.className).not.toContain('pointer-events-none')
    expect(document.body.querySelector('[data-reka-popper-content-wrapper]')).not.toBeNull()
    await chooseOption('South approver')
    expect(onSelect).toHaveBeenCalledOnce()
    expect(model.value).toEqual({ divisionId: 'south', approverId: 'south-1' })
  })

  it('keeps a same-update authoritative child replacement when the parent context changes', async () => {
    type Draft = { divisionId: string; approverId: string | null }
    const load = vi.fn(async ({ searchParameters }: { searchParameters: Record<string, unknown> }) => ({
      data: searchParameters.divisionId === 'south'
        ? [{ id: 'south-1', name: 'South approver' }]
        : [{ id: 'north-1', name: 'North approver' }],
      meta: { total: 1, page: 1, pageSize: 5 },
    }))
    const model = ref<FormDraftSnapshot<Draft>>({ divisionId: 'north', approverId: 'north-1' })
    const definition = defineForm({
      schema: z.object({ divisionId: z.string(), approverId: z.string().nullable() }),
      labels: { divisionId: 'Division', approverId: 'Approver' },
      fields: {
        divisionId: { renderer: 'select', props: { data: [{ id: 'north', name: 'North' }, { id: 'south', name: 'South' }], pick: 'id', view: 'name', searchable: false } },
        approverId: {
          renderer: 'select',
          props: { load, namespace: 'authoritative-approvers', pick: 'id', view: 'name', searchable: false },
          behavior: { props: ({ draft }) => ({ searchParameters: { divisionId: draft.divisionId } }) },
        },
      },
      submit: async (value) => value,
    })
    const host = document.createElement('div')
    document.body.append(host)
    const app = createApp(defineComponent({
      setup: () => () => h(Form, {
        ...definition,
        modelValue: model.value,
        'onUpdate:modelValue': (value: FormDraftSnapshot<Draft>) => { model.value = value },
      }),
    }))
    app.use(FrameworkPlugin, { queryClient: createFrameworkQueryClient({ retry: 0, staleTime: 0 }) })
    app.mount(host)
    apps.push(app)
    await frame()

    model.value = { divisionId: 'south', approverId: 'south-1' }
    await frame()

    expect(model.value).toEqual({ divisionId: 'south', approverId: 'south-1' })
  })
})
