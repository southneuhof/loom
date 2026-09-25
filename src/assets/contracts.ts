import type { UploadOperation } from '../contracts/upload'

export interface AssetValue {
  kind: 'file'
  id: string
  url: string
  name: string
  size?: number
  mimeType?: string
  updatedAt?: string
  metadata?: Record<string, unknown>
}

export interface AssetPreview {
  imageURL: string
  thumbnailURL: string
}

export interface AssetAdapter {
  read(value: unknown): AssetValue | null
  preview(value: AssetValue): AssetPreview
  upload: UploadOperation<AssetValue>
}
