import { defineResource } from '../defineResource'
import type { RawSchema } from '../../contracts/schema'

type Row = { id: string; status: string }

function rawSchema<TInput extends object, TOutput extends object>(): RawSchema<TInput, TOutput> {
  return {
    _input: null as unknown as TInput,
    _output: null as unknown as TOutput,
    parseAsync: async (input: unknown) => input as TOutput,
  }
}

const rowSchema = rawSchema<Row, Row>()
const rows = defineResource({
  key: 'custom-policy',
  identity: (record: Row) => record.id,
  list: {
    permission: null,
    table: {
      schema: rowSchema,
      columns: { status: { read: (record: Row) => record.status } },
      load: async () => ({ data: [{ id: '1', status: 'new' }] }),
    },
  },
})

void rows.list.table

const commands = defineResource({
  key: 'custom-policy',
  identity: (record: Row) => record.id,
  actions: {
    set: {
      permission: ['rows.write', 'rows.audit'] as const,
      visible: ({ record }) => record?.status === 'new',
      run: async (id: string, done: boolean) => ({ id, done }),
    },
    verify: {
      permission: (id: string, result: 'approved' | 'rejected') => result === 'approved' ? 'rows.verify' : null,
      run: async (id: string, result: 'approved' | 'rejected') => `${id}:${result}`,
    },
  },
})

void commands.actions.set.route
void commands.actions.set.can('1', true, { record: { id: '1', status: 'new' } })
const allowedRow: Row & { allowedOperations: string[] } = { id: '1', status: 'new', allowedOperations: ['set'] }
void commands.actions.set.run('1', true, { record: allowedRow })
void commands.actions.verify.run('1', 'approved')

// @ts-expect-error custom permission resolvers use the run argument types
defineResource({ key: 'wrong-command-permission-argument', identity: (record: Row) => record.id, actions: { verify: { run: async (id: string) => id, permission: (_id: number) => 'rows.verify' } } })

// @ts-expect-error custom permission resolvers return permission values
defineResource({ key: 'wrong-command-permission-result', identity: (record: Row) => record.id, actions: { verify: { run: async (id: string) => id, permission: (_id: string) => 1 } } })

const listWithUnknownMember = {
  permission: null,
  pageSze: 25,
  table: {
    schema: rowSchema,
    columns: { status: { read: (record: Row) => record.status } },
    load: async () => ({ data: [{ id: '1', status: 'new' }] }),
  },
}

// @ts-expect-error list declarations reject unsupported members
defineResource({ key: 'unknown-list-member', identity: (record: Row) => record.id, list: listWithUnknownMember })

// @ts-expect-error resource declarations reject unsupported members
defineResource({ key: 'unknown-resource-member', identity: (record: Row) => record.id, extra: true })

// @ts-expect-error custom commands require a permission policy
defineResource({ key: 'missing-command-permission', identity: (record: Row) => record.id, actions: { set: { run: async (id: string) => id } } })

// @ts-expect-error custom commands reject unsupported metadata
defineResource({ key: 'extra-command-member', identity: (record: Row) => record.id, actions: { set: { run: async (id: string) => id, permission: 'rows.write', description: 'Set status' } } })

// @ts-expect-error custom permission strings are nonempty
defineResource({ key: 'empty-command-permission', identity: (record: Row) => record.id, actions: { set: { run: async (id: string) => id, permission: '' } } })

// @ts-expect-error standard operations belong at the resource root
defineResource({ key: 'nested-standard-action', identity: (record: Row) => record.id, actions: { list: { run: async () => ({ data: [] }), permission: null } } })
