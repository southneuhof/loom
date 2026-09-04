import { describe, expect, it } from 'vitest'
import { toInputAssetValue } from '../assetValue'

describe('canonical input asset values', () => {
  it('accepts canonical camelCase values', () => {
    const value = {
      kind: 'file' as const,
      id: '/storage/public/a.jpg',
      url: 'https://landing.test/storage/public/a.jpg',
      name: 'a.jpg',
      size: 12,
      mimeType: 'image/jpeg',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
    expect(toInputAssetValue(value)).toBe(value)
  })

  it.each([
    '/storage/public/report.pdf',
    { data: '/storage/public/a.pdf' },
    { type: 'file', path: '/a', url: '/a', filename: 'a' },
    { kind: 'file', path: '/a', url: '/a', name: 'a', ['content' + '_type']: 'application/pdf' },
    { kind: 'folder', id: '/a', url: '/a', name: 'a' },
  ])('rejects malformed or legacy value %#', (value) => {
    expect(toInputAssetValue(value)).toBeNull()
  })
})
