import { describe, expect, it } from 'vitest'
import { z as z3 } from 'zod/v3'
import { z as z4 } from 'zod/v4'
import { compileSchema, schemaOutputKeys } from '../compileSchema'

describe('compileSchema', () => {
  it('discovers finite input keys and scalar metadata from both Zod dialects', () => {
    const schema3 = z3.object({
      name: z3.string(),
      nickname: z3.string().optional(),
      status: z3.enum(['active', 'inactive']),
    })
    const schema4 = z4.object({
      amount: z4.number(),
      active: z4.boolean(),
      createdAt: z4.date(),
      kind: z4.literal(['one', 'two']),
    })

    const compiled3 = compileSchema(schema3)
    const compiled4 = compileSchema(schema4)

    expect(compiled3.inputKeys).toEqual(['name', 'nickname', 'status'])
    expect(compiled3.fields).toEqual({
      name: { kind: 'string', required: true },
      nickname: { kind: 'string', required: false },
      status: { kind: 'enum', required: true, options: ['active', 'inactive'] },
    })
    expect(compiled4.fields).toEqual({
      amount: { kind: 'number', required: true },
      active: { kind: 'boolean', required: true },
      createdAt: { kind: 'date', required: true },
      kind: { kind: 'enum', required: true, options: ['one', 'two'] },
    })
  })

  it('does not execute defaults or transforms until parsing', async () => {
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

    const compiled = compileSchema(schema)

    expect(defaultCalls).toBe(0)
    expect(transformCalls).toBe(0)
    expect(compiled.fields).toEqual({
      name: { kind: 'string', required: false },
      count: { kind: 'string', required: true },
    })
    await expect(compiled.parseAsync({ count: '4' })).resolves.toEqual({
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
    const compiled = compileSchema(schema)

    await expect(compiled.parseAsync({ profile: { email: 'invalid' } })).resolves.toMatchObject({
      success: false,
      issues: [{ path: ['profile', 'email'], message: 'Invalid email' }],
    })
    await expect(compiled.parseAsync({ profile: { email: 'ada@example.com' } })).resolves.toEqual({
      success: true,
      data: { profile: { email: 'ada@example.com' } },
    })
  })

  it('parses and normalizes issues through a Zod v3 schema', async () => {
    const compiled = compileSchema(z3.object({ name: z3.string().min(3, 'Name is too short') }))

    await expect(compiled.parseAsync({ name: 'Ada' })).resolves.toEqual({
      success: true,
      data: { name: 'Ada' },
    })
    await expect(compiled.parseAsync({ name: 'Al' })).resolves.toEqual({
      success: false,
      issues: [{ path: ['name'], message: 'Name is too short' }],
    })
  })

  it('rejects schemas without finite discoverable object input', () => {
    expect(() => compileSchema(z4.union([z4.object({ name: z4.string() }), z4.object({ id: z4.string() })]))).toThrow(
      '[loom][FORM_SCHEMA_INPUT_UNSUPPORTED]',
    )
    expect(() => compileSchema(z3.preprocess((value) => value, z3.object({ name: z3.string() })))).toThrow(
      '[loom][FORM_SCHEMA_INPUT_UNSUPPORTED]',
    )
  })

  it('rejects pass-through and catch-all input object dialects', () => {
    expect(() => compileSchema(z3.object({ name: z3.string() }).passthrough())).toThrow(
      '[loom][FORM_SCHEMA_INPUT_UNSUPPORTED]',
    )
    expect(() => compileSchema(z3.object({ name: z3.string() }).catchall(z3.string()))).toThrow(
      '[loom][FORM_SCHEMA_INPUT_UNSUPPORTED]',
    )
    expect(() => compileSchema(z4.object({ name: z4.string() }).loose())).toThrow(
      '[loom][FORM_SCHEMA_INPUT_UNSUPPORTED]',
    )
    expect(() => compileSchema(z4.object({ name: z4.string() }).catchall(z4.string()))).toThrow(
      '[loom][FORM_SCHEMA_INPUT_UNSUPPORTED]',
    )
  })

})
