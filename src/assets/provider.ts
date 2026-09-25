import { inject } from 'vue'
import { frameworkAdaptersKey } from '../adapters/projectAdapters'
import type { AssetAdapter, AssetPreview, AssetValue } from './contracts'

const requiredMessage = '[loom] ASSET_ADAPTER_REQUIRED'
const invalidResultMessage = '[loom] ASSET_ADAPTER_INVALID_RESULT'

function isAssetValue(value: unknown): value is AssetValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const asset = value as Record<string, unknown>
  const allowed = new Set(['kind', 'id', 'url', 'name', 'size', 'mimeType', 'updatedAt', 'metadata'])
  if (Object.keys(asset).some((key) => !allowed.has(key))) return false
  if (asset.kind !== 'file' || typeof asset.id !== 'string' || !asset.id
    || typeof asset.url !== 'string' || !asset.url || typeof asset.name !== 'string' || !asset.name) return false
  if (asset.size !== undefined && (typeof asset.size !== 'number' || !Number.isFinite(asset.size))) return false
  if (asset.mimeType !== undefined && typeof asset.mimeType !== 'string') return false
  if (asset.updatedAt !== undefined && typeof asset.updatedAt !== 'string') return false
  if (asset.metadata !== undefined && (!asset.metadata || typeof asset.metadata !== 'object' || Array.isArray(asset.metadata))) return false
  return true
}

function isAssetPreview(value: unknown): value is AssetPreview {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const preview = value as Record<string, unknown>
  return typeof preview.imageURL === 'string' && typeof preview.thumbnailURL === 'string'
}

export function useAssetAdapter(): AssetAdapter
export function useAssetAdapter(options: { optional: true }): AssetAdapter | undefined
export function useAssetAdapter(options?: { optional?: boolean }): AssetAdapter | undefined {
  const adapter = inject(frameworkAdaptersKey, null)?.assets
  if (!adapter) {
    if (options?.optional) return undefined
    throw new Error(requiredMessage)
  }

  return {
    read(value) {
      const result = adapter.read(value)
      if (result === null) return null
      if (!isAssetValue(result)) throw new Error(invalidResultMessage)
      return result
    },
    preview(value) {
      const result = adapter.preview(value)
      if (!isAssetPreview(result)) throw new Error(invalidResultMessage)
      return result
    },
    async upload(file, context) {
      const result = await adapter.upload(file, context)
      if (!isAssetValue(result)) throw new Error(invalidResultMessage)
      return result
    },
  }
}
