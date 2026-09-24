import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref, type App } from 'vue'
import type { Coordinate, LocationOperations, LocationPrediction } from '../../../contracts'
import LocationInput from '../form-inputs/LocationInput.vue'
import { FrameworkPlugin } from '../../../adapters/plugin'
import { createFrameworkQueryClient } from '../../../query'

vi.mock('vue3-google-map', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    GoogleMap: defineComponent({
      props: { apiKey: String },
      emits: ['click'],
      setup(props, { emit, slots }) {
        return () => h('div', {
          class: 'location-map',
          ...{ 'data-api-key': props.apiKey },
          onClick: () => emit('click', { latLng: { lat: () => -5, lng: () => 110 } }),
        }, slots.default?.())
      },
    }),
    Marker: defineComponent({ render: () => h('div') }),
  }
})

vi.mock('../../base/Popover.vue', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    default: defineComponent({
      setup(_, { slots }) {
        const setOpen = () => undefined
        return () => h('div', [
          h('div', { class: 'location-popover-trigger' }, slots.trigger?.({ setOpen })),
          h('div', { class: 'location-popover-content' }, slots.content?.({ setOpen })),
        ])
      },
    }),
  }
})

vi.mock('../../inputs/SearchBox.vue', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    default: defineComponent({
      props: { modelValue: String, placeholder: String },
      emits: ['update:modelValue'],
      setup(props, { attrs, emit }) {
        return () => h('input', {
          ...attrs,
          value: props.modelValue ?? '',
          placeholder: props.placeholder,
          onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value),
        })
      },
    }),
  }
})

vi.mock('../../base/Tooltip.vue', async () => {
  const { defineComponent } = await import('vue')
  return { default: defineComponent({ setup(_, { slots }) { return () => slots.trigger?.({}) } }) }
})

vi.mock('../../base/Icon.vue', async () => {
  const { defineComponent, h } = await import('vue')
  return { default: defineComponent({ render: () => h('span') }) }
})

const apps: App[] = []

function mountLocation(operations: LocationOperations, initialValue?: Coordinate) {
  const model = ref(initialValue)
  const host = document.createElement('div')
  document.body.append(host)
  const app = createApp(defineComponent({
    setup: () => () => h(LocationInput, {
      operations,
      modelValue: model.value,
      'onUpdate:modelValue': (value: Coordinate | undefined) => { model.value = value },
    }),
  }))
  app.use(FrameworkPlugin, { queryClient: createFrameworkQueryClient({ retry: 0, staleTime: 0 }) })
  app.mount(host)
  apps.push(app)
  return { host, model }
}

async function flush() {
  await Promise.resolve()
  await nextTick()
  await Promise.resolve()
  await nextTick()
}

function input(host: HTMLElement, id: string) {
  return host.querySelector<HTMLInputElement>(`#${id}`)!
}

function enter(inputElement: HTMLInputElement, value: string) {
  inputElement.value = value
  inputElement.dispatchEvent(new Event('input', { bubbles: true }))
}

function elementNamed(host: HTMLElement, value: string) {
  return [...host.querySelectorAll<HTMLElement>('*')].find((element) => element.textContent?.trim() === value)
}

afterEach(() => {
  apps.splice(0).forEach((app) => app.unmount())
  document.body.innerHTML = ''
})

describe('LocationInput model form', () => {
  it('loads map config, selects a prediction, and edits location data through Form', async () => {
    const predictions: LocationPrediction[] = [{ id: 'harbor', primaryText: 'Harbor' }]
    const selected = { lat: -6, lng: 111, name: 'Harbor', formatted_address: 'Harbor road' }
    const operations: LocationOperations = {
      mapConfig: vi.fn(async () => ({ apiKey: 'map-key' })),
      autocomplete: vi.fn(async () => predictions),
      detail: vi.fn(async () => selected),
    }
    const view = mountLocation(operations)
    await flush()

    expect(operations.mapConfig).toHaveBeenCalledWith({ signal: expect.any(AbortSignal) })
    expect(view.host.querySelector('.location-map')?.getAttribute('data-api-key')).toBe('map-key')

    view.host.querySelector<HTMLElement>('.location-map')!.click()
    await flush()
    expect(view.model.value).toEqual({ lat: -5, lng: 110 })
    expect(view.host.querySelector('label')?.textContent).toContain('Nama Lokasi')

    enter(input(view.host, 'location-search-box'), 'harbor')
    await flush()
    expect(operations.autocomplete).toHaveBeenCalledWith({ input: 'harbor', signal: expect.any(AbortSignal) })
    const suggestion = [...view.host.querySelectorAll<HTMLElement>('[role="button"]')]
      .find((element) => element.textContent?.trim() === 'Harbor')
    expect(suggestion).not.toBeUndefined()
    if (!suggestion) throw new Error('Expected a location suggestion.')
    suggestion.click()
    await flush()
    expect(operations.detail).toHaveBeenCalledWith({ id: 'harbor', signal: expect.any(AbortSignal) })
    expect(view.model.value).toEqual(selected)

    const nameLabel = [...view.host.querySelectorAll<HTMLLabelElement>('label')].find((label) => label.textContent?.includes('Nama Lokasi'))
    expect(nameLabel).not.toBeUndefined()
    enter(input(view.host, nameLabel!.htmlFor), 'Harbor office')
    await flush()
    expect(view.model.value).toEqual({ ...selected, name: 'Harbor office' })
  })

  it('aborts an older autocomplete request and keeps the latest prediction', async () => {
    let resolveFirst!: (value: readonly LocationPrediction[]) => void
    let firstSignal: AbortSignal | undefined
    const first = new Promise<readonly LocationPrediction[]>((resolve) => { resolveFirst = resolve })
    const operations: LocationOperations = {
      mapConfig: async () => ({ apiKey: 'map-key' }),
      autocomplete: vi.fn(({ input: query, signal }) => {
        if (query === 'first') {
          firstSignal = signal
          return first
        }
        return [{ id: 'latest', primaryText: 'Latest' }]
      }),
      detail: async () => ({ lat: 0, lng: 0 }),
    }
    const view = mountLocation(operations)
    await flush()

    enter(input(view.host, 'location-search-box'), 'first')
    await flush()
    enter(input(view.host, 'location-search-box'), 'latest')
    await flush()
    resolveFirst([{ id: 'first', primaryText: 'First' }])
    await flush()

    expect(firstSignal?.aborted).toBe(true)
    expect(view.host.textContent).toContain('Latest')
    expect(view.host.textContent).not.toContain('First')
  })
})
