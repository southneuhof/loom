import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import CheckboxGroupInput from '../CheckboxGroupInput.vue'
import RadioGroupInput from '../RadioGroupInput.vue'
import SelectInput from '../SelectInput.vue'
import type { SelectModelValue } from '../selectInput.types'
import { defineResource, type CollectionLoadContext, type CollectionResult } from '../../..'
import { mountInput } from './harness'
import { createFrameworkQueryClient, invalidateResourceData } from '../../../query'

describe('explicit option sources', () => {
  it('passes standard collection context to a resource list action', async () => {
    type Option = { id: number; name: string }
    const load = vi.fn(async (
      context: CollectionLoadContext<Record<string, never>>,
    ): Promise<CollectionResult<Option>> => ({
      data: [{ id: 1, name: 'A' }],
      meta: { total: 1, totalPage: 1 },
    }))
    const resource = defineResource({
      key: 'test-options',
      identity: (record: Option) => record.id,
      list: {
        permission: null,
        table: {
          schema: z.object({ id: z.number(), name: z.string() }),
          columns: { name: {} },
          load,
        },
      },
    })
    const list = resource.list
    const searchParameters = { active: true }
    const mounted = mountInput(CheckboxGroupInput, {
      model: [],
      props: {
        load: list.table.load,
        searchParameters,
      },
    })

    await mounted.flush()

    expect(load).toHaveBeenCalledOnce()
    const context = load.mock.calls[0]?.[0]
    expect(context).toMatchObject({ query: {}, searchParameters })
    expect(context?.searchParameters).toStrictEqual(searchParameters)
    expect(context?.signal).toBeInstanceOf(AbortSignal)
    mounted.cleanup()
  })

  it('preserves controlled checkbox values across add, remove, and external replacement', async () => {
    const a = { id: 1, name: 'A' }
    const b = { id: 2, name: 'B' }
    const c = { id: 3, name: 'C' }
    const mounted = mountInput(CheckboxGroupInput, { model: [a, b], props: { data: [a, b, c] } })
    const inputs = mounted.host.querySelectorAll<HTMLInputElement>('input[type=checkbox]')

    inputs[2].parentElement!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await mounted.flush()
    expect(mounted.model.value).toEqual([a, b, c])

    inputs[0].parentElement!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await mounted.flush()
    expect(mounted.model.value).toEqual([b, c])

    mounted.model.value = [a]
    await mounted.flush()
    inputs[2].parentElement!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await mounted.flush()
    expect(mounted.model.value).toEqual([a, c])
    mounted.cleanup()
  })

  it('maps new checkbox values through uniqueIDAs without changing existing fields', async () => {
    const existing = { choiceId: 1, note: 'keep' }
    const mounted = mountInput(CheckboxGroupInput, {
      model: [existing],
      props: { data: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }], uniqueIDAs: 'choiceId' },
    })
    mounted.host.querySelectorAll<HTMLInputElement>('input[type=checkbox]')[1].parentElement!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await mounted.flush()
    expect(mounted.model.value).toEqual([existing, { name: 'B', choiceId: 2 }])
    mounted.cleanup()
  })

  it('prunes only missing static checkbox identities and keeps each selected record', async () => {
    const first = { id: 1, name: 'A', note: 'first' }
    const second = { choiceId: 2, name: 'B', note: 'second' }
    const initialSecond = { id: 2, name: 'B' }
    const mounted = mountInput(CheckboxGroupInput, {
      model: [{ choiceId: 1, name: 'A', note: 'first' }, second],
      props: { data: [first, initialSecond], uniqueIDAs: 'choiceId' },
    })

    mounted.setProps({ data: [{ id: 2, name: 'B' }, { id: 3, name: 'C' }], uniqueIDAs: 'choiceId' })
    await mounted.flush()

    expect(mounted.model.value).toEqual([second])
    expect(mounted.model.value[0]).toMatchObject({ note: 'second' })
    mounted.cleanup()
  })

  it('reconciles static Select values by transformed identity and leaves view changes alone', async () => {
    const touch = vi.fn()
    const onSelect = vi.fn()
    const mounted = mountInput(SelectInput, {
      model: 2,
      props: {
        data: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }],
        transform: { id: 'key', name: 'caption' },
        pick: 'key',
        view: 'caption',
        searchable: false,
        onSelect,
        'onValidation:touch': touch,
      },
    })

    mounted.setProps({ transform: { id: 'key', name: 'label' }, view: 'label' })
    await mounted.flush()
    expect(mounted.model.value).toBe(2)

    mounted.setProps({ data: [{ id: 2, name: 'Updated' }] })
    await mounted.flush()
    expect(mounted.model.value).toBe(2)

    mounted.setProps({ data: [{ id: 3, name: 'C' }] })
    await mounted.flush()
    expect(mounted.model.value).toBeNull()
    expect(onSelect).not.toHaveBeenCalled()
    expect(touch).not.toHaveBeenCalled()
    mounted.cleanup()
  })

  it('clears a missing static radio value without touch and still touches a user choice', async () => {
    const touch = vi.fn()
    const mounted = mountInput(RadioGroupInput, {
      model: 'north',
      props: {
        data: [{ id: 'north', name: 'North' }, { id: 'south', name: 'South' }],
        'onValidation:touch': touch,
      },
    })

    mounted.setProps({ data: [{ id: 'north', name: 'Updated North' }, { id: 'south', name: 'South' }] })
    await mounted.flush()
    expect(mounted.model.value).toBe('north')

    mounted.setProps({ data: [{ id: 'south', name: 'South' }] })
    await mounted.flush()
    expect(mounted.model.value).toBeUndefined()
    expect(touch).not.toHaveBeenCalled()

    mounted.host.querySelector<HTMLElement>('.group\\/radio')?.click()
    await mounted.flush()
    expect(mounted.model.value).toBe('south')
    expect(touch).toHaveBeenCalledOnce()
    mounted.cleanup()
  })

  it('keeps initial remote values outside the result page and clears them on source-context changes', async () => {
    const load = vi.fn(async () => ({
      data: [{ id: 'other', name: 'Other' }],
      meta: { total: 1, page: 1, pageSize: 10 },
    }))
    const mounted = mountInput(SelectInput, {
      model: 'selected',
      props: {
        load,
        namespace: 'remote-selection',
        searchParameters: { divisionId: 'north' },
        searchable: false,
      },
    })

    await vi.waitFor(() => expect(load).toHaveBeenCalledOnce())
    expect(mounted.model.value).toBe('selected')

    mounted.setProps({ searchParameters: { divisionId: 'south' } })
    await mounted.flush()
    expect(mounted.model.value).toBeNull()
    mounted.cleanup()
  })

  it('invalidates resource-owned options and leaves other sources unchanged', async () => {
    type Option = { id: string; name: string }
    let roleOptions: Option[] = [{ id: 'selected', name: 'Admin' }]
    const rolesLoad = vi.fn(async (): Promise<CollectionResult<Option>> => ({
      data: roleOptions,
      meta: { total: roleOptions.length, totalPage: 1 },
    }))
    const teamsLoad = vi.fn(async (): Promise<CollectionResult<Option>> => ({
      data: [{ id: 'team', name: 'Operations' }],
      meta: { total: 1, totalPage: 1 },
    }))
    const standaloneLoad = vi.fn(async () => ({
      data: [{ id: 'standalone', name: 'Standalone' }],
      meta: { total: 1, page: 1, pageSize: 10 },
    }))
    const roles = defineResource({
      key: 'roles-option-cache',
      identity: (record: Option) => record.id,
      list: {
        permission: null,
        table: {
          schema: z.object({ id: z.string(), name: z.string() }),
          columns: { name: {} },
          load: rolesLoad,
        },
      },
    })
    const teams = defineResource({
      key: 'teams-option-cache',
      identity: (record: Option) => record.id,
      list: {
        permission: null,
        table: {
          schema: z.object({ id: z.string(), name: z.string() }),
          columns: { name: {} },
          load: teamsLoad,
        },
      },
    })
    const queryClient = createFrameworkQueryClient({ retry: 0, staleTime: Infinity })
    const rolesInput = mountInput(SelectInput, {
      model: 'selected',
      props: {
        load: roles.list.table.load,
        resource: roles.list.table.resource,
        namespace: roles.list.table.namespace,
        searchable: false,
      },
      queryClient,
    })
    const teamsInput = mountInput(SelectInput, {
      model: 'team',
      props: {
        load: teams.list.table.load,
        resource: teams.list.table.resource,
        namespace: teams.list.table.namespace,
        searchable: false,
      },
      queryClient,
    })
    const standaloneInput = mountInput(SelectInput, {
      model: 'standalone',
      props: { load: standaloneLoad, namespace: 'standalone-options', searchable: false },
      queryClient,
    })
    const controlledInput = mountInput(SelectInput, {
      model: 'static',
      props: { data: [{ id: 'static', name: 'Static role' }], searchable: false },
      queryClient,
    })

    await vi.waitFor(() => {
      expect(rolesLoad).toHaveBeenCalledOnce()
      expect(teamsLoad).toHaveBeenCalledOnce()
      expect(standaloneLoad).toHaveBeenCalledOnce()
      expect(rolesInput.host.textContent).toContain('Admin')
      expect(teamsInput.host.textContent).toContain('Operations')
      expect(standaloneInput.host.textContent).toContain('Standalone')
    })

    roleOptions = [{ id: 'selected', name: 'Administrator' }]
    await invalidateResourceData(queryClient, { resource: roles.list.table.resource })
    await vi.waitFor(() => expect(rolesLoad).toHaveBeenCalledTimes(2))
    await rolesInput.flush()

    expect(rolesInput.model.value).toBe('selected')
    expect(rolesInput.host.textContent).toContain('Administrator')
    expect(teamsLoad).toHaveBeenCalledOnce()
    expect(standaloneLoad).toHaveBeenCalledOnce()
    expect(teamsInput.model.value).toBe('team')
    expect(standaloneInput.model.value).toBe('standalone')
    expect(controlledInput.model.value).toBe('static')
    expect(controlledInput.host.textContent).toContain('Static role')

    rolesInput.cleanup()
    roleOptions = [{ id: 'selected', name: 'Senior administrator' }]
    await invalidateResourceData(queryClient, { resource: roles.list.table.resource, id: 'selected' })

    const remountedRolesInput = mountInput(SelectInput, {
      model: 'selected',
      props: {
        load: roles.list.table.load,
        resource: roles.list.table.resource,
        namespace: roles.list.table.namespace,
        searchable: false,
      },
      queryClient,
    })
    await vi.waitFor(() => expect(rolesLoad).toHaveBeenCalledTimes(3))
    await remountedRolesInput.flush()

    expect(remountedRolesInput.model.value).toBe('selected')
    expect(remountedRolesInput.host.textContent).toContain('Senior administrator')
    expect(teamsLoad).toHaveBeenCalledOnce()
    expect(standaloneLoad).toHaveBeenCalledOnce()
    teamsInput.cleanup()
    standaloneInput.cleanup()
    controlledInput.cleanup()
    remountedRolesInput.cleanup()
  })

  it('clears remote selections when any option control changes resource owner', async () => {
    const cases = [
      { component: SelectInput, model: 'selected', expected: null },
      { component: RadioGroupInput, model: 'selected', expected: undefined },
      { component: CheckboxGroupInput, model: [{ id: 'selected', name: 'Selected' }], expected: [] },
    ] as const

    for (const [index, testCase] of cases.entries()) {
      const load = vi.fn(async () => ({
        data: [{ id: 'selected', name: 'Selected' }],
        meta: { total: 1, page: 1, pageSize: 10 },
      }))
      const mounted = mountInput(testCase.component, {
        model: testCase.model,
        props: {
          load,
          resource: `owner-${index}`,
          namespace: 'same-instance',
          searchParameters: { active: true },
          searchable: false,
        },
      })

      await vi.waitFor(() => {
        expect(load).toHaveBeenCalledOnce()
        expect(mounted.host.textContent).toContain('Selected')
      })
      mounted.setProps({ resource: `new-owner-${index}` })
      await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(2))
      await mounted.flush()

      expect(mounted.model.value).toEqual(testCase.expected)
      mounted.cleanup()
    }
  })

  it('uses the component instance namespace when an authored namespace is removed', async () => {
    const load = vi.fn(async () => ({
      data: [{ id: 'selected', name: 'Selected' }],
      meta: { total: 1, page: 1, pageSize: 10 },
    }))
    const queryClient = createFrameworkQueryClient({ retry: 0, staleTime: Infinity })
    const props = { load, resource: 'shared-resource', namespace: 'shared', searchable: false }
    const first = mountInput(SelectInput, { model: 'selected', props, queryClient })
    const second = mountInput(SelectInput, { model: 'selected', props, queryClient })

    await vi.waitFor(() => {
      expect(load).toHaveBeenCalledOnce()
      expect(first.host.textContent).toContain('Selected')
      expect(second.host.textContent).toContain('Selected')
    })

    first.setProps({ namespace: undefined })
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(2))
    await first.flush()

    expect(first.model.value).toBeNull()
    expect(second.model.value).toBe('selected')
    first.cleanup()
    second.cleanup()
  })

  it('clears CheckboxGroup values when its remote context changes', async () => {
    const load = vi.fn(async () => ({
      data: [{ id: 'other', name: 'Other' }],
      meta: { total: 1, page: 1, pageSize: 10 },
    }))
    const mounted = mountInput(CheckboxGroupInput, {
      model: [{ id: 'selected', name: 'Selected' }],
      props: {
        load,
        namespace: 'checkbox-context-selection',
        searchParameters: { divisionId: 'north' },
      },
    })

    await vi.waitFor(() => expect(load).toHaveBeenCalledOnce())
    expect(mounted.model.value).toEqual([{ id: 'selected', name: 'Selected' }])

    mounted.setProps({ searchParameters: { divisionId: 'south' } })
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(2))
    await mounted.flush()

    expect(mounted.model.value).toEqual([])
    mounted.cleanup()
  })

  it('reloads remote radio options when the loader changes', async () => {
    const oldLoad = vi.fn(async () => ({
      data: [{ id: 'old', name: 'Old option' }],
      meta: { total: 1, page: 1, pageSize: 10 },
    }))
    const newLoad = vi.fn(async () => ({
      data: [{ id: 'new', name: 'New option' }],
      meta: { total: 1, page: 1, pageSize: 10 },
    }))
    const mounted = mountInput(RadioGroupInput, {
      model: 'old',
      props: { load: oldLoad, namespace: 'radio-loader-selection' },
    })

    await vi.waitFor(() => {
      expect(oldLoad).toHaveBeenCalledOnce()
      expect(mounted.host.textContent).toContain('Old option')
    })

    mounted.setProps({ load: newLoad })
    await vi.waitFor(() => {
      expect(newLoad).toHaveBeenCalledOnce()
      expect(mounted.host.textContent).toContain('New option')
    })

    expect(mounted.model.value).toBeUndefined()
    expect(mounted.host.textContent).not.toContain('Old option')
    mounted.cleanup()
  })

  it('keeps a same-update authoritative Select model shape and tracks remote identity transforms', async () => {
    const load = vi.fn(async () => ({
      data: [{ id: 'selected', name: 'Selected' }],
      meta: { total: 1, page: 1, pageSize: 10 },
    }))
    const mounted = mountInput<SelectModelValue>(SelectInput, {
      model: { id: 'selected', name: 'Selected' },
      props: {
        load,
        namespace: 'select-model-shape',
        searchParameters: { divisionId: 'north' },
        pick: 'id',
        asWhole: true,
        transform: { name: 'label' },
        searchable: false,
      },
    })

    mounted.model.value = 'selected'
    mounted.setProps({ searchParameters: { divisionId: 'south' }, asWhole: false, transform: { name: 'caption' } })
    await mounted.flush()
    expect(mounted.model.value).toBe('selected')

    mounted.setProps({ transform: { id: 'key' } })
    await mounted.flush()
    expect(mounted.model.value).toBeNull()
    mounted.cleanup()
  })

  it('preserves a string Select replacement when the remote context changes', async () => {
    const load = vi.fn(async () => ({
      data: [{ id: 1, name: 'One' }],
      meta: { total: 1, page: 1, pageSize: 10 },
    }))
    const mounted = mountInput<SelectModelValue>(SelectInput, {
      model: 1,
      props: {
        load,
        namespace: 'select-typed-model',
        searchParameters: { divisionId: 'north' },
      },
    })

    mounted.model.value = '1'
    mounted.setProps({ searchParameters: { divisionId: 'south' } })
    await mounted.flush()

    expect(mounted.model.value).toBe('1')
    mounted.cleanup()
  })

  it('keeps same-update CheckboxGroup values when the model representation changes', async () => {
    const load = vi.fn(async () => ({
      data: [{ id: 'other', name: 'Other' }],
      meta: { total: 1, page: 1, pageSize: 10 },
    }))
    const mounted = mountInput<Array<string | number | Record<string, unknown>>>(CheckboxGroupInput, {
      model: [{ id: 'selected', name: 'Selected' }],
      props: {
        load,
        namespace: 'checkbox-model-shape',
        searchParameters: { divisionId: 'north' },
      },
    })

    mounted.model.value = ['selected']
    mounted.setProps({ searchParameters: { divisionId: 'south' } })
    await mounted.flush()

    expect(mounted.model.value).toEqual(['selected'])
    mounted.cleanup()
  })

  it('does not refill a value cleared by a remote context change', async () => {
    const load = vi.fn(async () => ({
      data: [{ id: 'default', name: 'Default' }],
      meta: { total: 1, page: 1, pageSize: 10 },
    }))
    const mounted = mountInput(RadioGroupInput, {
      model: 'old',
      props: {
        load,
        namespace: 'radio-default',
        searchParameters: { divisionId: 'north' },
        defaultValue: 'default',
      },
    })

    await vi.waitFor(() => expect(load).toHaveBeenCalledOnce())
    mounted.setProps({ searchParameters: { divisionId: 'south' } })
    await mounted.flush()
    expect(mounted.model.value).toBeUndefined()
    mounted.cleanup()
  })

  it('does not refill a Select default after remote context invalidation', async () => {
    const load = vi.fn(async () => ({
      data: [{ id: 'first', name: 'First' }],
      meta: { total: 1, page: 1, pageSize: 10 },
    }))
    const mounted = mountInput<SelectModelValue>(SelectInput, {
      model: 'old',
      props: {
        load,
        namespace: 'select-default',
        searchParameters: { divisionId: 'north' },
        defaultToFirst: true,
        searchable: false,
      },
    })

    await vi.waitFor(() => expect(load).toHaveBeenCalledOnce())
    mounted.setProps({ searchParameters: { divisionId: 'south' } })
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(2))
    await mounted.flush()

    expect(mounted.model.value).toBeNull()
    mounted.cleanup()
  })
})
