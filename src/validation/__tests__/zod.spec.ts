import { describe, expect, it } from 'vitest'
import { z } from 'zod/v4'
import { getSchemaKind } from '../../fields/schemaMetadata'
import { inferFieldLayers } from '../zod'

describe('selection schema metadata', () => {
  const itemSchema = z.object({ userProjectId: z.string(), permission_name: z.string() })

  it('marks an object array as selection[]', () => {
    const layers = inferFieldLayers(z.object({ permissions: z.array(itemSchema).meta({ contract: 'selection' }) }))

    expect(getSchemaKind(layers.permissions)).toBe('selection[]')
  })

  it('keeps an unmarked object array as object[]', () => {
    const layers = inferFieldLayers(z.object({ permissions: z.array(itemSchema) }))

    expect(getSchemaKind(layers.permissions)).toBe('object[]')
  })

  it('keeps the marker through supported wrappers', () => {
    const marked = z.array(itemSchema).meta({ contract: 'selection' })
    const layers = inferFieldLayers(z.object({
      optional: marked.optional(),
      nullable: marked.nullable(),
      defaulted: marked.default([]),
      transformed: marked.transform((value) => value),
      piped: marked.pipe(z.array(itemSchema)),
    }))

    expect(Object.values(layers).map((layer) => getSchemaKind(layer))).toEqual([
      'selection[]',
      'selection[]',
      'selection[]',
      'selection[]',
      'selection[]',
    ])
  })

  it('keeps the marker when array constraints wrap the selection', () => {
    const itemSchema = z.object({ id: z.string(), name: z.string() }).meta({ contract: 'selection' })
    const layers = inferFieldLayers(z.object({ owners: z.array(itemSchema).min(1).optional() }))

    expect(getSchemaKind(layers.owners)).toBe('selection[]')
  })

  it('does not require fixed item keys', () => {
    const layers = inferFieldLayers(z.object({ permissions: z.array(
      z.object({ mappingRowId: z.string(), permission_name: z.string() }),
    ).meta({ contract: 'selection' }) }))

    expect(getSchemaKind(layers.permissions)).toBe('selection[]')
  })
})
