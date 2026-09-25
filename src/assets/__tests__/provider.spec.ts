import { createApp, defineComponent, h, type App } from 'vue'
import { describe, expect, it } from 'vitest'
import { FrameworkPlugin } from '../../adapters/plugin'
import { resolveFrameworkAdapters } from '../../adapters/projectAdapters'
import ImagePreview from '../../components/base/ImagePreview.vue'
import { useAssetAdapter } from '../provider'
import type { AssetAdapter, AssetValue } from '../contracts'

const value: AssetValue = {
  kind: 'file',
  id: 'uploads/photo.png',
  url: '/photo.png',
  name: 'photo.png',
}

function assetAdapter(prefix: string): AssetAdapter {
  return {
    read(input) {
      if (!input || typeof input !== 'object' || Array.isArray(input)) return null
      return input as AssetValue
    },
    preview(asset) {
      return { imageURL: `${prefix}${asset.url}`, thumbnailURL: `${prefix}${asset.url}` }
    },
    upload: async () => value,
  }
}

function mountImage(adapter: AssetAdapter | undefined, props: Record<string, unknown>) {
  const host = document.createElement('div')
  const errors: unknown[] = []
  const app: App = createApp(defineComponent({
    setup: () => () => h(ImagePreview, props),
  }))
  app.config.errorHandler = (error) => errors.push(error)
  app.use(FrameworkPlugin, {
    adapters: adapter ? { assets: adapter } : {},
  })
  app.mount(host)
  return { app, host, errors }
}

describe('application asset adapter', () => {
  it('keeps canonical reads unchanged and preserves null', () => {
    let read!: AssetAdapter['read']
    const app = createApp(defineComponent({
      setup() {
        read = useAssetAdapter().read
        return () => h('div')
      },
    }))
    app.use(FrameworkPlugin, { adapters: { assets: assetAdapter('') } })
    app.mount(document.createElement('div'))

    expect(read(value)).toBe(value)
    expect(read(null)).toBeNull()
    app.unmount()
  })

  it('isolates image previews between applications', () => {
    const first = mountImage(assetAdapter('/first'), { asset: value })
    const second = mountImage(assetAdapter('/second'), { asset: value })

    expect(first.host.querySelector('img')?.getAttribute('src')).toBe('/first/photo.png')
    expect(second.host.querySelector('img')?.getAttribute('src')).toBe('/second/photo.png')
    first.app.unmount()
    second.app.unmount()
  })

  it('requires the service for asset previews while keeping URL previews independent', () => {
    const missing = mountImage(undefined, { asset: value })
    const missingNull = mountImage(undefined, { asset: null })
    const urlOnly = mountImage(undefined, { imageURL: '/url-only.png' })

    expect(missing.errors).toHaveLength(1)
    expect(String(missing.errors[0])).toContain('ASSET_ADAPTER_REQUIRED')
    expect(missingNull.errors).toHaveLength(1)
    expect(String(missingNull.errors[0])).toContain('ASSET_ADAPTER_REQUIRED')
    expect(urlOnly.host.querySelector('img')?.getAttribute('src')).toBe('/url-only.png')
    missing.app.unmount()
    missingNull.app.unmount()
    urlOnly.app.unmount()
  })

  it('rejects malformed service results and mixed preview sources', () => {
    const malformed = mountImage({
      ...assetAdapter(''),
      read: () => ({ kind: 'file', id: 1, url: '/photo.png', name: 'photo.png' }) as unknown as AssetValue,
    }, { asset: value })
    const mixed = mountImage(assetAdapter(''), { asset: value, imageURL: '/photo.png' })

    expect(String(malformed.errors[0])).toContain('ASSET_ADAPTER_INVALID_RESULT')
    expect(String(mixed.errors[0])).toContain('ASSET_PREVIEW_SOURCE_CONFLICT')
    malformed.app.unmount()
    mixed.app.unmount()
  })

  it('rejects malformed preview and upload results with the service diagnostic', async () => {
    let service!: AssetAdapter
    const app = createApp(defineComponent({
      setup() {
        service = useAssetAdapter()
        return () => h('div')
      },
    }))
    app.use(FrameworkPlugin, {
      adapters: {
        assets: {
          ...assetAdapter(''),
          preview: () => null as never,
          upload: async () => 'uploads/photo.png' as never,
        },
      },
    })
    app.mount(document.createElement('div'))

    expect(() => service.preview(value)).toThrow('ASSET_ADAPTER_INVALID_RESULT')
    await expect(service.upload(new File(['photo'], 'photo.png'), {})).rejects.toThrow('ASSET_ADAPTER_INVALID_RESULT')
    app.unmount()
  })

  it('validates adapter methods during framework adapter resolution', () => {
    expect(() => resolveFrameworkAdapters({ assets: { read: () => null } as never })).toThrow('Asset adapter')
  })
})
