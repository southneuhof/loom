import { defineResource } from '../defineResource'
import type { RawSchema } from '../../contracts/schema'

type Row = { id: string; name: string; status: string }
type Draft = { name: string }
type DetailRecord = Row & { summary: string }

function rawSchema<TInput extends object, TOutput extends object>(): RawSchema<TInput, TOutput> {
  return {
    _input: null as unknown as TInput,
    _output: null as unknown as TOutput,
    parseAsync: async (input: unknown) => input as TOutput,
  }
}

const rowSchema = rawSchema<Row, Row>()
const draftSchema = rawSchema<Draft, Draft>()
const detailSchema = rawSchema<DetailRecord, DetailRecord>()

const rows = defineResource({
  key: 'rows',
  identity: (record: Row) => record.id,
  list: {
    permission: 'rows.list',
    table: {
      schema: rowSchema,
      columns: { name: {} },
      load: async () => ({ data: [{ id: '1', name: 'One', status: 'new' }] }),
    },
  },
  create: {
    permission: 'rows.create',
    visible: ({ access }) => Boolean(access),
    form: {
      schema: draftSchema,
      fields: { name: {} },
      submit: async (output: Draft) => ({ id: '1', ...output, status: 'new' }),
    },
  },
  detail: {
    permission: null,
    detail: ({ id }) => ({
      schema: detailSchema,
      fields: { summary: {} },
      load: async () => ({ id, name: 'One', status: 'new', summary: 'Summary' }),
    }),
  },
  update: {
    permission: 'rows.update',
    form: ({ id }) => ({
      schema: draftSchema,
      fields: { name: {} },
      load: async () => ({ name: `Row ${id}` }),
      submit: async (output: Draft) => ({ id, ...output, status: 'updated' }),
    }),
  },
  delete: {
    permission: 'rows.delete',
    run: async (id) => id,
  },
  actions: {
    verify: {
      permission: ['rows.verify', 'rows.audit'],
      visible: ({ record }) => record?.status === 'new',
      run: async (id: string) => id,
    },
  },
})

const updateOnly = defineResource({
  key: 'update-only',
  identity: (record: Row) => record.id,
  update: {
    permission: null,
    form: ({ id }) => ({
      schema: draftSchema,
      fields: { name: {} },
      load: async () => ({ name: id }),
      submit: async (output: Draft) => ({ id, ...output, status: 'updated' }),
    }),
  },
})

void rows.update({ id: '1' }).form.id
void updateOnly.update({ id: '1' }).form.load({ id: '1' })

const twoArgumentDefinition = {
  key: 'rows',
  identity: (record: Row) => record.id,
}

// @ts-expect-error resources accept one complete definition object
defineResource(twoArgumentDefinition, {})

// @ts-expect-error standard operations do not belong inside custom actions
defineResource({ key: 'invalid-action', identity: (record: Row) => record.id, actions: { list: { permission: null, run: async () => ({ data: [] }) } } })

const listOnly = defineResource({
  key: 'list-only',
  identity: (record: Row) => record.id,
  list: {
    permission: null,
    table: { schema: rowSchema, columns: { name: {} }, load: async () => ({ data: [] as Row[] }) },
  },
})

// @ts-expect-error absent operations do not appear on the bound resource
void listOnly.detail

const badCreateOutput = {
  schema: rawSchema<Draft, Draft>(),
  fields: { name: {} },
  submit: async (output: Draft & { confirmation: string }) => ({ id: '1', ...output, status: 'new' }),
}

// @ts-expect-error create submit input must accept the schema output
defineResource({ key: 'bad-create-output', identity: (record: Row) => record.id, create: { permission: null, form: badCreateOutput } })

const scalarCreateResult = {
  schema: draftSchema,
  fields: { name: {} },
  submit: async (output: Draft) => `saved:${output.name}`,
}

// @ts-expect-error create submit result must include the resource identity record
defineResource({ key: 'scalar-create-result', identity: (record: Row) => record.id, create: { permission: null, form: scalarCreateResult } })

const createWithRecordVisibility = {
  permission: null,
  visible: ({ record }: { record: Row }) => Boolean(record),
  form: {
    schema: draftSchema,
    fields: { name: {} },
    submit: async (output: Draft) => ({ id: '1', ...output, status: 'new' }),
  },
}

// @ts-expect-error create visibility receives the access context only
defineResource({ key: 'record-create-visibility', identity: (record: Row) => record.id, create: createWithRecordVisibility })

const badUpdateOutput = {
  schema: rawSchema<Partial<Draft>, Partial<Draft>>(),
  fields: { name: {} },
  load: async () => ({ name: 'One' }),
  submit: async (output: Partial<Draft> & { confirmation: string }) => ({ id: '1', name: output.name ?? '', status: 'updated' }),
}

// @ts-expect-error update submit input must accept the schema output
defineResource({ key: 'bad-update-output', identity: (record: Row) => record.id, update: { permission: null, form: () => badUpdateOutput } })

const missingDetailDisplayValue = {
  schema: detailSchema,
  fields: { summary: {} },
  load: async () => ({ id: '1', name: 'One', status: 'new' }),
}

// @ts-expect-error detail loader results must include every detail schema output field
defineResource({ key: 'bad-detail-schema', identity: (record: Row) => record.id, detail: { permission: null, detail: () => missingDetailDisplayValue } })

const badListIdentity = {
  schema: rowSchema,
  columns: { name: {} },
  load: async () => ({ data: [{ name: 'One' }] }),
}

// @ts-expect-error list rows must include the identity record
defineResource({ key: 'bad-list-identity', identity: (record: Row) => record.id, list: { permission: null, table: badListIdentity } })

const badDetailIdentity = {
  schema: rowSchema,
  fields: { name: {} },
  load: async () => ({ name: 'One' }),
}

// @ts-expect-error detail rows must include the identity record
defineResource({ key: 'bad-detail-identity', identity: (record: Row) => record.id, detail: { permission: null, detail: () => badDetailIdentity } })
