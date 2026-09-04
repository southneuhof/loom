import { inject, type InjectionKey } from 'vue'
import type { QueryClient } from '@tanstack/vue-query'
import type { FileManagerPluginOptions } from './contracts'

export interface FileManagerProvider extends FileManagerPluginOptions {
  queryClient: QueryClient
  listKey: (parentId: string | null, sort?: unknown) => readonly unknown[]
  invalidateParent: (parentId: string | null) => Promise<void>
  invalidateRemovedSubtree: (id: string, parentId: string | null) => Promise<void>
}

export const fileManagerKey: InjectionKey<FileManagerProvider> = Symbol.for('loom-file-manager')

export function useOptionalFileManager(): FileManagerProvider | undefined {
  return inject(fileManagerKey, undefined)
}

export function useFileManager(): FileManagerProvider {
  const provider = useOptionalFileManager()
  if (!provider) throw new Error('[loom/file-manager] FileManagerPlugin is not installed.')
  return provider
}
