import { createApp, defineComponent, h, nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import type { AssetValue } from '../../assets/contracts'
import { FrameworkPlugin } from '../../adapters/plugin'
import FileManager from '../../components/utils/FileManager/FileManager.vue'
import type { CollectionResult } from '../../contracts'
import type { FileManagerPluginOptions, ManagedAsset } from '../contracts'
import { FileManagerPlugin } from '../plugin'
import { useFileManager, useOptionalFileManager } from '../provider'

const options: FileManagerPluginOptions = {
  root: 'opaque-root',
  operations: { list: async () => ({ data: [] }) },
  values: {
    fromModel: async () => undefined,
    toModel: async (asset: ManagedAsset): Promise<AssetValue> => ({
      kind: 'file',
      id: asset.id,
      url: asset.previewUrl ?? 'https://assets.test/file',
      name: asset.name,
    }),
  },
}

describe('FileManagerPlugin', () => {
  it('requires FrameworkPlugin first', () => {
    const app = createApp(defineComponent(() => () => h('div')))
    expect(() => app.use(FileManagerPlugin, options)).toThrow('Install FrameworkPlugin before FileManagerPlugin')
  })

  it('provides app-scoped configuration', () => {
    let provider: ReturnType<typeof useFileManager> | undefined
    const App = defineComponent({ setup() { provider = useFileManager(); return () => h('div') } })
    const app = createApp(App)
    app.use(FrameworkPlugin, {})
    app.use(FileManagerPlugin, options)
    app.mount(document.createElement('div'))
    expect(provider?.root).toBe('opaque-root')
    app.unmount()
  })

  it('supports absence through optional injection', () => {
    let provider: ReturnType<typeof useOptionalFileManager>
    const App = defineComponent({ setup() { provider = useOptionalFileManager(); return () => h('div') } })
    const app = createApp(App).use(FrameworkPlugin, {})
    app.mount(document.createElement('div'))
    expect(provider).toBeUndefined()
    app.unmount()
  })

  it('keeps the selected folder visible when a previous request finishes late', async () => {
    const folders: ManagedAsset[] = [
      { id: 'first', kind: 'folder', name: 'First folder' },
      { id: 'second', kind: 'folder', name: 'Second folder' },
    ]
    const requests = new Map<string, {
      signal?: AbortSignal
      complete: (result: CollectionResult<ManagedAsset>) => void
    }>()
    const app = createApp(FileManager).use(FrameworkPlugin).use(FileManagerPlugin, {
      ...options,
      operations: {
        list({ parentId, signal }) {
          if (parentId === options.root) return { data: folders }
          if (parentId === null) throw new Error('Expected a folder ID')
          return new Promise((complete) => requests.set(parentId, { signal, complete }))
        },
      },
    })
    const host = document.createElement('div')
    app.mount(host)

    async function openFolder(name: string, id: string) {
      const button = await vi.waitFor(() => {
        const match = [...host.querySelectorAll('aside button')].find((item) => item.textContent?.trim() === name)
        if (!(match instanceof HTMLButtonElement)) throw new Error(`Missing folder "${name}"`)
        return match
      })
      button.click()
      return vi.waitFor(() => {
        const request = requests.get(id)
        if (!request) throw new Error(`Missing request for "${id}"`)
        return request
      })
    }

    try {
      const first = await openFolder('First folder', 'first')
      const second = await openFolder('Second folder', 'second')
      expect(first.signal?.aborted).toBe(true)
      second.complete({ data: [{ id: 'report', kind: 'file', name: 'Report.pdf' }] })
      const content = () => host.querySelector('section')?.textContent
      await vi.waitFor(() => expect(content()).toContain('Report.pdf'))

      first.complete({ data: [{ id: 'old', kind: 'file', name: 'Old.pdf' }] })
      await Promise.resolve()
      await nextTick()
      expect(content()).toContain('Report.pdf')
      expect(content()).not.toContain('Old.pdf')
    } finally {
      app.unmount()
    }
  })
})
