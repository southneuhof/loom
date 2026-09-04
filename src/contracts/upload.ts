import type { MaybePromise } from './load'

export interface UploadProgress {
  loaded: number
  total?: number
}

export interface UploadContext {
  destination?: string
  signal?: AbortSignal
  onProgress?: (progress: UploadProgress) => void
}

export type UploadOperation<TResult = unknown> =
  (file: Blob, context: UploadContext) => MaybePromise<TResult>
