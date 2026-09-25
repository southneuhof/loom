import { createApp, defineComponent, h } from 'vue'
import { describe, expect, it } from 'vitest'
import { FrameworkPlugin } from '../plugin'
import { frameworkAdaptersKey } from '../projectAdapters'
import { frameworkQueryClientKey } from '../../query/client'
import { rendererRegistriesKey } from '../../renderers/registry'

describe('framework injection keys', () => {
  it('uses realm-stable symbols for every plugin-provided dependency', () => {
    expect(frameworkAdaptersKey).toBe(Symbol.for('loom-adapters'))
    expect(frameworkQueryClientKey).toBe(Symbol.for('loom-query-client'))
    expect(rendererRegistriesKey).toBe(Symbol.for('loom-renderers'))
  })
})
