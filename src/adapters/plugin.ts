import type { App, Plugin } from 'vue'
import type { QueryClient } from '@tanstack/vue-query'
import { VueQueryPlugin } from '@tanstack/vue-query'
import { frameworkFieldDefaultsKey, resolveFrameworkFieldDefaults, type FrameworkFieldDefaultsInput } from '../fields/defaults'
import { frameworkAdaptersKey, resolveFrameworkAdapters, type FrameworkAdaptersInput } from './projectAdapters'
import { createFrameworkQueryClient, frameworkQueryClientKey } from '../query/client'
import { createRendererRegistries, rendererRegistriesKey, type RendererRegistriesInput } from '../renderers/registry'
import { emptyInputPropsRegistry, inputPropsRegistryKey, type InputPropsRegistry } from '../renderers/inputProps'
import { registerResourceRuntime } from '../resources/runtime'
import {
  frameworkUiDefaultsKey,
  resolveFrameworkUiDefaults,
  type FrameworkUiDefaultsInput,
} from '../components/views/uiDefaults'

export interface FrameworkPluginOptions {
  fieldDefaults?: FrameworkFieldDefaultsInput
  /** Project-specific normalization, query location, and schema lookup. */
  adapters?: FrameworkAdaptersInput
  /** Injected cache client for tests and advanced projects. */
  queryClient?: QueryClient
  /** Project renderer implementations, registered per surface. */
  renderers?: RendererRegistriesInput
  /** App-owned source-to-native-input-props registry. */
  inputProps?: InputPropsRegistry
  /** App-level chrome defaults for view shells. */
  uiDefaults?: FrameworkUiDefaultsInput
}

export const FrameworkPlugin: Plugin<[options?: FrameworkPluginOptions]> = {
  install(app: App, options: FrameworkPluginOptions = {}) {
    const fieldDefaults = resolveFrameworkFieldDefaults(options.fieldDefaults)
    app.provide(frameworkFieldDefaultsKey, fieldDefaults)

    const adapters = resolveFrameworkAdapters(options?.adapters)
    app.provide(frameworkAdaptersKey, adapters)

    app.provide(rendererRegistriesKey, createRendererRegistries(options?.renderers))
    const inputProps = options.inputProps ?? emptyInputPropsRegistry()
    app.provide(inputPropsRegistryKey, inputProps)
    app.provide(frameworkUiDefaultsKey, resolveFrameworkUiDefaults(options.uiDefaults))

    const queryClient = options?.queryClient ?? createFrameworkQueryClient(adapters.queryDefaults)
    app.provide(frameworkQueryClientKey, queryClient)
    app.use(VueQueryPlugin, { queryClient })
    registerResourceRuntime({ adapters, queryClient, fieldDefaults, inputProps })
  },
}
