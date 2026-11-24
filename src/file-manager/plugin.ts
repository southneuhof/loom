import { defineAsyncComponent, inject, type Plugin } from 'vue'
import { frameworkQueryClientKey } from '../query/client'
import { rendererRegistriesKey } from '../renderers/registry'
import type { FileManagerPluginOptions } from './contracts'
import { fileManagerKey, type FileManagerProvider } from './provider'

const loadFileManagerInput = () => import('../components/composites/form-inputs/FileManager/FileManagerInput.vue')

declare module '../renderers/formContracts' {
  interface FormRendererComponents {
    'file-manager': typeof loadFileManagerInput
  }
}

function validate(options: FileManagerPluginOptions | undefined): asserts options is FileManagerPluginOptions {
  const prefix = '[loom/file-manager]'
  if (!options || typeof options !== 'object') throw new Error(`${prefix} options are required.`)
  if (typeof options.root !== 'string' || !options.root) throw new Error(`${prefix} root must be a non-empty string.`)
  if (typeof options.operations?.list !== 'function') throw new Error(`${prefix} operations.list is required.`)
  if (typeof options.values?.fromModel !== 'function' || typeof options.values?.toModel !== 'function') {
    throw new Error(`${prefix} values.fromModel and values.toModel are required.`)
  }
}

const folderKey = (parentId: string | null) => ['file-manager', 'list', parentId] as const

export const FileManagerPlugin: Plugin<[options: FileManagerPluginOptions]> = {
  install(app, options) {
    validate(options)
    const { queryClient, registries, existing } = app.runWithContext(() => ({
      queryClient: inject(frameworkQueryClientKey, null),
      registries: inject(rendererRegistriesKey, null),
      existing: inject(fileManagerKey, null),
    }))
    if (!queryClient || !registries) {
      throw new Error('[loom/file-manager] Install FrameworkPlugin before FileManagerPlugin.')
    }
    if (existing) throw new Error('[loom/file-manager] Only one provider may be installed per app.')

    const invalidateParent = (parentId: string | null) => queryClient.invalidateQueries({ queryKey: folderKey(parentId) })
    const provider: FileManagerProvider = {
      ...options,
      queryClient,
      listKey: (parentId, sort) => [...folderKey(parentId), sort ?? null],
      invalidateParent,
      invalidateRemovedSubtree: async (id, parentId) => {
        await Promise.all([
          invalidateParent(parentId),
          queryClient.removeQueries({ queryKey: folderKey(id) }),
        ])
      },
    }
    app.provide(fileManagerKey, provider)
    registries.form.register('file-manager', defineAsyncComponent(loadFileManagerInput))
  },
}
