import { describe, expect, it } from 'vitest'
import { z } from 'zod/v3'
import { z as z4 } from 'zod/v4'
import { fromZod, inferFieldLayers, requiredSchemaKeys } from '../zod'
import { assertNoHiddenRequiredFields, selectSchema, validateDraft, validateDraftAsync } from '../select'
import { resolveFields } from '../../fields'
import type { ValidationSchema } from '../../contracts'

const createSchema = z.object({
  name: z.string().min(3, 'Nama minimal 3 karakter'),
  email: z.string().email(),
  address: z.object({ city: z.string() }),
  tags: z.array(z.string().min(1)),
  note: z.string().optional(),
})

const passwordSchema = z
  .object({ password: z.string(), confirmation: z.string() })
  .refine((value) => value.password === value.confirmation, { message: 'Konfirmasi tidak cocok', path: ['confirmation'] })

describe('zod bridge', () => {
  it('returns parsed data on success', () => {
    const schema = fromZod(z.object({ name: z.string() }))

    expect(schema.validate({ name: 'Admin' })).toEqual({ success: true, data: { name: 'Admin' } })
  })

  it('returns transformed parsed data on success', () => {
    const schema = fromZod(
      z.object({ ids: z.array(z.object({ id: z.string() })) })
        .transform(({ ids }) => ({ ids: ids.map(({ id }) => id) })),
    )

    expect(schema.validate({ ids: [{ id: 'role-1' }] })).toEqual({ success: true, data: { ids: ['role-1'] } })
  })

  it('normalizes scalar, nested, array, and root issues with their paths', () => {
    const result = fromZod(createSchema).validate({ name: 'ab', email: 'nope', address: {}, tags: [''] })

    expect(result.success).toBe(false)
    if (result.success) return

    const paths = result.issues.map((issue) => issue.path.join('.'))
    expect(paths).toEqual(expect.arrayContaining(['name', 'email', 'address.city', 'tags.0']))
    expect(result.issues.find((issue) => issue.path.join('.') === 'name')?.message).toBe('Nama minimal 3 karakter')
  })

  it('reports every issue rather than only the first', () => {
    const result = fromZod(createSchema).validate({})

    expect(result.success).toBe(false)
    if (!result.success) expect(result.issues.length).toBeGreaterThan(1)
  })

  it('uses Required only for omitted top-level required values', () => {
    const schema = fromZod(z.object({
      name: z.string(),
      nickname: z.string().optional(),
      code: z.string().min(1, 'Code cannot be empty'),
    }))

    const omitted = schema.validate({ code: '' })
    expect(omitted).toMatchObject({
      success: false,
      issues: expect.arrayContaining([
        { path: ['name'], message: 'Required' },
        { path: ['code'], message: 'Code cannot be empty' },
      ]),
    })

    const wrongType = schema.validate({ name: 42, code: 'ok' })
    expect(wrongType.success).toBe(false)
    if (!wrongType.success) expect(wrongType.issues[0]?.message).not.toBe('Required')
  })

  it('keeps cross-field refine errors on their declared path', () => {
    const result = fromZod(passwordSchema).validate({ password: 'a', confirmation: 'b' })

    expect(result.success).toBe(false)
    if (!result.success) expect(result.issues).toEqual([{ path: ['confirmation'], message: 'Konfirmasi tidak cocok' }])
  })

  it('reports required keys for the hidden-but-required diagnostic', () => {
    expect(requiredSchemaKeys(createSchema).sort()).toEqual(['address', 'email', 'name', 'tags'])
    expect(requiredSchemaKeys(z.string())).toEqual([])
  })

  it('infers renderers and required presentation from schema metadata', () => {
    const layers = inferFieldLayers(
      z.object({
        name: z.string().min(3),
        age: z.number().optional(),
        active: z.boolean(),
        status: z.enum(['open', 'closed']),
      }),
    )

    expect(layers.name).toEqual({ renderer: 'text', props: { required: true } })
    expect(layers.age).toEqual({ renderer: 'number' })
    expect(layers.active).toEqual({ renderer: 'switch', props: { required: true } })
    expect(layers.status).toEqual({ renderer: 'select', props: { required: true, options: ['open', 'closed'] } })
  })

  it('feeds inferred metadata into field resolution as the schema layer', () => {
    const [field] = resolveFields({
      fields: { status: { label: 'Status' } },
      surface: 'form',
      schema: inferFieldLayers(z.object({ status: z.enum(['open', 'closed']) })),
    })

    expect(field.renderer).toBe('select')
    expect(field.props).toEqual({ required: true, options: ['open', 'closed'] })
  })

  it('changes validation when the schema changes, with no renderer edit', () => {
    const fields = { name: { form: { renderer: 'text' } } }
    const strict = fromZod(z.object({ name: z.string().min(5) }))
    const loose = fromZod(z.object({ name: z.string() }))

    expect(strict.validate({ name: 'abc' }).success).toBe(false)
    expect(loose.validate({ name: 'abc' }).success).toBe(true)
    expect(resolveFields({ fields, surface: 'form' })[0].renderer).toBe('text')
  })
})

/**
 * The API entity modules build their schemas with the `zod/v4` subpath, and the
 * browser imports those schemas directly. The dialect records different
 * internal metadata than classic Zod — `_def.type` instead of `_def.typeName`,
 * enum members as an object map instead of an array — so the bridge is exercised
 * against both. The classic-dialect blocks above are the other half of this gate.
 */
describe('zod v4 dialect', () => {
  const createSchema4 = z4.object({
    name: z4.string().min(3, 'Nama minimal 3 karakter'),
    address: z4.object({ city: z4.string() }),
    tags: z4.array(z4.string().min(1)),
    note: z4.string().optional(),
  })

  it('returns parsed data on success', () => {
    expect(fromZod(z4.object({ name: z4.string() })).validate({ name: 'Admin' })).toEqual({
      success: true,
      data: { name: 'Admin' },
    })
  })

  it('normalizes nested and array issue paths', () => {
    const result = fromZod(createSchema4).validate({ name: 'ab', address: {}, tags: [''] })

    expect(result.success).toBe(false)
    if (result.success) return

    const paths = result.issues.map((issue) => issue.path.join('.'))
    expect(paths).toEqual(expect.arrayContaining(['name', 'address.city', 'tags.0']))
    expect(result.issues.find((issue) => issue.path.join('.') === 'name')?.message).toBe('Nama minimal 3 karakter')
  })

  it('uses Required only for omitted top-level required values', () => {
    const schema = fromZod(z4.object({
      name: z4.string(),
      nickname: z4.string().optional(),
      code: z4.string().min(1, 'Code cannot be empty'),
    }))

    const omitted = schema.validate({ code: '' })
    expect(omitted).toMatchObject({
      success: false,
      issues: expect.arrayContaining([
        { path: ['name'], message: 'Required' },
        { path: ['code'], message: 'Code cannot be empty' },
      ]),
    })

    const wrongType = schema.validate({ name: 42, code: 'ok' })
    expect(wrongType.success).toBe(false)
    if (!wrongType.success) expect(wrongType.issues[0]?.message).not.toBe('Required')
  })

  it('reports required keys for the hidden-but-required diagnostic', () => {
    expect(requiredSchemaKeys(createSchema4).sort()).toEqual(['address', 'name', 'tags'])
    expect(requiredSchemaKeys(z4.string())).toEqual([])
  })

  it('infers renderers, reading enum members from the v4 entry map', () => {
    const layers = inferFieldLayers(
      z4.object({
        name: z4.string().min(3),
        age: z4.number().optional(),
        active: z4.boolean(),
        status: z4.enum(['open', 'closed']),
      }),
    )

    expect(layers.name).toEqual({ renderer: 'text', props: { required: true } })
    expect(layers.age).toEqual({ renderer: 'number' })
    expect(layers.active).toEqual({ renderer: 'switch', props: { required: true } })
    expect(layers.status).toEqual({ renderer: 'select', props: { required: true, options: ['open', 'closed'] } })
  })

  it('unwraps optional, nullable, and default wrappers to the inner renderer', () => {
    const layers = inferFieldLayers(
      z4.object({
        note: z4.string().optional(),
        retired: z4.boolean().default(false),
        closedAt: z4.date().nullable(),
      }),
    )

    expect(layers.note).toEqual({ renderer: 'text' })
    expect(layers.retired).toEqual({ renderer: 'switch' })
    expect(layers.closedAt).toEqual({ renderer: 'date', props: { required: true } })
  })

  it('keeps cross-field refine errors on their declared path', () => {
    const schema = z4
      .object({ password: z4.string(), confirmation: z4.string() })
      .refine((value) => value.password === value.confirmation, { message: 'Konfirmasi tidak cocok', path: ['confirmation'] })
    const result = fromZod(schema).validate({ password: 'a', confirmation: 'b' })

    expect(result.success).toBe(false)
    if (!result.success) expect(result.issues).toEqual([{ path: ['confirmation'], message: 'Konfirmasi tidak cocok' }])
  })
})

describe('schema selection', () => {
  const explicit = fromZod(z.object({ source: z.literal('explicit') }))
  const resource = fromZod(z.object({ source: z.literal('resource') }))
  const derived = fromZod(z.object({ source: z.literal('rpc') }))
  const manual = fromZod(z.object({ source: z.literal('manual') }))
  const adapter = { find: (_resource: string, operation: string) => (operation === 'create' ? derived : undefined) }

  it('prefers an explicit component schema', () => {
    expect(
      selectSchema({ explicit, resource, manual, adapter: { adapter, resourceKey: 'users', operation: 'create' } }),
    ).toBe(explicit)
  })

  it('falls back to the resource operation schema', () => {
    expect(selectSchema({ resource, manual, adapter: { adapter, resourceKey: 'users', operation: 'create' } })).toBe(resource)
  })

  it('falls back to the RPC-derived schema', () => {
    expect(selectSchema({ manual, adapter: { adapter, resourceKey: 'users', operation: 'create' } })).toBe(derived)
  })

  it('falls back to a manual schema when no metadata exists', () => {
    expect(selectSchema({ manual, adapter: { adapter, resourceKey: 'users', operation: 'update' } })).toBe(manual)
    expect(selectSchema({ manual })).toBe(manual)
  })

  it('returns undefined when nothing is available', () => {
    expect(selectSchema({})).toBeUndefined()
  })
})

describe('draft validation', () => {
  it('validates the visibility-filtered draft', () => {
    const schema = fromZod(z.object({ mode: z.string(), cause: z.string().optional() }))

    expect(validateDraft({ schema, draft: { mode: 'a' } }).success).toBe(true)
  })

  it('accepts any draft when no schema is available', () => {
    expect(validateDraft({ draft: { anything: true } })).toEqual({ success: true, data: { anything: true } })
  })

  it('diagnoses a schema-required field hidden by behavior', () => {
    const schema = fromZod(z.object({ mode: z.string(), cause: z.string() }))

    expect(() => validateDraft({ schema, draft: { mode: 'a' }, hiddenKeys: ['cause'] })).toThrow(
      'required by the schema but hidden by behavior',
    )
  })

  it('accepts a hidden field the schema treats as optional', () => {
    const schema = fromZod(z.object({ mode: z.string(), cause: z.string().optional() }))

    expect(() => assertNoHiddenRequiredFields(schema, ['cause'])).not.toThrow()
  })

  it('ignores the diagnostic for schemas without key metadata', () => {
    const opaque: ValidationSchema = { validate: () => ({ success: true, data: {} }) }

    expect(() => assertNoHiddenRequiredFields(opaque, ['cause'])).not.toThrow()
  })
})

describe('composed validators', () => {
  it('passes parsed data to ordered async validators and keeps Zod first', async () => {
    const calls: string[] = []
    const result = await validateDraftAsync({
      schema: fromZod(z.object({ name: z.string().transform((value) => value.trim()) })),
      draft: { name: ' Admin ' },
      trigger: 'submit',
      initial: {}, context: {}, signal: new AbortController().signal,
      validators: [
        ({ data }) => { calls.push(data.name); return { path: ['name'], message: 'first' } },
        async () => [{ path: [], message: 'second' }],
      ],
    })
    expect(calls).toEqual(['Admin'])
    expect(result).toMatchObject({ success: false, issues: [{ message: 'first' }, { message: 'second' }] })
  })

  it('does not call custom validators when schema validation fails and normalizes thrown failures', async () => {
    let called = false
    const invalid = await validateDraftAsync({ schema: fromZod(z.object({ name: z.string().min(3) })), draft: { name: 'x' }, trigger: 'submit', initial: {}, context: {}, signal: new AbortController().signal, validators: [() => { called = true }] })
    expect(invalid.success).toBe(false)
    expect(called).toBe(false)
    const operational = await validateDraftAsync({ draft: { name: 'ok' }, trigger: 'submit', initial: {}, context: {}, signal: new AbortController().signal, validators: [() => { throw new Error('offline') }] })
    expect(operational).toMatchObject({ success: false, issues: [{ path: [], message: 'offline', kind: 'operational' }] })
  })
})
