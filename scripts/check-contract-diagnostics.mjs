import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const packageDirectory = dirname(scriptDirectory)
const repositoryDirectory = resolve(packageDirectory, '../..')
const cacheDirectory = join(packageDirectory, 'node_modules/.cache/loom-contract-diagnostics')
const compiler = join(packageDirectory, 'node_modules/.bin/vue-tsc')
const appDirectory = join(repositoryDirectory, 'apps/web')
const appCacheDirectory = join(appDirectory, 'node_modules/.cache/contract-diagnostics')
const appCompiler = join(appDirectory, 'node_modules/.bin/vue-tsc')
const appConfig = join(appDirectory, 'tsconfig.vitest.json')
const moduleSpecifier = (fromDirectory, targetPath) => {
  const path = relative(fromDirectory, targetPath).replaceAll('\\', '/')
  return path.startsWith('.') ? path : `./${path}`
}
const common = (runDirectory) => `import { defineResource } from ${JSON.stringify(relative(runDirectory, join(packageDirectory, 'src/resources/defineResource')).replaceAll('\\', '/'))}
import { defineDetail } from ${JSON.stringify(relative(runDirectory, join(packageDirectory, 'src/details/defineDetail')).replaceAll('\\', '/'))}
import { defineForm } from ${JSON.stringify(relative(runDirectory, join(packageDirectory, 'src/forms/defineForm')).replaceAll('\\', '/'))}
import { defineTable } from ${JSON.stringify(relative(runDirectory, join(packageDirectory, 'src/tables/defineTable')).replaceAll('\\', '/'))}
import type { RawSchema } from ${JSON.stringify(relative(runDirectory, join(packageDirectory, 'src/contracts/schema')).replaceAll('\\', '/'))}
import type { AssetValue } from '@southneuhof/loom/assets'
import type { FileManagerValueAdapter, ManagedAsset } from '@southneuhof/loom/file-manager'
import type { CollectionLoadContext, CollectionProps, CollectionResult, DetailProps, ListViewProps, RecordLoadContext, RecordResult, TableContentProps, TableProps, TreeTableProps } from ${JSON.stringify(relative(runDirectory, join(packageDirectory, 'src/contracts')).replaceAll('\\', '/'))}

type Row = { id: string; name: string }
type Query = { page: number }
type Draft = { name: string }

function rawSchema<TInput extends object, TOutput extends object>(): RawSchema<TInput, TOutput> {
  return {
    _input: null as unknown as TInput,
    _output: null as unknown as TOutput,
    parseAsync: async (input: unknown) => input as TOutput,
  }
}

const rowSchema = rawSchema<Row, Row>()
const draftSchema = rawSchema<Draft, Draft>()
const textValueSchema = rawSchema<{ value: string }, { value: string }>()
const numberValueSchema = rawSchema<{ value: number }, { value: number }>()
const textOrNumberValueSchema = rawSchema<{ value: string | number }, { value: string | number }>()
const assetValueSchema = rawSchema<{ value: AssetValue | null }, { value: AssetValue | null }>()
const assetArraySchema = rawSchema<{ value: AssetValue[] }, { value: AssetValue[] }>()
const assetUnionSchema = rawSchema<{ value: AssetValue | AssetValue[] | null }, { value: AssetValue | AssetValue[] | null }>()
const persistedAsset: AssetValue = { kind: 'file', id: 'uploads/report.pdf', url: 'https://files.test/report.pdf', name: 'report.pdf' }
const managedAsset: ManagedAsset = { kind: 'file', id: persistedAsset.id, name: persistedAsset.name, previewUrl: persistedAsset.url }
const widenedTextareaConstraint: readonly ('number' | 'text')[] = ['number', 'text']
const unionTextareaConstraint: readonly ['number'] | readonly ['text'] = Math.random() > 0.5 ? ['number'] : ['text']
const optionalNumericTextareaProps: { constraint?: readonly ['number'] } = {}
const optionalMultiAssetProps: { multi?: true } = {}
const dynamicMulti: boolean = Math.random() > 0.5
const tableOptions = { schema: rowSchema, columns: { name: {} } }
const detailOptions = { schema: rowSchema, fields: { name: {} } }
const row: Row = { id: '1', name: 'One' }
const rows: Row[] = [row]
const loadRows = async (_context: CollectionLoadContext<Query>): Promise<CollectionResult<Row>> => ({ data: rows })
const loadRow = async (_context: RecordLoadContext): Promise<RecordResult<Row>> => rows[0]
const children = (_record: Row): readonly Row[] => []
const contentProps: TableContentProps<Row, Query> = { ...tableOptions, records: [], loading: false, empty: true, query: { page: 1 } }
void contentProps

function updateSubmitResult(id: string, output: Draft) {
  return { id, ...output }
}
`

const appCommon = (runDirectory) => `import { Hono } from 'hono'
import { hc } from 'hono/client'
import { validator } from 'hono/validator'
import { z } from 'zod/v4'
import { createHonoResourceActions } from ${JSON.stringify(moduleSpecifier(runDirectory, join(appDirectory, 'src/framework/hono/actions')))}
import { collectionQueryFields } from ${JSON.stringify(moduleSpecifier(runDirectory, join(appDirectory, 'src/framework/hono/collectionQuery')))}

type Row = { id: string; name: string }
type Draft = { name: string }
type WireQuery = { page?: string; limit?: string; search?: string; sort?: 'name' | 'email'; order?: 'asc' | 'desc'; active?: 'true' | 'false' }
type Equal<TLeft, TRight> =
  (<T>() => T extends TLeft ? 1 : 2) extends <T>() => T extends TRight ? 1 : 2 ? ((<T>() => T extends TRight ? 1 : 2) extends <T>() => T extends TLeft ? 1 : 2 ? true : false) : false
type Assert<TValue extends true> = TValue

const app = new Hono()
  .post('/entries/create', validator('json', (value) => value as Draft), (context) => context.json({ data: { id: '1', ...context.req.valid('json') } }, 201))
  .get('/records/list', validator('query', (value) => value as WireQuery), (context) => context.json({ data: [{ id: '1', name: 'One' }], total: 1 }))
  .get('/accounts/detail/:id', (context) => context.json({ data: { id: context.req.param('id'), name: 'One' } }))
  .patch('/accounts/update/:id', validator('json', (value) => value as Draft), (context) => context.json({ data: { id: context.req.param('id'), ...context.req.valid('json') } }))
const rpc = hc<typeof app>('https://api.test')
const createRoute = rpc.entries
const listRoute = rpc.records
const detailAndUpdateRoute = rpc.accounts
const querySchema = z.object({
  ...collectionQueryFields,
  sort_by: z.enum(['name', 'email']).optional(),
  active: z.boolean().optional(),
})
const createActions = createHonoResourceActions(createRoute)
const detailAndUpdateActions = createHonoResourceActions(detailAndUpdateRoute)
type CreateInputAcceptsDraft = Assert<Draft extends Parameters<typeof createActions.create>[0] ? true : false>
type CreateInputMatchesEndpoint = Assert<Parameters<typeof createActions.create>[0] extends Draft ? true : false>
type CreateResultIsExact = Assert<Equal<Awaited<ReturnType<typeof createActions.create>>, Row>>
type CreateOperationsAreExact = Assert<Equal<keyof typeof createActions, 'create'>>
type DetailAndUpdateOperationsAreExact = Assert<Equal<keyof typeof detailAndUpdateActions, 'detail' | 'update'>>
type DetailAndUpdateInputAcceptsDraft = Assert<Draft extends Parameters<typeof detailAndUpdateActions.update>[1] ? true : false>
type DetailAndUpdateInputMatchesEndpoint = Assert<Parameters<typeof detailAndUpdateActions.update>[1] extends Draft ? true : false>
const createResult: Promise<Row> = createActions.create({ name: 'One' })
const updateResult: Promise<Row> = detailAndUpdateActions.update('1', { name: 'Two' })
const detailResult: Promise<Row | undefined> = detailAndUpdateActions.detail({ id: '1', searchParameters: {} })
void [createResult, updateResult, detailResult]
`

const appCases = [
  {
    name: 'list-requires-query-schema',
    expectedLocation: 'list factory call without query schema',
    expectedLineOffset: 1,
    expectedTerms: [],
    valid: `const actions = createHonoResourceActions(listRoute, { querySchema })
void actions.list({ query: {}, searchParameters: {} })
`,
    invalid: `createHonoResourceActions(listRoute)
`,
  },
  {
    name: 'non-list-rejects-query-schema',
    expectedLocation: 'create-only factory call with unused query schema',
    expectedLineOffset: 1,
    expectedTerms: [],
    valid: `const actions = createHonoResourceActions(createRoute)
void actions.create({ name: 'One' })
`,
    invalid: `createHonoResourceActions(createRoute, { querySchema })
`,
  },
  {
    name: 'list-rejects-unknown-query-key',
    expectedLocation: 'list factory call with unknown query key',
    expectedLineOffset: 2,
    expectedTerms: [],
    valid: `const validSchema = z.object({ ...collectionQueryFields, sort_by: z.enum(['name', 'email']).optional() })
createHonoResourceActions(listRoute, { querySchema: validSchema })
`,
    invalid: `const invalidSchema = z.object({ ...collectionQueryFields, statusCode: z.string().optional() })
createHonoResourceActions(listRoute, { querySchema: invalidSchema })
`,
  },
  {
    name: 'absent-list-operation-is-not-callable',
    expectedLocation: 'create-only list access',
    expectedLineOffset: 1,
    expectedTerms: ['list'],
    valid: `const actions = createHonoResourceActions(createRoute)
void actions.create({ name: 'One' })
`,
    invalid: `createActions.list({ query: {}, searchParameters: {} })
`,
  },
]

const cases = [
  {
    name: 'file-manager-rejects-string-output',
    expectedLocation: 'FileManagerValueAdapter string output',
    expectedLineOffset: 3,
    expectedTerms: ['AssetValue'],
    valid: `const values: FileManagerValueAdapter = {
  fromModel: (_value: AssetValue) => managedAsset,
  toModel: (_asset: ManagedAsset) => persistedAsset,
}
void values
`,
    invalid: `const values: FileManagerValueAdapter = {
  fromModel: (_value: AssetValue) => managedAsset,
  toModel: (_asset: ManagedAsset) => 'uploads/report.pdf',
}
void values
`,
  },
  {
    name: 'file-manager-rejects-string-input',
    expectedLocation: 'FileManagerValueAdapter string input',
    expectedLineOffset: 2,
    expectedTerms: ['AssetValue'],
    valid: `const values: FileManagerValueAdapter = {
  fromModel: (_value: AssetValue) => managedAsset,
  toModel: (_asset: ManagedAsset) => persistedAsset,
}
void values
`,
    invalid: `const values: FileManagerValueAdapter = {
  fromModel: (_value: string) => managedAsset,
  toModel: (_asset: ManagedAsset) => persistedAsset,
}
void values
`,
  },
  {
    name: 'root-unknown-member',
    expectedLocation: 'root typo member',
    expectedLineOffset: 4,
    expectedTerms: [],
    valid: `const resource = defineResource({
  key: 'root-control',
  identity: (record: Row) => record.id,
})
void resource
`,
    invalid: `const resource = defineResource({
  key: 'root-control',
  identity: (record: Row) => record.id,
  typo: true,
})
void resource
`,
  },
  {
    name: 'create-operation-member',
    expectedLocation: 'create.typo member',
    expectedLineOffset: 7,
    expectedTerms: [],
    valid: `const resource = defineResource({
  key: 'create-control',
  identity: (record: Row) => record.id,
  create: {
    permission: null,
    form: { schema: draftSchema, fields: { name: { renderer: 'text' } }, submit: async (output: Draft) => ({ id: '1', ...output }) },
  },
})
void resource
`,
    invalid: `const resource = defineResource({
  key: 'create-control',
  identity: (record: Row) => record.id,
  create: {
    permission: null,
    form: { schema: draftSchema, fields: { name: { renderer: 'text' } }, submit: async (output: Draft) => ({ id: '1', ...output }) },
    typo: true,
  },
})
void resource
`,
  },
  {
    name: 'list-table-member',
    expectedLocation: 'list.table typo member',
    expectedLineOffset: 10,
    expectedTerms: [],
    valid: `const resource = defineResource({
  key: 'table-control',
  identity: (record: Row) => record.id,
  list: {
    permission: null,
    table: {
      schema: rowSchema,
      columns: { name: { read: (record: Row) => record.name } },
      load: async () => ({ data: [{ id: '1', name: 'One' }] }),
    },
  },
})
void resource
`,
    invalid: `const resource = defineResource({
  key: 'table-control',
  identity: (record: Row) => record.id,
  list: {
    permission: null,
    table: {
      schema: rowSchema,
      columns: { name: { read: (record: Row) => record.name } },
      load: async () => ({ data: [{ id: '1', name: 'One' }] }),
      typo: true,
    },
  },
})
void resource
`,
  },
  {
    name: 'create-form-member',
    expectedLocation: 'create.form typo member',
    expectedLineOffset: 7,
    expectedTerms: ['typo'],
    valid: `const formBase = {
  schema: draftSchema,
  fields: { name: { renderer: 'text' } },
  submit: async (output: Draft) => ({ id: '1', ...output }),
}
const form = { ...formBase }
const resource = defineResource({ key: 'form-control', identity: (record: Row) => record.id, create: { permission: null, form } })
void resource
`,
    invalid: `const formBase = {
  schema: draftSchema,
  fields: { name: { renderer: 'text' } },
  submit: async (output: Draft) => ({ id: '1', ...output }),
}
const form = { ...formBase, typo: true }
const resource = defineResource({ key: 'form-control', identity: (record: Row) => record.id, create: { permission: null, form } })
void resource
`,
  },
  {
    name: 'update-factory-member',
    expectedLocation: 'update.form factory result typo member',
    expectedLineOffset: 6,
    expectedTerms: ['typo'],
    valid: `const resource = defineResource({
  key: 'update-control',
  identity: (record: Row) => record.id,
  update: {
    permission: null,
    form: ({ id }) => ({ schema: draftSchema, fields: { name: { renderer: 'text' } }, load: async () => ({ name: id }), submit: async (output: Draft) => updateSubmitResult(id, output) }),
  },
})
void resource
`,
    invalid: `const resource = defineResource({
  key: 'update-control',
  identity: (record: Row) => record.id,
  update: {
    permission: null,
    form: ({ id }) => ({ schema: draftSchema, fields: { name: { renderer: 'text' } }, load: async () => ({ name: id }), submit: async (output: Draft) => updateSubmitResult(id, output), typo: true }),
  },
})
void resource
`,
  },
  {
    name: 'detail-factory-member',
    expectedLocation: 'detail.detail factory result typo member',
    expectedLineOffset: 6,
    expectedTerms: ['typo'],
    valid: `const resource = defineResource({
  key: 'detail-control',
  identity: (record: Row) => record.id,
  detail: {
    permission: null,
    detail: ({ id }) => ({ schema: rowSchema, fields: { name: { read: (record: Row) => record.name } }, load: async () => ({ id, name: 'One' }) }),
  },
})
void resource
`,
    invalid: `const resource = defineResource({
  key: 'detail-control',
  identity: (record: Row) => record.id,
  detail: {
    permission: null,
    detail: ({ id }) => ({ schema: rowSchema, fields: { name: { read: (record: Row) => record.name } }, load: async () => ({ id, name: 'One' }), typo: true }),
  },
})
void resource
`,
  },
  {
    name: 'reserved-action-sibling',
    expectedLocation: 'actions.list reserved name',
    expectedLineOffset: 6,
    expectedTerms: [],
    valid: `const resource = defineResource({
  key: 'action-control',
  identity: (record: Row) => record.id,
  actions: {
    archive: { permission: null, run: async (id: string) => id },
  },
})
void resource
`,
    invalid: `const resource = defineResource({
  key: 'action-control',
  identity: (record: Row) => record.id,
  actions: {
    archive: { permission: null, run: async (id: string) => id },
    list: { permission: null, run: async () => ({ data: [] }) },
  },
})
void resource
`,
  },
  {
    name: 'permission-callback-contract',
    expectedLocation: 'actions.save permission callback contract',
    expectedLineOffset: 5,
    expectedTerms: ['permission', 'save'],
    valid: `const resource = defineResource({
  key: 'permission-control',
  identity: (record: Row) => record.id,
  actions: {
    save: { permission: (id: string) => id ? 'rows.write' : null, run: async (id: string) => id },
    cancel: { permission: null, run: async (id: string) => id },
  },
})
void resource
`,
    invalid: `const resource = defineResource({
  key: 'permission-control',
  identity: (record: Row) => record.id,
  actions: {
    save: { permission: (id: number) => id ? 'rows.write' : null, run: async (id: string) => id },
    cancel: { permission: null, run: async (id: string) => id },
  },
})
void resource
`,
  },
  {
    name: 'union-permission-callback-contract',
    expectedLocation: 'actions.save union permission callback contract',
    expectedLineOffset: 6,
    expectedTerms: ['permission', 'save'],
    valid: `type PrimarySave = { permission: null; run: (id: string) => Promise<string> }
type AlternateSave = { permission: 'rows.write'; run: (id: string) => Promise<string> }
const saveAction: PrimarySave | AlternateSave = Math.random() > 0.5
  ? { permission: null, run: async (id: string) => id }
  : { permission: 'rows.write', run: async (id: string) => id }
const resource = defineResource({ key: 'union-permission-control', identity: (record: Row) => record.id, actions: { save: saveAction } })
void resource
`,
    invalid: `type PrimarySave = { permission: null; run: (id: string) => Promise<string> }
type AlternateSave = { permission: (id: number) => 'rows.write'; run: (id: string) => Promise<string> }
const saveAction: PrimarySave | AlternateSave = Math.random() > 0.5
  ? { permission: null, run: async (id: string) => id }
  : { permission: (id: number) => 'rows.write', run: async (id: string) => id }
const resource = defineResource({ key: 'union-permission-control', identity: (record: Row) => record.id, actions: { save: saveAction } })
void resource
`,
  },
  {
    name: 'routed-dynamic-action-entry-permission',
    expectedLocation: 'actions.inspect route entry permission',
    expectedLineOffset: 5,
    expectedTerms: ['routePermission'],
    valid: `const resource = defineResource({
  key: 'routed-dynamic-control',
  identity: (record: Row) => record.id,
  actions: {
    inspect: { permission: (id: string) => id ? 'rows.inspect' : null, routePermission: ['rows.enter', 'rows.audit'] as const, route: { name: 'settings-users' }, run: async (id: string) => id },
  },
})
void resource
`,
    invalid: `const resource = defineResource({
  key: 'routed-dynamic-control',
  identity: (record: Row) => record.id,
  actions: {
    inspect: { permission: (id: string) => id ? 'rows.inspect' : null, route: { name: 'settings-users' }, run: async (id: string) => id },
  },
})
void resource
`,
  },
  {
    name: 'static-command-route-permission-override',
    expectedLocation: 'actions.inspect routePermission override',
    expectedLineOffset: 5,
    expectedTerms: ['routePermission', 'inspect'],
    valid: `const resource = defineResource({
  key: 'static-route-control',
  identity: (record: Row) => record.id,
  actions: {
    inspect: { permission: 'rows.inspect', route: { name: 'settings-users' }, run: async (id: string) => id },
  },
})
void resource
`,
    invalid: `const resource = defineResource({
  key: 'static-route-control',
  identity: (record: Row) => record.id,
  actions: {
    inspect: { permission: 'rows.inspect', routePermission: 'rows.enter', route: { name: 'settings-users' }, run: async (id: string) => id },
  },
})
void resource
`,
  },
  {
    name: 'unrouted-command-route-permission',
    expectedLocation: 'actions.inspect routePermission on an unrouted command',
    expectedLineOffset: 5,
    expectedTerms: ['routePermission', 'inspect'],
    valid: `const resource = defineResource({
  key: 'unrouted-control',
  identity: (record: Row) => record.id,
  actions: {
    inspect: { permission: (id: string) => id ? 'rows.inspect' : null, run: async (id: string) => id },
  },
})
void resource
`,
    invalid: `const resource = defineResource({
  key: 'unrouted-control',
  identity: (record: Row) => record.id,
  actions: {
    inspect: { permission: (id: string) => id ? 'rows.inspect' : null, routePermission: 'rows.enter', run: async (id: string) => id },
  },
})
void resource
`,
  },
  {
    name: 'route-permission-requires-nonempty-codes',
    expectedLocation: 'actions.inspect nonempty routePermission',
    expectedLineOffset: 5,
    expectedTerms: ['routePermission'],
    valid: `const resource = defineResource({
  key: 'nonempty-route-control',
  identity: (record: Row) => record.id,
  actions: {
    inspect: { permission: (id: string) => id ? 'rows.inspect' : null, routePermission: ['rows.enter'] as const, route: { name: 'settings-users' }, run: async (id: string) => id },
  },
})
void resource
`,
    invalid: `const resource = defineResource({
  key: 'nonempty-route-control',
  identity: (record: Row) => record.id,
  actions: {
    inspect: { permission: (id: string) => id ? 'rows.inspect' : null, routePermission: [] as const, route: { name: 'settings-users' }, run: async (id: string) => id },
  },
})
void resource
`,
  },
  {
    name: 'create-identity-result',
    expectedLocation: 'create submit result identity requirement',
    expectedLineOffset: 4,
    expectedTerms: ['create', 'submit', 'identity'],
    valid: `const resource = defineResource({
  key: 'identity-result-control',
  identity: (record: Row) => record.id,
  create: { permission: null, form: { schema: draftSchema, fields: { name: { renderer: 'text' } }, submit: async (output: Draft) => ({ id: '1', ...output }) } },
})
void resource
`,
    invalid: `const resource = defineResource({
  key: 'identity-result-control',
  identity: (record: Row) => record.id,
  create: { permission: null, form: { schema: draftSchema, fields: { name: { renderer: 'text' } }, submit: async (output: Draft) => ({ ...output }) } },
})
void resource
`,
  },
  {
    name: 'update-submit-output-compatibility',
    expectedLocation: 'update submit/output compatibility',
    expectedLineOffset: 4,
    expectedTerms: ['update', 'submit', 'output', 'confirmation'],
    valid: `const resource = defineResource({
  key: 'update-output-control',
  identity: (record: Row) => record.id,
  update: { permission: null, form: ({ id }) => ({ schema: draftSchema, fields: { name: { renderer: 'text' } }, load: async () => ({ name: id }), submit: async (output: Draft) => updateSubmitResult(id, output) }) },
})
void resource
`,
    invalid: `const resource = defineResource({
  key: 'update-output-control',
  identity: (record: Row) => record.id,
  update: { permission: null, form: ({ id }) => ({ schema: draftSchema, fields: { name: { renderer: 'text' } }, load: async () => ({ name: id }), submit: async (output: Draft & { confirmation: string }) => updateSubmitResult(id, output) }) },
})
void resource
`,
  },
  {
    name: 'textarea-default-text-model',
    expectedLocation: 'defineForm default textarea model',
    expectedLineOffset: 1,
    expectedTerms: [],
    valid: `defineForm({ schema: textValueSchema, fields: { value: { renderer: 'textarea' } } })
`,
    invalid: `defineForm({ schema: numberValueSchema, fields: { value: { renderer: 'textarea' } } })
`,
  },
  {
    name: 'textarea-number-model',
    expectedLocation: 'defineForm numeric textarea model',
    expectedLineOffset: 1,
    expectedTerms: [],
    valid: `defineForm({ schema: numberValueSchema, fields: { value: { renderer: 'textarea', props: { constraint: ['number'] as const } } } })
`,
    invalid: `defineForm({ schema: textValueSchema, fields: { value: { renderer: 'textarea', props: { constraint: ['number'] as const } } } })
`,
  },
  {
    name: 'textarea-text-model',
    expectedLocation: 'defineForm text textarea model',
    expectedLineOffset: 1,
    expectedTerms: [],
    valid: `defineForm({ schema: textValueSchema, fields: { value: { renderer: 'textarea', props: { constraint: ['text'] as const } } } })
`,
    invalid: `defineForm({ schema: numberValueSchema, fields: { value: { renderer: 'textarea', props: { constraint: ['text'] as const } } } })
`,
  },
  {
    name: 'textarea-widened-model',
    expectedLocation: 'defineForm widened textarea model',
    expectedLineOffset: 1,
    expectedTerms: [],
    valid: `defineForm({ schema: textOrNumberValueSchema, fields: { value: { renderer: 'textarea', props: { constraint: widenedTextareaConstraint } } } })
`,
    invalid: `defineForm({ schema: textValueSchema, fields: { value: { renderer: 'textarea', props: { constraint: widenedTextareaConstraint } } } })
`,
  },
  {
    name: 'textarea-union-model',
    expectedLocation: 'defineForm union textarea model',
    expectedLineOffset: 1,
    expectedTerms: [],
    valid: `defineForm({ schema: textOrNumberValueSchema, fields: { value: { renderer: 'textarea', props: { constraint: unionTextareaConstraint } } } })
`,
    invalid: `defineForm({ schema: textValueSchema, fields: { value: { renderer: 'textarea', props: { constraint: unionTextareaConstraint } } } })
`,
  },
  {
    name: 'textarea-optional-numeric-mode',
    expectedLocation: 'defineForm optional textarea model',
    expectedLineOffset: 1,
    expectedTerms: [],
    valid: `defineForm({ schema: textOrNumberValueSchema, fields: { value: { renderer: 'textarea', props: optionalNumericTextareaProps } } })
`,
    invalid: `defineForm({ schema: textValueSchema, fields: { value: { renderer: 'textarea', props: optionalNumericTextareaProps } } })
`,
  },
  {
    name: 'file-single-cardinality',
    expectedLocation: 'defineForm single FileInput model',
    expectedLineOffset: 1,
    expectedTerms: [],
    valid: `defineForm({ schema: assetValueSchema, fields: { value: { renderer: 'file' } } })
`,
    invalid: `defineForm({ schema: assetArraySchema, fields: { value: { renderer: 'file' } } })
`,
  },
  {
    name: 'file-multi-cardinality',
    expectedLocation: 'defineForm multi FileInput model',
    expectedLineOffset: 1,
    expectedTerms: [],
    valid: `defineForm({ schema: assetArraySchema, fields: { value: { renderer: 'file', props: { multi: true } } } })
`,
    invalid: `defineForm({ schema: assetValueSchema, fields: { value: { renderer: 'file', props: { multi: true } } } })
`,
  },
  {
    name: 'file-dynamic-single-cardinality',
    expectedLocation: 'defineForm dynamic FileInput single model branch',
    expectedLineOffset: 1,
    expectedTerms: [],
    valid: `defineForm({ schema: assetUnionSchema, fields: { value: { renderer: 'file', props: { multi: dynamicMulti } } } })
`,
    invalid: `defineForm({ schema: assetValueSchema, fields: { value: { renderer: 'file', props: { multi: dynamicMulti } } } })
`,
  },
  {
    name: 'file-dynamic-array-cardinality',
    expectedLocation: 'defineForm dynamic FileInput array model branch',
    expectedLineOffset: 1,
    expectedTerms: [],
    valid: `defineForm({ schema: assetUnionSchema, fields: { value: { renderer: 'file', props: { multi: dynamicMulti } } } })
`,
    invalid: `defineForm({ schema: assetArraySchema, fields: { value: { renderer: 'file', props: { multi: dynamicMulti } } } })
`,
  },
  {
    name: 'image-multi-cardinality',
    expectedLocation: 'defineForm multi ImageInput model',
    expectedLineOffset: 1,
    expectedTerms: [],
    valid: `defineForm({ schema: assetArraySchema, fields: { value: { renderer: 'image', props: { multi: true } } } })
`,
    invalid: `defineForm({ schema: assetValueSchema, fields: { value: { renderer: 'image', props: { multi: true } } } })
`,
  },
  {
    name: 'file-optional-multi-mode',
    expectedLocation: 'defineForm optional FileInput model',
    expectedLineOffset: 1,
    expectedTerms: [],
    valid: `defineForm({ schema: assetUnionSchema, fields: { value: { renderer: 'file', props: optionalMultiAssetProps } } })
`,
    invalid: `defineForm({ schema: assetArraySchema, fields: { value: { renderer: 'file', props: optionalMultiAssetProps } } })
`,
  },
]

const surfaceCases = [
  {
    name: 'form-fields-use-schema-input',
    expectedLocation: 'form field absent from schema input',
    expectedLineOffset: 2,
    expectedTerms: [],
    valid: `const sharedFields = { name: { renderer: 'text' } } as const
const form = defineForm({ schema: draftSchema, fields: { ...sharedFields } })
void form
`,
    invalid: `const sharedFields = { name: { renderer: 'text' } } as const
defineForm({ schema: draftSchema, fields: { ...sharedFields, missing: { renderer: 'text' } } })
`,
  },
  {
    name: 'table-columns-use-schema-output',
    expectedLocation: 'table column absent from schema output',
    expectedLineOffset: 2,
    expectedTerms: [],
    valid: `const sharedColumns = { name: {} }
const table = defineTable({ schema: rowSchema, columns: { ...sharedColumns, id: {} } })
void table
`,
    invalid: `const sharedColumns = { name: {} }
defineTable({ schema: rowSchema, columns: { ...sharedColumns, missing: {} } })
`,
  },
  {
    name: 'detail-fields-use-schema-output',
    expectedLocation: 'detail field absent from schema output',
    expectedLineOffset: 2,
    expectedTerms: [],
    valid: `const sharedFields = { name: {} }
const detail = defineDetail({ schema: rowSchema, fields: { ...sharedFields, id: {} } })
void detail
`,
    invalid: `const sharedFields = { name: {} }
defineDetail({ schema: rowSchema, fields: { ...sharedFields, missing: {} } })
`,
  },
  {
    name: 'display-accessor-path-must-exist',
    expectedLocation: 'display accessor reads a missing record property',
    expectedLineOffset: 3,
    expectedTerms: ['missing'],
    valid: `const table = defineTable({
  schema: rowSchema,
  columns: { displayName: { read: (record: Row) => record.name } },
})
void table
`,
    invalid: `defineTable({
  schema: rowSchema,
  columns: { displayName: { read: (record: Row) => record.missing } },
})
`,
  },
  {
    name: 'typed-derived-display-key-needs-read',
    expectedLocation: 'derived display key without an accessor',
    expectedLineOffset: 1,
    expectedTerms: [],
    valid: `const table = defineTable({
  schema: rowSchema,
  columns: { displayName: { read: (record: Row) => record.name.toUpperCase() } },
})
const detail = defineDetail({
  schema: rowSchema,
  fields: { displayName: { read: (record: Row) => record.name.toUpperCase() } },
})
void [table, detail]
`,
    invalid: `defineTable({ schema: rowSchema, columns: { displayName: {} } })
`,
  },
  {
    name: 'collection-both-sources',
    expectedLocation: 'Collection both data and load',
    expectedLineOffset: 1,
    expectedTerms: ['load'],
    valid: `const props: CollectionProps<Row, Query> = { data: [] }
void props
`,
    invalid: `const props: CollectionProps<Row, Query> = { data: [], load: loadRows }
void props
`,
  },
  {
    name: 'collection-missing-source',
    expectedLocation: 'Collection without data or load',
    expectedLineOffset: 1,
    expectedTerms: [],
    valid: `const props: CollectionProps<Row, Query> = { load: loadRows }
void props
`,
    invalid: `const props: CollectionProps<Row, Query> = {}
void props
`,
  },
  {
    name: 'table-both-sources',
    expectedLocation: 'Table both data and load',
    expectedLineOffset: 1,
    expectedTerms: ['load'],
    valid: `const props: TableProps<Row, Query> = { ...tableOptions, data: [] }
void props
`,
    invalid: `const props: TableProps<Row, Query> = { ...tableOptions, data: [], load: loadRows }
void props
`,
  },
  {
    name: 'table-missing-source',
    expectedLocation: 'Table without data or load',
    expectedLineOffset: 1,
    expectedTerms: [],
    valid: `const props: TableProps<Row, Query> = { ...tableOptions, load: loadRows }
void props
`,
    invalid: `const props: TableProps<Row, Query> = { ...tableOptions }
void props
`,
  },
  {
    name: 'tree-table-both-sources',
    expectedLocation: 'TreeTable both data and load',
    expectedLineOffset: 1,
    expectedTerms: ['load'],
    valid: `const props: TreeTableProps<Row, Query> = { ...tableOptions, data: [], children, treeColumn: 'name' }
void props
`,
    invalid: `const props: TreeTableProps<Row, Query> = { ...tableOptions, data: [], load: loadRows, children, treeColumn: 'name' }
void props
`,
  },
  {
    name: 'tree-table-missing-source',
    expectedLocation: 'TreeTable without data or load',
    expectedLineOffset: 1,
    expectedTerms: [],
    valid: `const props: TreeTableProps<Row, Query> = { ...tableOptions, load: loadRows, children, treeColumn: 'name' }
void props
`,
    invalid: `const props: TreeTableProps<Row, Query> = { ...tableOptions, children, treeColumn: 'name' }
void props
`,
  },
  {
    name: 'detail-both-sources',
    expectedLocation: 'Detail both data and load',
    expectedLineOffset: 1,
    expectedTerms: ['load'],
    valid: `const props: DetailProps<Row> = { ...detailOptions, data: row }
void props
`,
    invalid: `const props: DetailProps<Row> = { ...detailOptions, data: row, load: loadRow }
void props
`,
  },
  {
    name: 'detail-missing-source',
    expectedLocation: 'Detail without data or load',
    expectedLineOffset: 1,
    expectedTerms: [],
    valid: `const props: DetailProps<Row> = { ...detailOptions, load: loadRow }
void props
`,
    invalid: `const props: DetailProps<Row> = { ...detailOptions }
void props
`,
  },
  {
    name: 'list-view-delete-needs-identity',
    expectedLocation: 'ListView delete callback identity',
    expectedLineOffset: 1,
    expectedTerms: ['ListViewProps'],
    valid: `const props: ListViewProps<Row> = {
  table: { schema: rowSchema, columns: { name: {} }, data: rows },
  deleteRecord: async (record) => record.id,
  recordIdentity: (record) => record.id,
}
void props
`,
    invalid: `const props: ListViewProps<Row> = {
  table: { schema: rowSchema, columns: { name: {} }, data: rows },
  deleteRecord: async (record) => record.id,
}
void props
`,
  },
]

const vueSurfaceCases = [
  {
    name: 'Collection both data and load',
    template: '<Collection :data="rows" :load="loadRows" />',
    terms: ['load'],
  },
  { name: 'Collection without data or load', template: '<Collection />', terms: [] },
  {
    name: 'Table both data and load',
    template: '<Table :schema="rowSchema" :columns="columns" :data="rows" :load="loadRows" />',
    terms: ['load'],
  },
  {
    name: 'Table without data or load',
    template: '<Table :schema="rowSchema" :columns="columns" />',
    terms: [],
  },
  {
    name: 'TreeTable both data and load',
    template: '<TreeTable :schema="rowSchema" :columns="columns" :data="rows" :load="loadRows" :children="children" tree-column="name" />',
    terms: ['load'],
  },
  {
    name: 'TreeTable without data or load',
    template: '<TreeTable :schema="rowSchema" :columns="columns" :children="children" tree-column="name" />',
    terms: [],
  },
  {
    name: 'Detail both data and load',
    template: '<Detail :schema="rowSchema" :fields="fields" :data="row" :load="loadRow" />',
    terms: ['load'],
  },
  {
    name: 'Detail without data or load',
    template: '<Detail :schema="rowSchema" :fields="fields" />',
    terms: [],
  },
]

function surfaceVueSource(runDirectory, invalid) {
  const componentPath = (name) => JSON.stringify(relative(runDirectory, join(packageDirectory, `src/components/core/${name}.vue`)).replaceAll('\\', '/'))
  const listViewPath = JSON.stringify(relative(runDirectory, join(packageDirectory, 'src/components/views/ListView.vue')).replaceAll('\\', '/'))
  const imports = `import Collection from ${componentPath('Collection')}
import Table from ${componentPath('Table')}
import TreeTable from ${componentPath('TreeTable')}
import Detail from ${componentPath('Detail')}
import TableContent from ${componentPath('TableContent')}
import ListView from ${listViewPath}`
  const script = `<script setup lang="ts">
import type { CollectionLoadContext, CollectionResult, RawSchema, RecordLoadContext, RecordResult } from ${JSON.stringify(relative(runDirectory, join(packageDirectory, 'src/contracts')).replaceAll('\\', '/'))}
${imports}
type Row = { id: string; name: string }
type Query = { page: number }
const row: Row = { id: '1', name: 'One' }
const rows: Row[] = [row]
const rowSchema: RawSchema<Row, Row> = { _input: row, _output: row, parseAsync: async () => row }
const columns = { name: {} }
const fields = { name: {} }
const loadRows = async (_context: CollectionLoadContext<Query>): Promise<CollectionResult<Row>> => ({ data: rows })
const loadRow = async (_context: RecordLoadContext): Promise<RecordResult<Row>> => row
const children = (_record: Row): readonly Row[] => []
const deleteRow = async (_record: Row) => undefined
const recordIdentity = (record: Row) => record.id
</script>
`
  const validTemplate = `<Collection :data="rows" />
<Collection :load="loadRows" />
<Table :schema="rowSchema" :columns="columns" :data="rows" />
<Table :schema="rowSchema" :columns="columns" :load="loadRows" />
<TreeTable :schema="rowSchema" :columns="columns" :data="rows" :children="children" tree-column="name" />
<TreeTable :schema="rowSchema" :columns="columns" :load="loadRows" :children="children" tree-column="name" />
<Detail :schema="rowSchema" :fields="fields" :data="row" />
<Detail :schema="rowSchema" :fields="fields" :load="loadRow" />
<TableContent :schema="rowSchema" :columns="columns" :records="rows" :loading="false" :empty="false" :query="{ page: 1 }" />
<ListView :table="{ schema: rowSchema, columns, data: rows }" :delete-record="deleteRow" :record-identity="recordIdentity" />`
  const template = invalid ? vueSurfaceCases.map((testCase) => testCase.template).join('\n') : validTemplate
  const source = `${script}<template>\n${template}\n</template>\n`
  const expected = invalid
    ? vueSurfaceCases.map((testCase) => ({
        name: testCase.name,
        location: testCase.name,
        line: source.slice(0, source.indexOf(testCase.template)).split('\n').length,
        terms: testCase.terms,
        fixture: 'invalid-surface.vue',
      }))
    : []
  return { source, expected }
}

function runCompiler(projectPath, compilerPath = compiler) {
  const result = spawnSync(compilerPath, ['--pretty', 'false', '--noEmit', '--incremental', 'false', '--noErrorTruncation', '-p', projectPath], {
    cwd: repositoryDirectory,
    encoding: 'utf8',
    timeout: 120_000,
    maxBuffer: 16 * 1024 * 1024,
  })

  if (result.error || result.signal || result.status === null) {
    return {
      ok: false,
      output: [result.error?.message, result.stdout, result.stderr].filter(Boolean).join('\n'),
      diagnostics: [],
    }
  }

  const output = [result.stdout, result.stderr].filter(Boolean).join('\n')
  const diagnostics = []
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^(.+?)\((\d+),(\d+)\): error TS(\d+): (.*)$/)
    if (match)
      diagnostics.push({
        file: match[1],
        line: Number(match[2]),
        code: Number(match[4]),
        message: match[5],
      })
  }

  return { ok: result.status === 0, output, diagnostics }
}

function writeProject(runDirectory, name, files, extendsPath = join(packageDirectory, 'tsconfig.json'), envPaths = [join(packageDirectory, 'env.d.ts')]) {
  const fixturePaths = Object.fromEntries(
    Object.entries(files).map(([sourcePath, source]) => {
      const fixturePath = join(runDirectory, sourcePath)
      writeFileSync(fixturePath, source)
      return [sourcePath, fixturePath]
    })
  )
  const configPath = join(runDirectory, `${name}.json`)
  writeFileSync(
    configPath,
    JSON.stringify({
      extends: extendsPath,
      compilerOptions: { noEmit: true, incremental: false },
      include: [...Object.values(fixturePaths), ...envPaths],
    })
  )
  return { configPath, fixturePaths }
}

function mainLoom() {
  mkdirSync(cacheDirectory, { recursive: true })
  const runDirectory = mkdtempSync(join(cacheDirectory, 'run-'))

  try {
    const prelude = common(runDirectory)
    const allCases = [...cases, ...surfaceCases]
    const validSource = prelude + allCases.map((testCase) => `\n{\n${testCase.valid}}\n`).join('')
    const validSurface = surfaceVueSource(runDirectory, false)
    const valid = writeProject(runDirectory, 'valid', {
      'valid.ts': validSource,
      'valid-surface.vue': validSurface.source,
    })
    const validRun = runCompiler(valid.configPath)
    if (!validRun.ok || validRun.diagnostics.length > 0 || validRun.output.trim().length > 0) {
      process.stderr.write(`Valid Loom contract controls failed to compile.\n${validRun.output}\n`)
      return 1
    }

    let invalidSource = prelude
    const expected = []
    for (const testCase of allCases) {
      const start = invalidSource.length
      invalidSource += `\n{\n${testCase.invalid}}\n`
      const startLine = invalidSource.slice(0, start).split('\n').length
      expected.push({
        name: testCase.name,
        location: testCase.expectedLocation,
        line: startLine + testCase.expectedLineOffset + 1,
        terms: testCase.expectedTerms,
        fixture: 'invalid.ts',
      })
    }

    const invalidSurface = surfaceVueSource(runDirectory, true)
    expected.push(...invalidSurface.expected)
    const invalid = writeProject(runDirectory, 'invalid', {
      'invalid.ts': invalidSource,
      'invalid-surface.vue': invalidSurface.source,
    })
    const invalidRun = runCompiler(invalid.configPath)
    const harnessDiagnostics = invalidRun.diagnostics.filter((diagnostic) => [2307, 2688, 5083, 6053].includes(diagnostic.code))
    const expectedLocations = new Map(
      expected.map((testCase) => [resolve(invalid.fixturePaths[testCase.fixture]), new Set(expected.filter((candidate) => candidate.fixture === testCase.fixture).map((candidate) => candidate.line))])
    )
    const diagnosticFixturePath = (diagnostic) => resolve(repositoryDirectory, diagnostic.file)
    const unexpectedDiagnostics = invalidRun.diagnostics.filter((diagnostic) => !expectedLocations.get(diagnosticFixturePath(diagnostic))?.has(diagnostic.line))
    const failures = []
    if (!invalidRun.ok && invalidRun.diagnostics.length === 0) failures.push('compiler failed without TypeScript diagnostics')
    if (harnessDiagnostics.length > 0) failures.push('compiler reported a missing-module or project-configuration error')
    if (unexpectedDiagnostics.length > 0) failures.push(`${unexpectedDiagnostics.length} diagnostics were outside the expected case locations`)
    for (const testCase of expected) {
      const fixturePath = resolve(invalid.fixturePaths[testCase.fixture])
      const located = invalidRun.diagnostics.filter((diagnostic) => diagnosticFixturePath(diagnostic) === fixturePath && diagnostic.line === testCase.line)
      const meaning = located
        .map((diagnostic) => diagnostic.message)
        .join(' ')
        .toLowerCase()
      const hasTerms = testCase.terms.every((term) => meaning.includes(term.toLowerCase()))
      if (!located.length || !hasTerms) failures.push(`${testCase.name}: no useful diagnostic at ${testCase.location} on line ${testCase.line}`)
    }

    if (failures.length || invalidRun.ok) {
      process.stderr.write(`${failures.length ? failures.join('\n') : 'Invalid Loom contract declarations compiled without errors.'}\n`)
      for (const diagnostic of invalidRun.diagnostics) {
        process.stderr.write(`${diagnostic.file}(${diagnostic.line}): TS${diagnostic.code}: ${diagnostic.message}\n`)
      }
      if (invalidRun.output && !invalidRun.diagnostics.length) process.stderr.write(`${invalidRun.output}\n`)
      return 1
    }

    process.stdout.write(`Contract diagnostics passed for ${cases.length} Loom contract cases, ${surfaceCases.length} TypeScript surface cases, and ${vueSurfaceCases.length} Vue surface cases.\n`)
    return 0
  } finally {
    rmSync(runDirectory, { recursive: true, force: true })
  }
}

function mainApp() {
  mkdirSync(appCacheDirectory, { recursive: true })
  const runDirectory = mkdtempSync(join(appCacheDirectory, 'run-'))

  try {
    const prelude = appCommon(runDirectory)
    const validSource = prelude + appCases.map((testCase) => `\n{\n${testCase.valid}}\n`).join('')
    const appEnvironment = [join(appDirectory, 'env.d.ts'), join(packageDirectory, 'env.d.ts')]
    const valid = writeProject(runDirectory, 'valid', { 'valid.ts': validSource }, appConfig, appEnvironment)
    const validRun = runCompiler(valid.configPath, appCompiler)
    if (!validRun.ok || validRun.diagnostics.length > 0 || validRun.output.trim().length > 0) {
      process.stderr.write(`Valid app transport controls failed to compile.\n${validRun.output}\n`)
      return 1
    }

    let invalidSource = prelude
    const expected = []
    for (const testCase of appCases) {
      const start = invalidSource.length
      invalidSource += `\n{\n${testCase.invalid}}\n`
      const startLine = invalidSource.slice(0, start).split('\n').length
      expected.push({
        name: testCase.name,
        location: testCase.expectedLocation,
        line: startLine + testCase.expectedLineOffset + 1,
        terms: testCase.expectedTerms,
        fixture: 'invalid.ts',
      })
    }

    const invalid = writeProject(runDirectory, 'invalid', { 'invalid.ts': invalidSource }, appConfig, appEnvironment)
    const invalidRun = runCompiler(invalid.configPath, appCompiler)
    const harnessDiagnostics = invalidRun.diagnostics.filter((diagnostic) => [2307, 2688, 5083, 6053].includes(diagnostic.code))
    const fixturePath = resolve(invalid.fixturePaths['invalid.ts'])
    const expectedLines = new Set(expected.map((testCase) => testCase.line))
    const diagnosticFixturePath = (diagnostic) => resolve(repositoryDirectory, diagnostic.file)
    const unexpectedDiagnostics = invalidRun.diagnostics.filter((diagnostic) => diagnosticFixturePath(diagnostic) !== fixturePath || !expectedLines.has(diagnostic.line))
    const failures = []
    if (!invalidRun.ok && invalidRun.diagnostics.length === 0) failures.push('app compiler failed without TypeScript diagnostics')
    if (harnessDiagnostics.length > 0) failures.push('app compiler reported a missing-module or project-configuration error')
    if (unexpectedDiagnostics.length > 0) failures.push(`${unexpectedDiagnostics.length} diagnostics were outside the expected app case locations`)
    for (const testCase of expected) {
      const located = invalidRun.diagnostics.filter((diagnostic) => diagnosticFixturePath(diagnostic) === fixturePath && diagnostic.line === testCase.line)
      const meaning = located
        .map((diagnostic) => diagnostic.message)
        .join(' ')
        .toLowerCase()
      if (!located.length || !testCase.terms.every((term) => meaning.includes(term.toLowerCase())))
        failures.push(`${testCase.name}: no useful diagnostic at ${testCase.location} on line ${testCase.line}`)
    }

    if (failures.length || invalidRun.ok) {
      process.stderr.write(`${failures.length ? failures.join('\n') : 'Invalid app transport calls compiled without errors.'}\n`)
      for (const diagnostic of invalidRun.diagnostics) {
        process.stderr.write(`${diagnostic.file}(${diagnostic.line}): TS${diagnostic.code}: ${diagnostic.message}\n`)
      }
      if (invalidRun.output && !invalidRun.diagnostics.length) process.stderr.write(`${invalidRun.output}\n`)
      return 1
    }

    process.stdout.write(`App transport diagnostics passed for ${appCases.length} cases.\n`)
    return 0
  } finally {
    rmSync(runDirectory, { recursive: true, force: true })
  }
}

function main() {
  const args = process.argv.slice(2)
  if (args.length === 0) return mainLoom()
  if (args.length === 2 && args[0] === '--project' && args[1] === 'app') return mainApp()
  process.stderr.write('Usage: check-contract-diagnostics.mjs [--project app]\n')
  return 2
}

process.exitCode = main()
