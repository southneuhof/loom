import { createApp, defineComponent, h } from 'vue'
import { describe, expect, it } from 'vitest'
import { FrameworkPlugin } from '../plugin'
import { frameworkAdaptersKey } from '../projectAdapters'
import { frameworkQueryClientKey } from '../../query'
import { rendererRegistriesKey } from '../../renderers/registry'
import { createInputPropsRegistry, inputPropsRegistryKey } from '../../renderers/inputProps'
import { frameworkUiDefaultsKey } from '../../components/views/uiDefaults'

const App = defineComponent(() => () => h('div'))

describe('FrameworkPlugin', () => {
  it('installs without options', () => {
    const app = createApp(App).use(FrameworkPlugin)
    expect(app._context.provides[frameworkAdaptersKey as symbol]).toBeDefined()
  })

  it('provides adapters, renderer registries, and input props per app', () => {
    const inputProps = createInputPropsRegistry({ lookup: { normalize: (source: string) => ({ source }) } })
    const first = createApp(App).use(FrameworkPlugin, { inputProps })
    const second = createApp(App).use(FrameworkPlugin)
    for (const app of [first, second]) {
      expect(app._context.provides[frameworkAdaptersKey as symbol]).toBeDefined()
      expect(app._context.provides[rendererRegistriesKey as symbol]).toBeDefined()
      expect(app._context.provides[frameworkQueryClientKey as symbol]).toBeDefined()
    }
    expect(first._context.provides[inputPropsRegistryKey as symbol]).toBe(inputProps)
    expect(first._context.provides[frameworkUiDefaultsKey as symbol]).toEqual({ submitLabel: 'Submit' })
    const labelled = createApp(App).use(FrameworkPlugin, { uiDefaults: { backLabel: 'Kembali' } })
    expect(labelled._context.provides[frameworkUiDefaultsKey as symbol]).toEqual({ backLabel: 'Kembali', submitLabel: 'Submit' })
  })
})
