import { defineResource } from '../defineResource'
import type { CollectionResult, ValidationResult, WebResourceSchema } from '../../contracts'

type Row = { id: string; name: string }
type Query = { search?: string }
type Draft = { name: string }
const validate = <T>(value: unknown): ValidationResult<T> => ({ success: true, data: value as T })
const valid = {
  identity: 'id' as const,
  record: { schema: { validate: validate<Row> } },
  query: { schema: { validate: validate<Query> } },
  create: { schema: { validate: validate<Draft> } },
  update: { schema: { validate: validate<Draft> } },
}
const listRun = async () => ({ data: [] }) satisfies CollectionResult<Row>
const definition = { key: 'identity-rows', actions: { list: { run: listRun } } } as const

// Positive: string identity on a required scalar key; numeric zero is a valid value.
const zeroRow: Row = { id: '0', name: 'Zero' }
void zeroRow
defineResource(valid, definition)
defineResource(valid, { key: 'scalar-id', actions: { detail: { run: async ({ id }) => ({ id: String(id), name: 'One' }) } } })

// Positive: readonly key tuple keeps its literal keys and composite shape.
type Composite = { tenantId: string; userId: number; name: string }
const composite = {
  identity: ['tenantId', 'userId'] as const,
  record: { schema: { validate: validate<Composite> } },
}
defineResource(composite, definition)
const compositeResource = defineResource(composite, {
  key: 'composite-rows',
  actions: { detail: { run: async ({ id }) => ({ tenantId: String(id?.tenantId), userId: Number(id?.userId), name: 'One' }) } },
})
void compositeResource.detail({ id: { tenantId: 't', userId: 7 } }).run()

// Positive: function identity keeps the exact record type and a scalar return.
const withFn = {
  identity: ((record: Row) => record.id) as (record: Row) => string,
  record: { schema: { validate: validate<Row> } },
}
defineResource(withFn, definition)

// Positive: known `id` default applies when `id` is a required scalar.
const defaultId = {
  record: { schema: { validate: validate<Row> } },
}
defineResource(defaultId, definition)

// Positive: explicit type-only schema declarations stay supported.
const typeOnly: WebResourceSchema<Row, Query, Draft, Draft, string> = { identity: 'id' }
defineResource(typeOnly, definition)

// Positive: exact method ID arguments keep their declared scalar and composite shapes.
const methods = defineResource(valid, {
  key: 'method-ids',
  actions: {
    detail: { run: async ({ id }) => ({ id: String(id), name: 'One' }) },
    update: { run: async (id: string, input: Draft) => ({ id, ...input }) },
    delete: { run: async (id: string) => id, permission: 'delete-rows' },
  },
})
void methods.detail({ id: '1' }).run()
void methods.update({ id: '1' }).run({ name: 'Updated' })
void methods.delete({ id: '1' }).run()
void methods.invalidate({ id: '1' })
void methods.invalidate()

// Negative: unknown key.
// @ts-expect-error identity names a record key
defineResource({
  identity: 'missing',
  record: { schema: { validate: validate<Row> } },
}, definition)

// Negative: optional scalar key.
type OptionalId = { id?: string; name: string }
// @ts-expect-error identity keys are required
defineResource({
  identity: 'id',
  record: { schema: { validate: validate<OptionalId> } },
}, definition)

// Negative: nullable scalar key; null is not stripped to fit.
type NullableId = { id: string | null; name: string }
// @ts-expect-error identity values exclude null
defineResource({
  identity: 'id',
  record: { schema: { validate: validate<NullableId> } },
}, definition)

// Negative: boolean key.
type Flagged = { id: string; active: boolean; name: string }
// @ts-expect-error identity values are string or number
defineResource({
  identity: 'active',
  record: { schema: { validate: validate<Flagged> } },
}, definition)

// Negative: array key.
type Tagged = { id: string; tags: string[]; name: string }
// @ts-expect-error identity values exclude arrays
defineResource({
  identity: 'tags',
  record: { schema: { validate: validate<Tagged> } },
}, definition)

// Negative: object key.
type Nested = { id: string; address: { city: string }; name: string }
// @ts-expect-error identity values exclude objects
defineResource({
  identity: 'address',
  record: { schema: { validate: validate<Nested> } },
}, definition)

// Empty key tuple is rejected statically.
// @ts-expect-error identity tuples are nonempty
defineResource({
  identity: [],
  record: { schema: { validate: validate<Row> } },
}, definition)

// Negative: duplicate tuple keys.
// @ts-expect-error identity tuples reject duplicate keys
defineResource({
  identity: ['id', 'id'],
  record: { schema: { validate: validate<Row> } },
}, definition)

// Negative: one tuple member is not a required scalar.
type MixedComposite = { tenantId: string; active: boolean; name: string }
// @ts-expect-error every tuple key is a required scalar
defineResource({
  identity: ['tenantId', 'active'],
  record: { schema: { validate: validate<MixedComposite> } },
}, definition)

// Negative: tuple member names an unknown key.
// @ts-expect-error every tuple key names a record key
defineResource({
  identity: ['id', 'missing'],
  record: { schema: { validate: validate<Row> } },
}, definition)

// Negative: function identity with the wrong record type.
// @ts-expect-error function identities receive the exact record type
defineResource({
  identity: (record: { id: number }) => String(record.id),
  record: { schema: { validate: validate<Row> } },
}, definition)

// Negative: function identity with an unsupported return.
defineResource({
  // @ts-expect-error function identities return a record identity
  identity: (record: Row) => record.name.length > 0,
  record: { schema: { validate: validate<Row> } },
}, definition)

// Negative: known record without a usable `id` default.
type NoId = { name: string }
// @ts-expect-error the id default needs a required scalar id
defineResource({
  record: { schema: { validate: validate<NoId> } },
}, definition)

// Negative: exact detail ID argument keeps the declared scalar.
defineResource(valid, {
  key: 'bad-detail-id',
  // @ts-expect-error detail keeps the declared string identity
  actions: { detail: { run: async ({ id }: { id: number }) => ({ id: String(id), name: 'One' }) } },
})

// Negative: exact delete ID argument keeps the declared scalar.
// @ts-expect-error delete keeps the declared string identity
void methods.delete({ id: 42 }).run()
