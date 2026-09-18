import { defineFields } from '../../fields/defineFields'
import { defineResource } from '../defineResource'
import type { CollectionResult, ValidationResult } from '../../contracts'

type Row = { id: string; name: string }
type Draft = { name: string }
type Query = { search?: string }
const querySchema = { validate: (value: unknown): ValidationResult<Query> => ({ success: true, data: value as Query }) }
const schema = {
  identity: 'id' as const,
  record: { schema: { validate: (value: unknown): ValidationResult<Row> => ({ success: true, data: value as Row }) } },
  query: { schema: querySchema },
  create: { schema: { validate: (value: unknown): ValidationResult<Draft> => ({ success: true, data: value as Draft }) } },
  update: { schema: { validate: (value: unknown): ValidationResult<Draft> => ({ success: true, data: value as Draft }) } },
}
const fields = defineFields(schema, { name: { label: 'Name', form: { renderer: 'text' } } })

const resource = defineResource(schema, {
  key: 'rows',
  actions: {
    list: { run: async () => ({ data: [] } satisfies CollectionResult<Row>), fields: [fields.name] },
    detail: { run: async ({ id }) => ({ id: String(id), name: 'One' }), fields: [fields.name] },
    create: { run: async (input: Draft) => ({ id: '1', ...input }), fields: [fields.name] },
    update: { run: async (id: string, input: Draft) => ({ id, ...input }), fields: [fields.name] },
    delete: { run: async (id: string) => id, permission: 'delete-rows' },
    verify: { run: async (id: string, result: 'approved' | 'rejected') => `${id}:${result}`, permission: 'verify-rows' },
    udpate: { run: async (id: string, result: 'approved' | 'rejected') => `${id}:${result}`, permission: null },
  },
})

const listRun = async () => ({ data: [] } satisfies CollectionResult<Row>)
const verifyRun = async (id: string, result: 'approved' | 'rejected') => `${id}:${result}`

const validStandard = defineResource(schema, {
  key: 'valid-standard',
  actions: {
    list: { run: listRun, fields: [fields.name] },
    detail: { run: async ({ id }) => ({ id: String(id), name: 'One' }), fields: [fields.name] },
    create: { run: async (input: Draft) => ({ id: '1', ...input }), fields: [fields.name] },
    update: { run: async (id: string, input: Draft) => ({ id, ...input }), fields: [fields.name] },
    delete: { run: async (id: string) => id, permission: 'delete-rows' },
  },
})

const validCustomArray = defineResource(schema, {
  key: 'valid-custom-array',
  actions: {
    verify: { run: verifyRun, permission: ['verify-rows', 'audit-rows'] as const },
  },
})

const validCustomResolver = defineResource(schema, {
  key: 'valid-custom-resolver',
  actions: {
    verify: { run: verifyRun, permission: (id: string, result: 'approved' | 'rejected') => (result === 'approved' ? 'verify-rows' : null) },
  },
})

void [validStandard, validCustomArray, validCustomResolver]

void resource.list().run({ query: {}, searchParameters: {} })
void resource.detail({ id: '1' }).run()
void resource.create().run({ name: 'One' })
void resource.update({ id: '1' }).run({ name: 'Updated' })
void resource.delete({ id: '1' }).run()
void resource.actions.verify.run('1', 'approved')
void resource.actions.verify.can('1', 'approved')
void resource.actions.udpate.run('1', 'rejected')
void resource.actions.udpate.can('1', 'rejected')

async function acceptCustomContext(input: { id: string; result: 'approved' | 'rejected' }) {
  return resource.actions.verify.run(input.id, input.result)
}
void acceptCustomContext

defineResource(schema, {
  key: 'bad-list-permisson',
  // @ts-expect-error list rejects the unknown permisson option
  actions: { list: { run: listRun, permisson: 'rows.list' } },
})

const badListVariable = { run: listRun, permisson: 'rows.list' }
// @ts-expect-error a named standard variable keeps its unknown option invalid
defineResource(schema, { key: 'bad-list-variable', actions: { list: badListVariable } })

// @ts-expect-error a spread keeps the unknown standard option invalid
defineResource(schema, { key: 'bad-list-spread', actions: { list: { run: listRun, ...{ permisson: 'rows.list' } } } })

defineResource(schema, {
  key: 'bad-cross-option',
  // @ts-expect-error create rejects the list-only pageSize option
  actions: { create: { run: async (input: Draft) => ({ id: '1', ...input }), pageSze: 10 } },
})

defineResource(schema, {
  key: 'bad-cross-action-option',
  // @ts-expect-error create rejects the list-only pageSizeOptions option
  actions: { create: { run: async (input: Draft) => ({ id: '1', ...input }), pageSizeOptions: [10] } },
})

defineResource(schema, {
  key: 'bad-top-level',
  actions: { list: { run: listRun } },
  // @ts-expect-error definitions reject an unknown top-level option
  extra: true,
})

defineResource(schema, {
  key: 'bad-custom-extra',
  // @ts-expect-error custom actions reject an extra description property
  actions: { verify: { run: verifyRun, permission: 'verify-rows', description: 'Approve' } },
})

const badCustomVariable = { run: verifyRun, permission: 'verify-rows', description: 'Approve' }
// @ts-expect-error a named custom variable keeps its extra property invalid
defineResource(schema, { key: 'bad-custom-variable', actions: { verify: badCustomVariable } })

defineResource(schema, {
  key: 'bad-custom-missing',
  // @ts-expect-error custom actions require an explicit permission
  actions: { verify: { run: verifyRun } },
})

const badCustomEmpty = ''
defineResource(schema, {
  key: 'bad-custom-empty',
  actions: {
    verify: {
      run: verifyRun,
      // @ts-expect-error custom permission strings are nonempty
      permission: badCustomEmpty,
    },
  },
})

const badCustomEmptyArray = [] as const
defineResource(schema, {
  key: 'bad-custom-empty-array',
  actions: {
    verify: {
      run: verifyRun,
      // @ts-expect-error custom permission arrays are nonempty
      permission: badCustomEmptyArray,
    },
  },
})

const badCustomValue = 42
defineResource(schema, {
  key: 'bad-custom-value',
  actions: {
    verify: {
      run: verifyRun,
      // @ts-expect-error custom permissions use strings, arrays, resolvers, or null
      permission: badCustomValue,
    },
  },
})

const badCustomResolverArgs = (id: number) => 'verify-rows'
defineResource(schema, {
  key: 'bad-custom-resolver-args',
  actions: {
    verify: {
      run: verifyRun,
      // @ts-expect-error custom resolvers use the exact run argument tuple
      permission: badCustomResolverArgs,
    },
  },
})

const badCustomResolverReturn = (_id: string, _result: 'approved' | 'rejected') => 42
defineResource(schema, {
  key: 'bad-custom-resolver-return',
  actions: {
    verify: {
      run: verifyRun,
      // @ts-expect-error custom resolvers return a permission value, not a number
      permission: badCustomResolverReturn,
    },
  },
})

// @ts-expect-error custom run keeps its exact arguments
void resource.actions.verify.run('1', 'missing-result')

// @ts-expect-error custom can keeps the exact run arguments
void resource.actions.verify.can('1', 'missing-result')

// @ts-expect-error create run keeps its declared input shape
void validStandard.create().run({ name: 42 })
