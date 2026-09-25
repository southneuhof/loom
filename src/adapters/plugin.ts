import type { App, Plugin } from 'vue'
import type { QueryClient } from '@tanstack/vue-query'
import { VueQueryPlugin } from '@tanstack/vue-query'
import { frameworkAdaptersKey, resolveFrameworkAdapters, type FrameworkAdaptersInput } from './projectAdapters'
import { createFrameworkQueryClient, frameworkQueryClientKey } from '../query/client'
import { createRendererRegistries, rendererRegistriesKey, type RendererRegistriesInput } from '../renderers/registry'
import { registerResourceRuntime } from '../resources/runtime'
import {
  frameworkUiDefaultsKey,
  resolveFrameworkUiDefaults,
  type FrameworkUiDefaultsInput,
} from '../components/views/uiDefaults'

export interface FrameworkPluginOptions {
  adapters?: FrameworkAdaptersInput
  /** Injected cache client for tests and advanced projects. */
  queryClient?: QueryClient
  /** Project renderer implementations, registered per surface. */
  renderers?: RendererRegistriesInput
  /** App-level chrome defaults for view shells. */
  uiDefaults?: FrameworkUiDefaultsInput
}

export const FrameworkPlugin: Plugin<[options?: FrameworkPluginOptions]> = {
  install(app: App, options: FrameworkPluginOptions = {}) {
    const adapters = resolveFrameworkAdapters(options.adapters)
    app.provide(frameworkAdaptersKey, adapters)

    app.provide(rendererRegistriesKey, createRendererRegistries(options?.renderers))
    app.provide(frameworkUiDefaultsKey, resolveFrameworkUiDefaults(options.uiDefaults))

    const queryClient = options.queryClient ?? createFrameworkQueryClient(adapters.queryDefaults)
    app.provide(frameworkQueryClientKey, queryClient)
    app.use(VueQueryPlugin, { queryClient })
    registerResourceRuntime({ adapters, queryClient })
  },
}
