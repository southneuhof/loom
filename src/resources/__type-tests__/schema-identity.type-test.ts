import { defineResource } from '../defineResource'
import type { RawSchema } from '../../contracts/schema'

type ScalarRow = { id: string; name: string }
type CompositeRow = { tenantId: string; userId: number; name: string }

function rawSchema<TInput extends object, TOutput extends object>(): RawSchema<TInput, TOutput> {
  return {
    _input: null as unknown as TInput,
    _output: null as unknown as TOutput,
    parseAsync: async (input: unknown) => input as TOutput,
  }
}

const scalarRows = defineResource({
  key: 'scalar-identity',
  identity: (record: ScalarRow) => record.id,
  detail: {
    permission: null,
    detail: ({ id }) => ({
      schema: rawSchema<ScalarRow, ScalarRow>(),
      fields: { name: { read: (record: ScalarRow) => record.name } },
      load: async () => ({ id, name: 'One' }),
    }),
  },
})

const scalarPage = scalarRows.detail({ id: '1' })
void scalarPage.detail.load({ id: '1' })

const compositeRows = defineResource({
  key: 'composite-identity',
  identity: (record: CompositeRow) => ({ tenantId: record.tenantId, userId: record.userId }),
  detail: {
    permission: null,
    detail: ({ id }) => ({
      schema: rawSchema<CompositeRow, CompositeRow>(),
      fields: { name: { read: (record: CompositeRow) => record.name } },
      load: async () => ({ tenantId: id.tenantId, userId: id.userId, name: 'One' }),
    }),
  },
})

const compositePage = compositeRows.detail({ id: { tenantId: 'tenant-a', userId: 7 } })
void compositePage.detail.load({ id: { tenantId: 'tenant-a', userId: 7 } })

// @ts-expect-error composite identities keep every member and value type
compositeRows.detail({ id: { tenantId: 'tenant-a', userId: '7' } })

// @ts-expect-error scalar identities keep their declared type
scalarRows.detail({ id: 7 })

// @ts-expect-error identity must declare a record input
defineResource({ key: 'record-free-identity', identity: () => 'fixed' })
