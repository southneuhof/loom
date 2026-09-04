import { createApp, defineComponent, h } from 'vue'
import { describe, expect, it } from 'vitest'
import { FrameworkPlugin } from '../../adapters/plugin'
import { FileManagerPlugin } from '../plugin'
import { useFileManager, useOptionalFileManager } from '../provider'

const options = {
  root: 'opaque-root',
  operations: { list: async () => ({ data: [] }) },
  values: {
    fromModel: async () => undefined,
    toModel: async (asset: any) => asset.id,
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
})
