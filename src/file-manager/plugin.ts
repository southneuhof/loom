import { defineAsyncComponent, type App, type Plugin } from 'vue'
import { frameworkQueryClientKey } from '../query/client'
import { rendererRegistriesKey, type RendererRegistries } from '../renderers/registry'
import type { FileManagerPluginOptions } from './contracts'
import { fileManagerKey, type FileManagerProvider } from './provider'

function validate(options: FileManagerPluginOptions | undefined): asserts options is FileManagerPluginOptions {
  const prefix = '[loom/file-manager]'
  if (!options || typeof options !== 'object') throw new Error(`${prefix} options are required.`)
  if (typeof options.root !== 'string' || !options.root) throw new Error(`${prefix} root must be a non-empty string.`)
  if (typeof options.operations?.list !== 'function') throw new Error(`${prefix} operations.list is required.`)
  if (typeof options.values?.fromModel !== 'function' || typeof options.values?.toModel !== 'function') {
    throw new Error(`${prefix} values.fromModel and values.toModel are required.`)
  }
}

function provided<T>(app: App, key: symbol): T | undefined {
  return (app as any)._context?.provides?.[key] as T | undefined
}

export const FileManagerPlugin: Plugin<[options: FileManagerPluginOptions]> = {
  install(app, options) {
    validate(options)
    const queryClient = provided<any>(app, frameworkQueryClientKey as symbol)
    const registries = provided<RendererRegistries>(app, rendererRegistriesKey as symbol)
    if (!queryClient || !registries) {
      throw new Error('[loom/file-manager] Install FrameworkPlugin before FileManagerPlugin.')
    }
    if (provided(app, fileManagerKey as symbol)) throw new Error('[loom/file-manager] Only one provider may be installed per app.')

    const listKey = (parentId: string | null, sort?: unknown) => ['file-manager', 'list', parentId, sort ?? null] as const
    const provider: FileManagerProvider = {
      ...options,
      queryClient,
      listKey,
      invalidateParent: async (parentId) => {
        await queryClient.invalidateQueries({ queryKey: ['file-manager', 'list', parentId] })
      },
      invalidateRemovedSubtree: async (id, parentId) => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['file-manager', 'list', parentId] }),
          queryClient.removeQueries({ queryKey: ['file-manager', 'list', id] }),
        ])
      },
    }
    app.provide(fileManagerKey, provider)
    registries.form.register('file-manager', defineAsyncComponent(
      () => import('../components/composites/form-inputs/FileManager/FileManagerInput.vue'),
    ))
  },
}
