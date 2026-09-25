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
  return { app, host, model }
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

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((complete) => { resolve = complete })
  return { promise, resolve }
}

let restoreGeolocation: () => void = () => undefined

function installGeolocation(getCurrentPosition: (success: PositionCallback, error?: PositionErrorCallback, options?: PositionOptions) => void) {
  const original = Object.getOwnPropertyDescriptor(navigator, 'geolocation')
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition } })
  restoreGeolocation = () => {
    if (original) Object.defineProperty(navigator, 'geolocation', original)
    else Reflect.deleteProperty(navigator, 'geolocation')
  }
}

afterEach(() => {
  restoreGeolocation()
  restoreGeolocation = () => undefined
  apps.splice(0).forEach((app) => app.unmount())
  document.body.innerHTML = ''
})

describe('LocationInput model form', () => {
  it('shows a map configuration failure', async () => {
    const operations: LocationOperations = {
      mapConfig: vi.fn(async () => { throw new Error('Map configuration failed.') }),
      autocomplete: async () => [],
      detail: async () => ({ lat: 0, lng: 0 }),
    }
    const view = mountLocation(operations)

    await flush()

    expect(view.host.textContent).toContain('Map configuration failed.')
  })

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

  it('ignores an autocomplete error after a newer search replaces it', async () => {
    let rejectFirst!: (reason: Error) => void
    const first = new Promise<readonly LocationPrediction[]>((_resolve, reject) => { rejectFirst = reject })
    const operations: LocationOperations = {
      mapConfig: async () => ({ apiKey: 'map-key' }),
      autocomplete: ({ input: query }) => query === 'first'
        ? first
        : [{ id: 'latest', primaryText: 'Latest' }],
      detail: async () => ({ lat: 0, lng: 0 }),
    }
    const view = mountLocation(operations)
    await flush()

    enter(input(view.host, 'location-search-box'), 'first')
    await flush()
    enter(input(view.host, 'location-search-box'), 'latest')
    await flush()
    rejectFirst(new Error('Stale location failure.'))
    await flush()

    expect(view.host.textContent).toContain('Latest')
    expect(view.host.textContent).not.toContain('Stale location failure.')
  })

  it('ignores a geolocation result after the user selects a prediction', async () => {
    let completeLocation: PositionCallback | undefined
    installGeolocation((success) => { completeLocation = success })
    const selected = { lat: -6, lng: 111, name: 'Harbor' }
    const detail = deferred<Coordinate>()
    const operations: LocationOperations = {
      mapConfig: async () => ({ apiKey: 'map-key' }),
      autocomplete: async () => [{ id: 'harbor', primaryText: 'Harbor' }],
      detail: vi.fn(() => detail.promise),
    }
    const view = mountLocation(operations)
    await flush()

    view.host.querySelector<HTMLButtonElement>('button[aria-label="Gunakan lokasi saat ini"]')!.click()
    enter(input(view.host, 'location-search-box'), 'harbor')
    await flush()
    const suggestion = [...view.host.querySelectorAll<HTMLButtonElement>('[role="button"]')]
      .find((button) => button.textContent?.trim() === 'Harbor')
    if (!suggestion) throw new Error('Location prediction did not render.')
    suggestion.click()
    await flush()
    expect(operations.detail).toHaveBeenCalledWith({ id: 'harbor', signal: expect.any(AbortSignal) })

    if (!completeLocation) throw new Error('Geolocation did not start.')
    completeLocation({
      coords: { latitude: -5, longitude: 110, accuracy: 1, altitude: null, altitudeAccuracy: null, heading: null, speed: null },
      timestamp: 1,
    })
    await flush()
    expect(view.model.value).toBeUndefined()

    detail.resolve(selected)
    await flush()
    expect(view.model.value).toEqual(selected)
  })

  it('ignores a geolocation result after unmount', async () => {
    let completeLocation: PositionCallback | undefined
    const latitude = vi.fn(() => -5)
    const longitude = vi.fn(() => 110)
    installGeolocation((success) => { completeLocation = success })
    const operations: LocationOperations = {
      mapConfig: async () => ({ apiKey: 'map-key' }),
      autocomplete: async () => [],
      detail: async () => ({ lat: 0, lng: 0 }),
    }
    const view = mountLocation(operations)
    await flush()
    view.host.querySelector<HTMLButtonElement>('button[aria-label="Gunakan lokasi saat ini"]')!.click()
    view.app.unmount()

    if (!completeLocation) throw new Error('Geolocation did not start.')
    completeLocation({
      coords: {
        get latitude() { return latitude() },
        get longitude() { return longitude() },
        accuracy: 1,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: 1,
    })
    await flush()

    expect(latitude).not.toHaveBeenCalled()
    expect(longitude).not.toHaveBeenCalled()
    expect(view.model.value).toBeUndefined()
  })
})
