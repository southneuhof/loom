import { createApp, h, nextTick, ref } from 'vue'
import { marker } from 'leaflet'
import { afterEach, expect, it, vi } from 'vitest'
import MapView from '../MapView.vue'

vi.mock('leaflet', { spy: true })
vi.mock('vue3-google-map', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    GoogleMap: defineComponent({
      props: ['apiKey', 'zoom'],
      setup: (props, { slots }) => () => h('figure', { 'aria-label': 'Google map', 'data-zoom': props.zoom }, slots.default?.()),
    }),
    Marker: defineComponent({ render: () => h('span') }),
  }
})

function mountMap(props: () => InstanceType<typeof MapView>['$props']) {
  const host = document.createElement('div')
  document.body.append(host)
  const app = createApp({ render: () => h(MapView, props()) })
  app.mount(host)
  return {
    host,
    unmount() {
      app.unmount()
      host.remove()
    },
  }
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

it('falls back to a read-only OpenStreetMap and updates the marker when the location changes', async () => {
  vi.stubEnv('GOOGLE_MAP_API_KEY', '')
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    disconnect() {}
  })
  const location = ref<{ lat: number | string; lng: number | string; address?: string } | null>(
    { lat: '0', lng: '104.1', address: 'First site' },
  )
  const view = mountMap(() => ({ mapProvider: 'google', location: location.value, class: 'h-96' }))
  try {
    expect(view.host.querySelector('[aria-label="Location map"]')?.classList.contains('h-96')).toBe(true)
    expect(marker).toHaveBeenLastCalledWith({ lat: 0, lng: 104.1 }, expect.objectContaining({ draggable: false }))
    expect(view.host.textContent).toContain('First site')

    location.value = { lat: -6, lng: '106.8', address: 'Second site' }
    await nextTick()
    expect(marker).toHaveBeenLastCalledWith({ lat: -6, lng: 106.8 }, expect.objectContaining({ draggable: false }))
    expect(view.host.textContent).toContain('Second site')

    location.value = null
    await nextTick()
    expect(view.host.querySelector('.leaflet-marker-icon')).toBeNull()
    expect(view.host.textContent).not.toContain('Second site')
  } finally {
    view.unmount()
  }
})

it('uses Google Maps with the default zoom when a key and the provider are set', () => {
  vi.stubEnv('GOOGLE_MAP_API_KEY', 'configured-key')
  const view = mountMap(() => ({ mapProvider: 'google', lat: 0, lng: 0 }))
  try {
    expect(view.host.querySelector('[aria-label="Google map"]')?.getAttribute('data-zoom')).toBe('13')
  } finally {
    view.unmount()
  }
})
