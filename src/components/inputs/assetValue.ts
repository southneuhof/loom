export interface InputAssetValue {
  kind: 'file'
  id: string
  url: string
  name: string
  size?: number
  mimeType?: string
  updatedAt?: string
  metadata?: Record<string, unknown>
}

export function toInputAssetValue(input: unknown): InputAssetValue | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  const value = input as Record<string, unknown>
  const allowed = new Set(['kind', 'id', 'url', 'name', 'size', 'mimeType', 'updatedAt', 'metadata'])
  if (Object.keys(value).some((key) => !allowed.has(key))) return null
  if (value.kind !== 'file' || typeof value.id !== 'string' || !value.id
    || typeof value.url !== 'string' || !value.url || typeof value.name !== 'string' || !value.name) return null
  if (value.size !== undefined && (typeof value.size !== 'number' || !Number.isFinite(value.size))) return null
  if (value.mimeType !== undefined && typeof value.mimeType !== 'string') return null
  if (value.updatedAt !== undefined && typeof value.updatedAt !== 'string') return null
  if (value.metadata !== undefined && (typeof value.metadata !== 'object' || value.metadata === null || Array.isArray(value.metadata))) return null
  return value as unknown as InputAssetValue
}

export function toInputAssetValues(input: unknown): InputAssetValue[] {
  const values = Array.isArray(input) ? input : [input]
  return values.map(toInputAssetValue).filter((item): item is InputAssetValue => Boolean(item))
}

export function isImageAssetValue(input: unknown): boolean {
  return toInputAssetValue(input)?.mimeType?.startsWith('image/') ?? false
}
