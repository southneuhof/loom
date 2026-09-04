import type { CollectionResult, MaybePromise, UploadProgress } from '../contracts'

export interface ManagedAsset {
  id: string
  parentId?: string | null
  kind: 'file' | 'folder'
  name: string
  mimeType?: string
  size?: number
  updatedAt?: string
  previewUrl?: string
  metadata?: Record<string, unknown>
}

export interface FileManagerListContext {
  parentId: string | null
  sort?: { field: 'name' | 'updatedAt'; direction: 'asc' | 'desc' }
  signal?: AbortSignal
}

export interface FileManagerOperations {
  list(context: FileManagerListContext): MaybePromise<CollectionResult<ManagedAsset>>
  upload?(file: File, context: { parentId: string | null; onProgress?: (progress: UploadProgress) => void; signal?: AbortSignal }): MaybePromise<ManagedAsset>
  createFolder?(context: { parentId: string | null; name: string; signal?: AbortSignal }): MaybePromise<ManagedAsset>
  remove?(context: { id: string; signal?: AbortSignal }): MaybePromise<void>
}

export interface FileManagerValueAdapter<TModel = unknown> {
  fromModel(value: TModel): MaybePromise<ManagedAsset | undefined>
  toModel(asset: ManagedAsset): MaybePromise<TModel>
}

export interface FileManagerPluginOptions<TModel = unknown> {
  root: string
  operations: FileManagerOperations
  values: FileManagerValueAdapter<TModel>
}
