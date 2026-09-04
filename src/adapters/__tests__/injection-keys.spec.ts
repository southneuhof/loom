import { createApp, defineComponent, h } from 'vue'
import { describe, expect, it } from 'vitest'
import { frameworkFieldDefaultsKey } from '../../fields'
import { FrameworkPlugin } from '../plugin'
import { frameworkAdaptersKey } from '../projectAdapters'
import { frameworkQueryClientKey } from '../../query/client'
import { rendererRegistriesKey } from '../../renderers/registry'
import { inputPropsRegistryKey } from '../../renderers/inputProps'

describe('framework injection keys', () => {
  it('uses realm-stable symbols for every plugin-provided dependency', () => {
    expect(frameworkFieldDefaultsKey).toBe(Symbol.for('loom-field-defaults'))
    expect(frameworkAdaptersKey).toBe(Symbol.for('loom-adapters'))
    expect(frameworkQueryClientKey).toBe(Symbol.for('loom-query-client'))
    expect(rendererRegistriesKey).toBe(Symbol.for('loom-renderers'))
    expect(inputPropsRegistryKey).toBe(Symbol.for('loom-input-props'))
  })

  it('keeps empty input-props registries isolated per app', () => {
    const App = defineComponent(() => () => h('div'))
    const first = createApp(App).use(FrameworkPlugin)
    const second = createApp(App).use(FrameworkPlugin)
    const firstRegistry = first._context.provides[inputPropsRegistryKey as symbol] as { resolve: Function }
    const secondRegistry = second._context.provides[inputPropsRegistryKey as symbol] as { resolve: Function }
    expect(firstRegistry).not.toBe(secondRegistry)
    expect(firstRegistry.resolve('x', { props: { x: 1 } })).toEqual({ x: 1 })
  })

  it('keeps provided field defaults isolated per Vue app', () => {
    const App = defineComponent(() => () => h('div'))
    const first = createApp(App).use(FrameworkPlugin, { fieldDefaults: { table: { align: 'start' } } })
    const second = createApp(App).use(FrameworkPlugin, { fieldDefaults: { table: { align: 'end' } } })

    expect(first._context.provides[frameworkFieldDefaultsKey as symbol]).toEqual({
      table: { align: 'start', props: {} }, detail: { props: {} }, form: { props: {} }, fields: {},
    })
    expect(second._context.provides[frameworkFieldDefaultsKey as symbol]).toEqual({
      table: { align: 'end', props: {} }, detail: { props: {} }, form: { props: {} }, fields: {},
    })
  })
})
