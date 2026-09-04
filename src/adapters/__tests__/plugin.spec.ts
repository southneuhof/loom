import { createApp, defineComponent, h } from 'vue'
import { describe, expect, it } from 'vitest'
import { FrameworkPlugin } from '../plugin'
import { frameworkFieldDefaultsKey } from '../../fields'
import { frameworkAdaptersKey } from '../projectAdapters'
import { frameworkQueryClientKey } from '../../query'
import { rendererRegistriesKey } from '../../renderers/registry'
import { createInputPropsRegistry, inputPropsRegistryKey } from '../../renderers/inputProps'
import { frameworkUiDefaultsKey } from '../../components/views/uiDefaults'
import { useResourceRuntime } from '../../resources/runtime'

const App = defineComponent(() => () => h('div'))

describe('FrameworkPlugin', () => {
  it('installs without options', () => {
    const app = createApp(App).use(FrameworkPlugin)
    expect(app._context.provides[frameworkFieldDefaultsKey as symbol]).toEqual({
      table: { props: {} }, detail: { props: {} }, form: { props: {} }, fields: {},
    })
  })

  it('provides canonical options per app', () => {
    const inputProps = createInputPropsRegistry({ lookup: { normalize: (source: string) => ({ source }) } })
    const first = createApp(App).use(FrameworkPlugin, { fieldDefaults: { shared: { renderer: 'text' } }, inputProps })
    const second = createApp(App).use(FrameworkPlugin, { fieldDefaults: { table: { align: 'end' } } })
    for (const app of [first, second]) {
      expect(app._context.provides[frameworkAdaptersKey as symbol]).toBeDefined()
      expect(app._context.provides[rendererRegistriesKey as symbol]).toBeDefined()
      expect(app._context.provides[frameworkQueryClientKey as symbol]).toBeDefined()
    }
    expect(first._context.provides[frameworkFieldDefaultsKey as symbol])
      .not.toBe(second._context.provides[frameworkFieldDefaultsKey as symbol])
    expect(useResourceRuntime().fieldDefaults)
      .toBe(second._context.provides[frameworkFieldDefaultsKey as symbol])
    expect(first._context.provides[inputPropsRegistryKey as symbol]).toBe(inputProps)
    expect(first._context.provides[frameworkUiDefaultsKey as symbol]).toEqual({ submitLabel: 'Submit' })
    const labelled = createApp(App).use(FrameworkPlugin, { uiDefaults: { backLabel: 'Kembali' } })
    expect(labelled._context.provides[frameworkUiDefaultsKey as symbol]).toEqual({ backLabel: 'Kembali', submitLabel: 'Submit' })

    let inComponent: ReturnType<typeof useResourceRuntime> | undefined
    const Probe = defineComponent({ setup() { inComponent = useResourceRuntime(); return () => h('div') } })
    const probe = createApp(Probe).use(FrameworkPlugin, { inputProps })
    probe.mount(document.createElement('div'))
    expect(inComponent?.inputProps).toBe(inputProps)
    probe.unmount()
  })

  it('rejects legacy options at compile time', () => {
    if (false) {
      // @ts-expect-error removed runtime option
      createApp(App).use(FrameworkPlugin, { runtime: {} })
      // @ts-expect-error removed defaults option
      createApp(App).use(FrameworkPlugin, { defaults: {} })
      // @ts-expect-error raw runtime-shaped object is not plugin options
      createApp(App).use(FrameworkPlugin, { table: {} })
    }
    expect(true).toBe(true)
  })
})
