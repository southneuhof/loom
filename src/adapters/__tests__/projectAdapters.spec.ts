import { describe, expect, it } from 'vitest'
import { createApp, defineComponent, h } from 'vue'
import { FrameworkPlugin } from '../plugin'
import { defaultDataAdapter, resolveFrameworkAdapters, useFrameworkAdapters } from '../projectAdapters'
import { frameworkQueryClientKey } from '../../query/client'

function mountWith(options: Parameters<typeof FrameworkPlugin.install>[1]) {
  let adapters: ReturnType<typeof useFrameworkAdapters> | undefined
  const app = createApp(
    defineComponent({
      setup() {
        adapters = useFrameworkAdapters()
        return () => h('div')
      },
    }),
  )
  app.use(FrameworkPlugin, options)
  app.mount(document.createElement('div'))
  return { app, adapters: adapters! }
}

describe('default data adapter', () => {
  it('normalizes errors and unknown rejections', () => {
    expect(defaultDataAdapter.normalizeError(new Error('boom')).message).toBe('boom')
    expect(defaultDataAdapter.normalizeError({ message: 'refused' }).message).toBe('refused')
    expect(defaultDataAdapter.normalizeError(null).message).toBe('Request failed.')
  })
})

describe('adapter resolution', () => {
  it('falls back to framework defaults for missing optional adapters', () => {
    const resolved = resolveFrameworkAdapters()

    expect(resolved.data.normalizeError(new Error('boom')).message).toBe('boom')
    expect(resolved.schemas).toBeUndefined()
    expect(resolved.queryDefaults.staleTime).toBe(30_000)
    expect(typeof resolved.query.read).toBe('function')
  })

  it('merges partial error adapters over the defaults', () => {
    const resolved = resolveFrameworkAdapters({ data: { normalizeError: () => ({ message: 'custom' }) } })

    expect(resolved.data.normalizeError(new Error('boom')).message).toBe('custom')
  })
})

describe('plugin installation', () => {
  it('isolates adapters between apps', () => {
    const first = mountWith({ adapters: { queryDefaults: { staleTime: 1 } } })
    const second = mountWith({ adapters: { queryDefaults: { staleTime: 2 } } })

    expect(first.adapters.queryDefaults.staleTime).toBe(1)
    expect(second.adapters.queryDefaults.staleTime).toBe(2)
    first.app.unmount()
    second.app.unmount()
  })

  it('creates one isolated query client per app', () => {
    const first = mountWith({ runtime: {} })
    const second = mountWith({ runtime: {} })

    const firstClient = first.app._context.provides[frameworkQueryClientKey as symbol]
    const secondClient = second.app._context.provides[frameworkQueryClientKey as symbol]

    expect(firstClient).toBeDefined()
    expect(firstClient).not.toBe(secondClient)
    first.app.unmount()
    second.app.unmount()
  })

  it('accepts an injected query client', () => {
    const injected = resolveFrameworkAdapters()
    void injected
    const { app } = mountWith({ runtime: {} })
    const client = app._context.provides[frameworkQueryClientKey as symbol]
    app.unmount()

    const reused = mountWith({ queryClient: client as never })
    expect(reused.app._context.provides[frameworkQueryClientKey as symbol]).toBe(client)
    reused.app.unmount()
  })

  it('applies adapter query defaults to the created client', () => {
    const { app } = mountWith({ adapters: { queryDefaults: { staleTime: 1234, retry: 3 } } })
    const client = app._context.provides[frameworkQueryClientKey as symbol] as {
      getDefaultOptions: () => { queries?: { staleTime?: number; retry?: number } }
    }

    expect(client.getDefaultOptions().queries?.staleTime).toBe(1234)
    expect(client.getDefaultOptions().queries?.retry).toBe(3)
    app.unmount()
  })
})
