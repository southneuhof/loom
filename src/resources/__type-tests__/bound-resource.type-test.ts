import { defineResource } from '../defineResource'
import type { CollectionLoadContext, CollectionResult, RawSchema, RecordLoadContext } from '../../contracts'
import type { ListFilters } from '../../contracts/views'
import type { ListExportOptions } from '../../services/excel'
import type { ResourceCreateDeclaration } from '../operations'
import type { FormRendererProps } from '../../renderers/formContracts'

type Row = { id: string; name: string; status: string }
type Draft = { name: string }
type DetailRecord = Row & { summary: string }
type Assert<TValue extends true> = TValue
type Equal<TLeft, TRight> =
  (<T>() => T extends TLeft ? 1 : 2) extends <T>() => T extends TRight ? 1 : 2 ? ((<T>() => T extends TRight ? 1 : 2) extends <T>() => T extends TLeft ? 1 : 2 ? true : false) : false

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
      fields: { name: { renderer: 'text' } },
      submit: async (output: Draft) => ({ id: '1', ...output, status: 'new' as const }),
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
      fields: { name: { renderer: 'text' } },
      load: async () => ({ name: `Row ${id}` }),
      submit: async (output: Draft) => ({ id, ...output, status: 'updated' as const }),
    }),
    title: 'Update row',
    afterSubmit: () => {},
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
      fields: { name: { renderer: 'text' } },
      load: async () => ({ name: id }),
      submit: async (output: Draft) => ({ id, ...output, status: 'updated' }),
    }),
  },
})

void rows.update({ id: '1' }).form.id
void updateOnly.update({ id: '1' }).form.load({ id: '1' })
void rows.list.filters?.label
void rows.list.export
void rows.list.createRoute
void rows.create.backTo
void rows.create.defaultTo
void rows.detail({ id: '1' }).backTo
void rows.detail({ id: '1' }).title
void rows.update({ id: '1' }).backTo

const listLoadResult: Promise<CollectionResult<Row>> = rows.list.table.load({ query: {}, searchParameters: {} })
const createdResult: Promise<{ id: string; name: string; status: 'new' }> = rows.create.form.submit({ name: 'Ada' })
const detailLoad: Promise<DetailRecord | undefined> = rows.detail({ id: '1' }).detail.load({ id: '1', searchParameters: {} })
const updateLoad: (context: RecordLoadContext) => Promise<{ name: string }> = rows.update({ id: '1' }).form.load
const updatedResult: Promise<{ id: string; name: string; status: 'updated' }> = rows.update({ id: '1' }).form.submit({ name: 'Ada' })
const updatePage = rows.update({ id: '1' })
const updateAfterSubmit: NonNullable<typeof updatePage.afterSubmit> = async ({ result }) => {
  const status: 'updated' = result.status
  void status
}
void updateAfterSubmit
const deletedResult: Promise<string> = rows.delete({ id: '1' }).run()
const customActionResult: Promise<string> = rows.actions.verify.run('1')
const listPermission: 'rows.list' = rows.permissions.list
const createPermission: 'rows.create' = rows.permissions.create

const privateRowSchema = { ...rowSchema, compiler: { node: 'internal' as const } }
const privateDraftSchema = { ...draftSchema, compiler: { node: 'internal' as const } }
const privateDetailSchema = { ...detailSchema, compiler: { node: 'internal' as const } }
const compactResource = defineResource({
  key: 'compact-resource',
  identity: (record: Row) => record.id,
  list: {
    permission: 'rows.read',
    title: 'Rows',
    table: {
      schema: privateRowSchema,
      columns: { name: { label: 'Name' } },
      load: async () => ({ data: [{ id: '1', name: 'One', status: 'new' }] }),
    },
  },
  create: {
    permission: null,
    title: 'Create row',
    form: {
      schema: privateDraftSchema,
      fields: { name: { renderer: 'text', props: { placeholder: 'Name' } } },
      submitLabel: 'Create row',
      submit: async (output: Draft) => ({ id: output.name, name: output.name, status: 'new' }),
    },
    afterSubmit: async (context) => {
      void context
    },
  },
  detail: {
    permission: null,
    title: 'Detail row',
    detail: ({ id }) => ({
      schema: privateDetailSchema,
      fields: { summary: {} },
      load: async () => ({ id, name: 'One', status: 'new', summary: 'Summary' }),
    }),
  },
})

type CompactResourceFormSchema = Assert<Equal<typeof compactResource.create.form.schema, RawSchema<Draft, Draft>>>
type CompactResourceTableSchema = Assert<Equal<typeof compactResource.list.table.schema, RawSchema<object, Row>>>
const compactDetailPage = compactResource.detail({ id: '1' })
type CompactResourceDetailSchema = Assert<Equal<typeof compactDetailPage.detail.schema, RawSchema<object, DetailRecord>>>
type CompactResourceFormProps = Assert<Equal<NonNullable<typeof compactResource.create.form.fields.name.props>, FormRendererProps<'text'>>>
type CompactResourceFieldKeys = Assert<Equal<keyof typeof compactResource.create.form.fields, 'name'>>
type CompactResourceFieldRenderer = Assert<Equal<typeof compactResource.create.form.fields.name.renderer, 'text'>>
type CompactResourcePageTitle = Assert<Equal<typeof compactResource.list.title, 'Rows'>>
type CompactResourceCreateTitle = Assert<Equal<typeof compactResource.create.title, 'Create row'>>
type CompactResourceDetailTitle = Assert<Equal<typeof compactDetailPage.title, 'Detail row'>>
type CompactResourcePermission = Assert<Equal<typeof compactResource.permissions.create, null>>
const compactFormResult: Promise<{ id: string; name: string; status: string }> = compactResource.create.form.submit({ name: 'Ada' })
const compactDetailLoad: Promise<DetailRecord | undefined> = compactResource.detail({ id: '1' }).detail.load({ id: '1', searchParameters: {} })
const compactAfterSubmit: NonNullable<typeof compactResource.create.afterSubmit> = async ({ result }) => {
  const id: string = result.id
  void id
}

// @ts-expect-error Resource output hides the schema implementation detail.
void compactResource.create.form.schema.compiler

// @ts-expect-error Resource output hides the table schema implementation detail.
void compactResource.list.table.schema.compiler

// @ts-expect-error Resource output hides the detail schema implementation detail.
void compactResource.detail({ id: '1' }).detail.schema.compiler

// @ts-expect-error Bound submit keeps the complete required schema input.
compactResource.create.form.submit({})

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

type CompleteFilterInput = { status?: string }
const privateFilterSchema = { ...rawSchema<Partial<CompleteFilterInput>, Partial<CompleteFilterInput>>(), compiler: { node: 'internal' as const } }
const completeFilters = {
  schema: privateFilterSchema,
  fields: { status: { renderer: 'text' } },
  defaults: { status: 'active' },
} satisfies ListFilters<CompleteFilterInput>
const completeExport: ListExportOptions<Row> = {
  filename: 'rows',
  sheetName: 'Rows',
  pageSize: 50,
}
const completeViewProps = defineResource({
  key: 'complete-view-props',
  identity: (record: Row) => record.id,
  list: {
    permission: null,
    table: { schema: rowSchema, columns: { name: {} }, load: async () => ({ data: [] as Row[] }) },
    filters: completeFilters,
    export: completeExport,
    createRoute: false,
    detailRoute: false,
    updateRoute: false,
  },
  create: {
    permission: null,
    form: {
      schema: draftSchema,
      fields: { name: { renderer: 'text' } },
      submitLabel: 'Create row',
      submit: async (output: Draft) => ({ id: 'new', ...output, status: 'new' }),
    },
    backTo: false,
    defaultTo: false,
    successMessage: false,
    afterSubmit: async ({ result, defaultTo, navigate, preventDefaultNavigation }) => {
      void result
      void defaultTo
      void navigate
      void preventDefaultNavigation
    },
  },
  detail: {
    permission: null,
    backTo: false,
    detail: ({ id }) => ({ schema: detailSchema, fields: { name: {} }, load: async () => ({ id, name: 'One', status: 'new', summary: 'Summary' }) }),
  },
})

void completeViewProps.list.filters?.defaults?.status
void completeViewProps.list.export
void completeViewProps.list.createRoute
void completeViewProps.create.form.submitLabel
void completeViewProps.create.afterSubmit
void completeViewProps.detail({ id: '1' }).backTo

type CompactListFilterSchema = Assert<Equal<typeof completeViewProps.list.filters.schema, RawSchema<Partial<CompleteFilterInput>, Partial<CompleteFilterInput>>>>
type CompactListFilterKeys = Assert<Equal<keyof typeof completeViewProps.list.filters.fields, 'status'>>
type CompactListFilterRenderer = Assert<Equal<typeof completeViewProps.list.filters.fields.status.renderer, 'text'>>

// @ts-expect-error Resource output hides the list filter schema implementation detail.
void completeViewProps.list.filters.schema.compiler

type FilterQuery = { search?: string }
type FilterInput = { term: string }
const mappedFilters = {
  schema: rawSchema<FilterInput, { search: string }>(),
  fields: { term: { renderer: 'text' } },
  defaults: { term: 'rows' },
} satisfies ListFilters<FilterQuery, FilterInput>
const mappedFiltersResource = defineResource({
  key: 'mapped-filters',
  identity: (record: Row) => record.id,
  list: {
    permission: null,
    table: {
      schema: rowSchema,
      columns: { name: {} },
      load: async (_context: CollectionLoadContext<FilterQuery>) => ({ data: [] as Row[] }),
    },
    filters: mappedFilters,
  },
})
void mappedFiltersResource.list.filters?.fields.term

const typedCreateForm = {
  schema: draftSchema,
  fields: { name: { renderer: 'text' } },
  submit: async (output: Draft) => ({ id: 'typed-result', ...output }),
}
const typedCreateDeclaration = {
  permission: null,
  form: typedCreateForm,
  afterSubmit: async ({ result }) => { void result.id },
} satisfies ResourceCreateDeclaration<typeof typedCreateForm>
const typedCreateResource = defineResource({
  key: 'typed-create-view',
  identity: (record: { id: string }) => record.id,
  create: typedCreateDeclaration,
})
void typedCreateResource.create.afterSubmit

const badCreateOutput = {
  schema: rawSchema<Draft, Draft>(),
  fields: { name: { renderer: 'text' } },
  submit: async (output: Draft & { confirmation: string }) => ({ id: '1', ...output, status: 'new' }),
}

// @ts-expect-error create submit input must accept the schema output
defineResource({ key: 'bad-create-output', identity: (record: Row) => record.id, create: { permission: null, form: badCreateOutput } })

const scalarCreateResult = {
  schema: draftSchema,
  fields: { name: { renderer: 'text' } },
  submit: async (output: Draft) => `saved:${output.name}`,
}

// @ts-expect-error create submit result must include the resource identity record
defineResource({ key: 'scalar-create-result', identity: (record: Row) => record.id, create: { permission: null, form: scalarCreateResult } })

const createWithRecordVisibility = {
  permission: null,
  visible: ({ record }: { record: Row }) => Boolean(record),
  form: {
    schema: draftSchema,
    fields: { name: { renderer: 'text' } },
    submit: async (output: Draft) => ({ id: '1', ...output, status: 'new' }),
  },
}

// @ts-expect-error create visibility receives the access context only
defineResource({ key: 'record-create-visibility', identity: (record: Row) => record.id, create: createWithRecordVisibility })

const badUpdateOutput = {
  schema: rawSchema<Partial<Draft>, Partial<Draft>>(),
  fields: { name: { renderer: 'text' } },
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
