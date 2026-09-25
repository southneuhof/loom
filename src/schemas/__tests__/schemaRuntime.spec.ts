import { describe, expect, it } from 'vitest'
import { z as z3 } from 'zod/v3'
import { z as z4 } from 'zod/v4'
import { createSchemaRuntime, schemaOutputKeys, schemaSortByValues } from '../schemaRuntime'

describe('schema runtime', () => {
  it('discovers ordered input keys and required keys from both Zod dialects', () => {
    const schema3 = z3.object({
      requiredName: z3.string(),
      optionalName: z3.string().optional(),
      defaultName: z3.string().default('Ada'),
      caughtName: z3.string().catch('Ada'),
    })
    const schema4 = z4.object({
      requiredAmount: z4.number(),
      optionalAmount: z4.number().optional(),
      defaultAmount: z4.number().default(1),
      prefaultAmount: z4.number().prefault(2),
    })

    const runtime3 = createSchemaRuntime(schema3)
    const runtime4 = createSchemaRuntime(schema4)

    expect(runtime3.inputKeys).toEqual(['requiredName', 'optionalName', 'defaultName', 'caughtName'])
    expect([...runtime3.requiredKeys]).toEqual(['requiredName'])
    expect(runtime4.inputKeys).toEqual(['requiredAmount', 'optionalAmount', 'defaultAmount', 'prefaultAmount'])
    expect([...runtime4.requiredKeys]).toEqual(['requiredAmount'])
  })

  it('does not execute defaults or transforms during inspection', async () => {
    let defaultCalls = 0
    let transformCalls = 0
    const schema = z4.object({
      name: z4.string().default(() => {
        defaultCalls += 1
        return 'Ada'
      }),
      count: z4.string().transform((value) => {
        transformCalls += 1
        return Number(value)
      }),
    }).transform(({ name, count }) => ({ displayName: name, count }))

    const runtime = createSchemaRuntime(schema)

    expect(defaultCalls).toBe(0)
    expect(transformCalls).toBe(0)
    expect(runtime.inputKeys).toEqual(['name', 'count'])
    expect([...runtime.requiredKeys]).toEqual(['count'])
    await expect(runtime.parseAsync({ count: '4' })).resolves.toEqual({
      success: true,
      data: { displayName: 'Ada', count: 4 },
    })
    expect(defaultCalls).toBeGreaterThan(0)
    expect(transformCalls).toBeGreaterThan(0)
  })

  it('describes inspectable record output keys without running a top-level transform', () => {
    let transformCalls = 0
    const direct = z4.object({ id: z4.string(), joinedRoles: z4.array(z4.string()) })
    const transformed = direct.transform((record) => {
      transformCalls += 1
      return { name: record.id }
    })

    expect(schemaOutputKeys(direct)).toEqual(['id', 'joinedRoles'])
    expect(schemaOutputKeys(transformed)).toBeUndefined()
    expect(transformCalls).toBe(0)
  })

  it('parses async refinements and keeps nested issue paths', async () => {
    const schema = z4.object({
      profile: z4.object({
        email: z4.string().refine(async (value) => value.includes('@'), 'Invalid email'),
      }),
    })
    const runtime = createSchemaRuntime(schema)

    await expect(runtime.parseAsync({ profile: { email: 'invalid' } })).resolves.toMatchObject({
      success: false,
      issues: [{ path: ['profile', 'email'], message: 'Invalid email' }],
    })
    await expect(runtime.parseAsync({ profile: { email: 'ada@example.com' } })).resolves.toEqual({
      success: true,
      data: { profile: { email: 'ada@example.com' } },
    })
  })

  it('parses and normalizes issues through a Zod v3 schema', async () => {
    const runtime = createSchemaRuntime(z3.object({ name: z3.string().min(3, 'Name is too short') }))

    await expect(runtime.parseAsync({ name: 'Ada' })).resolves.toEqual({
      success: true,
      data: { name: 'Ada' },
    })
    await expect(runtime.parseAsync({ name: 'Al' })).resolves.toEqual({
      success: false,
      issues: [{ path: ['name'], message: 'Name is too short' }],
    })
  })

  it('rejects schemas without finite discoverable object input', () => {
    expect(() => createSchemaRuntime(z4.union([z4.object({ name: z4.string() }), z4.object({ id: z4.string() })]))).toThrow(
      '[loom][FORM_SCHEMA_INPUT_UNSUPPORTED]',
    )
    expect(() => createSchemaRuntime(z3.preprocess((value) => value, z3.object({ name: z3.string() })))).toThrow(
      '[loom][FORM_SCHEMA_INPUT_UNSUPPORTED]',
    )
  })

  it('rejects pass-through and catch-all input object dialects', () => {
    expect(() => createSchemaRuntime(z3.object({ name: z3.string() }).passthrough())).toThrow(
      '[loom][FORM_SCHEMA_INPUT_UNSUPPORTED]',
    )
    expect(() => createSchemaRuntime(z3.object({ name: z3.string() }).catchall(z3.string()))).toThrow(
      '[loom][FORM_SCHEMA_INPUT_UNSUPPORTED]',
    )
    expect(() => createSchemaRuntime(z4.object({ name: z4.string() }).loose())).toThrow(
      '[loom][FORM_SCHEMA_INPUT_UNSUPPORTED]',
    )
    expect(() => createSchemaRuntime(z4.object({ name: z4.string() }).catchall(z4.string()))).toThrow(
      '[loom][FORM_SCHEMA_INPUT_UNSUPPORTED]',
    )
  })

  it('reads finite sort choices from Zod v3 and v4 without running transforms', () => {
    let transformCalls = 0
    const schema3 = z3.object({ sort_by: z3.enum(['name', 'createdAt']) })
    const schema4 = z4.object({
      sort_by: z4.enum(['name', 'createdAt']).transform((value) => {
        transformCalls += 1
        return value
      }),
    })

    expect(schemaSortByValues(schema3)).toEqual(['name', 'createdAt'])
    expect(schemaSortByValues(schema4)).toEqual(['name', 'createdAt'])
    expect(transformCalls).toBe(0)
  })

  it('returns no finite sort choices for an unbounded sort field', () => {
    expect(schemaSortByValues(z4.object({ sort_by: z4.string() }))).toBeUndefined()
  })
})
