import { defineResource } from '../defineResource'
import { defineForm } from '../../forms/defineForm'
import { defineTable } from '../../tables/defineTable'
import type { CollectionLoadContext, CollectionResult, DetailFieldContext, FormDraft, FormDraftSnapshot, FormFieldContext, QueryValues, RawSchema, RecordIdentity, RecordLoadContext, TableColumnContext } from '../../contracts'
import type { ListFilters, ListViewProps } from '../../contracts/views'
import type { ListExportOptions } from '../../services/excel'
import type { ResourceCreateDeclaration, ResourceListDeclaration } from '../operations'
import type { FormRendererProps } from '../../renderers/formContracts'

type Row = { id: string; name: string; status: string }
type Draft = { name: string }
type TypedCreateInput = { name: string }
type TypedCreateOutput = { normalizedName: string }
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

type TenantContext = { tenantId: string }
type FilterContext = { organizationId: string }
type ContextFilterInput = { state: string }
type ContextFilterQuery = { status: string }
const contextFilterSchema = rawSchema<ContextFilterInput, Partial<ContextFilterQuery>>()
const contextualResource = defineResource({
  key: 'contextual-resource',
  identity: (record: Row) => record.id,
  list: {
    permission: null,
    table: {
      schema: rowSchema,
      columns: {
        name: ({ context }: { context: TenantContext }) => ({
          read: (record: Row) => `${context.tenantId}:${record.name}`,
        }),
      },
      load: async () => ({ data: [] as Row[] }),
    },
    filters: {
      schema: contextFilterSchema,
      fields: {
        state: ({ context }: { draft: FormDraftSnapshot<ContextFilterInput>; context: FilterContext }) => ({
          renderer: 'text' as const,
          label: context.organizationId,
        }),
      },
      queryKeys: ['status'],
      toDraft: (query: Readonly<QueryValues>) => typeof query.status === 'string' ? { state: query.status } : {},
    },
  },
  create: {
    permission: null,
    form: {
      schema: draftSchema,
      fields: {
        name: ({ context }: { draft: FormDraftSnapshot<Draft>; context: TenantContext }) => ({
          renderer: 'text',
          props: { placeholder: context.tenantId },
        }),
      },
      submit: async (output: Draft) => ({ id: output.name, ...output, status: 'new' }),
    },
  },
  detail: {
    permission: null,
    detail: ({ id }) => ({
      schema: detailSchema,
      fields: {
        summary: ({ record, context }: { record: DetailRecord; context: TenantContext }) => ({
          read: () => `${context.tenantId}:${record.summary}`,
        }),
      },
      load: async () => ({ id, name: 'One', status: 'new', summary: 'Summary' }),
    }),
  },
  update: {
    permission: null,
    form: ({ id }) => ({
      schema: draftSchema,
      fields: {
        name: ({ context }: { draft: FormDraftSnapshot<Draft>; context: TenantContext }) => ({
          renderer: 'text',
          props: { placeholder: context.tenantId },
        }),
      },
      load: async () => ({ name: `Row ${id}` }),
      submit: async (output: Draft) => ({ id, ...output, status: 'updated' }),
    }),
  },
})
contextualResource.list({ context: { tenantId: 'north', organizationId: 'west' }, searchParameters: { active: true } })
contextualResource.create({ context: { tenantId: 'north' }, searchParameters: { active: true } })
contextualResource.detail({ id: '1', context: { tenantId: 'north' }, searchParameters: { version: 2 } })
contextualResource.update({ id: '1', context: { tenantId: 'north' }, searchParameters: { version: 2 }, initialData: { name: 'Draft' } })

// @ts-expect-error Contextual columns and filter fields require their typed binding context.
contextualResource.list()

// @ts-expect-error Contextual form fields require their typed binding context.
contextualResource.create({ context: { tenantId: 7 } })

// @ts-expect-error Contextual detail fields require their typed binding context.
contextualResource.detail({ id: '1' })

// @ts-expect-error Contextual update fields require their typed binding context.
contextualResource.update({ id: '1' })

// @ts-expect-error Binding context must satisfy every configured resolver.
contextualResource.list({ context: { tenantId: 'north' } })

const rowsList = rows.list()
const rowsCreate = rows.create()

type ServerSortQuery = { sort_by?: 'name' | 'id' }
const loadSortedRows = async (_context: CollectionLoadContext<ServerSortQuery>): Promise<CollectionResult<Row>> => ({ data: [] })
const sharedSortableColumns = {
  name: { sortable: true },
  displayName: { read: (record: Row) => record.name, sortKey: 'name', sortable: true },
  id: { sortable: true },
} as const
const sortedRows = defineResource({
  key: 'sorted-rows',
  identity: (record: Row) => record.id,
  list: {
    permission: null,
    table: { schema: rowSchema, columns: { ...sharedSortableColumns }, load: loadSortedRows },
  },
})
const sortedRowsList = sortedRows.list()
type SortedQuery = Parameters<typeof sortedRowsList.table.load>[0]['query']
const sortedQuery: SortedQuery = { sort_by: 'id' }
type SortQueryPreserved = Assert<Equal<SortedQuery, ServerSortQuery>>
const dynamicSortable = Math.random() > 0.5
const booleanSortableRows = defineResource({
  key: 'boolean-sortable-rows',
  identity: (record: Row) => record.id,
  list: {
    permission: null,
    table: {
      schema: rowSchema,
      columns: { name: { sortable: dynamicSortable } },
      load: loadSortedRows,
    },
  },
})
const loadUnboundedRows = async (_context: CollectionLoadContext<Record<string, unknown>>): Promise<CollectionResult<Row>> => ({ data: [] })
const unboundedSortRows = defineResource({
  key: 'unbounded-sort-rows',
  identity: (record: Row) => record.id,
  list: {
    permission: null,
    table: { schema: rowSchema, columns: { name: { sortable: true } }, load: loadUnboundedRows },
  },
})
type NoSortQuery = { page?: number }
const loadUnsortedRows = async (_context: CollectionLoadContext<NoSortQuery>): Promise<CollectionResult<Row>> => ({ data: [] })
const unsortedRows = defineResource({
  key: 'unsorted-rows',
  identity: (record: Row) => record.id,
  list: {
    permission: null,
    table: { schema: rowSchema, columns: { name: {} }, load: loadUnsortedRows },
  },
})

const compactTableWithoutSortable = defineTable({ schema: rowSchema, columns: { name: {} } })
const compactTableWithLiteralFalse = defineTable({ schema: rowSchema, columns: { name: { sortable: false } } })
const optionalSortable: { sortable?: boolean } = {}
const compactTableWithOptionalSortable = defineTable({ schema: rowSchema, columns: { name: optionalSortable } })
const compactTableWithLiteralTrue = defineTable({ schema: rowSchema, columns: { name: { sortable: true } } })
type SortableMemberPreservesAbsence = Assert<Equal<'sortable' extends keyof typeof compactTableWithoutSortable.columns.name ? true : false, false>>
type SortableMemberPreservesFalse = Assert<Equal<typeof compactTableWithLiteralFalse.columns.name.sortable, false>>
type SortableMemberPreservesOptionalBoolean = Assert<Equal<typeof compactTableWithOptionalSortable.columns.name.sortable, boolean | undefined>>
type SortableMemberPreservesTrue = Assert<Equal<typeof compactTableWithLiteralTrue.columns.name.sortable, true>>
const constructorBoundSortedRows = defineResource({
  key: 'constructor-bound-sorted-rows',
  identity: (record: Row) => record.id,
  list: { permission: null, table: { ...compactTableWithLiteralTrue, load: loadSortedRows } },
})
const constructorBoundSortedRowsList = constructorBoundSortedRows.list()
type ConstructorBoundQuery = Parameters<typeof constructorBoundSortedRowsList.table.load>[0]['query']
type ConstructorBoundQueryPreserved = Assert<Equal<ConstructorBoundQuery, ServerSortQuery>>

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
void rowsList.filters?.label
void rowsList.export
void rowsList.createRoute
void rowsCreate.backTo
void rowsCreate.defaultTo
void rows.detail({ id: '1' }).backTo
void rows.detail({ id: '1' }).title
void rows.update({ id: '1' }).backTo

const listLoadResult: Promise<CollectionResult<Row>> = rowsList.table.load({ query: {}, searchParameters: {} })
const createdResult: Promise<{ id: string; name: string; status: 'new' }> = rowsCreate.form.submit({ name: 'Ada' })
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
const boundListIdentity: (record: Row) => RecordIdentity = rowsList.recordIdentity
const customActionResult: Promise<string> = rows.actions.verify.run('1')
const listPermission: 'rows.list' = rows.permissions.list
const createPermission: 'rows.create' = rows.permissions.create
void [sortedRows, booleanSortableRows, unboundedSortRows, unsortedRows, sortedQuery, compactTableWithoutSortable, compactTableWithLiteralFalse, compactTableWithOptionalSortable, compactTableWithLiteralTrue, constructorBoundSortedRows]

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

const compactResourceList = compactResource.list()
const compactResourceCreate = compactResource.create()

type CompactResourceFormSchema = Assert<Equal<typeof compactResourceCreate.form.schema, RawSchema<Draft, Draft>>>
type CompactResourceTableSchema = Assert<Equal<typeof compactResourceList.table.schema, RawSchema<object, Row>>>
const compactDetailPage = compactResource.detail({ id: '1' })
type CompactResourceDetailSchema = Assert<Equal<typeof compactDetailPage.detail.schema, RawSchema<object, DetailRecord>>>
type CompactResourceFormProps = Assert<Equal<NonNullable<typeof compactResourceCreate.form.fields.name.props>, FormRendererProps<'text'>>>
type CompactResourceFieldKeys = Assert<Equal<keyof typeof compactResourceCreate.form.fields, 'name'>>
type CompactResourceFieldRenderer = Assert<Equal<typeof compactResourceCreate.form.fields.name.renderer, 'text'>>
type CompactResourcePageTitle = Assert<Equal<typeof compactResourceList.title, 'Rows'>>
type CompactResourceCreateTitle = Assert<Equal<typeof compactResourceCreate.title, 'Create row'>>
type CompactResourceDetailTitle = Assert<Equal<typeof compactDetailPage.title, 'Detail row'>>
type CompactResourcePermission = Assert<Equal<typeof compactResource.permissions.create, null>>
type CompactListIdentityNotConfigured = Assert<Equal<typeof compactResourceList.recordIdentity, undefined>>
type ResourceListIdentityIsResourceOwned = Assert<Equal<'recordIdentity' extends keyof ResourceListDeclaration ? true : false, false>>
const compactFormResult: Promise<{ id: string; name: string; status: string }> = compactResourceCreate.form.submit({ name: 'Ada' })
const compactDetailLoad: Promise<DetailRecord | undefined> = compactResource.detail({ id: '1' }).detail.load({ id: '1', searchParameters: {} })
const compactAfterSubmit: NonNullable<typeof compactResourceCreate.afterSubmit> = async ({ result }) => {
  const id: string = result.id
  void id
}
const standaloneDelete: ListViewProps<Row> = {
  table: rowsList.table,
  deleteRecord: async (record) => record.id,
  recordIdentity: (record) => record.id,
}
const standaloneDeleteWithoutIdentity = { table: rowsList.table, deleteRecord: async (record: Row) => record.id }
type StandaloneDeleteNeedsIdentity = Assert<Equal<typeof standaloneDeleteWithoutIdentity extends ListViewProps<Row> ? true : false, false>>

// @ts-expect-error Resource output hides the schema implementation detail.
void compactResourceCreate.form.schema.compiler

// @ts-expect-error Resource output hides the table schema implementation detail.
void compactResourceList.table.schema.compiler

// @ts-expect-error Resource output hides the detail schema implementation detail.
void compactResource.detail({ id: '1' }).detail.schema.compiler

// @ts-expect-error Bound submit keeps the complete required schema input.
compactResourceCreate.form.submit({})

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
  queryKeys: ['status'],
  toDraft: (query) => typeof query.status === 'string' ? { status: query.status } : {},
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

const completeViewPropsList = completeViewProps.list()
const completeViewPropsCreate = completeViewProps.create()

void completeViewPropsList.filters?.defaults?.status
void completeViewPropsList.export
void completeViewPropsList.createRoute
void completeViewPropsCreate.form.submitLabel
void completeViewPropsCreate.afterSubmit
void completeViewProps.detail({ id: '1' }).backTo

type CompactListFilterSchema = Assert<Equal<typeof completeViewPropsList.filters.schema, RawSchema<Partial<CompleteFilterInput>, Partial<CompleteFilterInput>>>>
type CompactListFilterKeys = Assert<Equal<keyof typeof completeViewPropsList.filters.fields, 'status'>>
type CompactListFilterRenderer = Assert<Equal<typeof completeViewPropsList.filters.fields.status.renderer, 'text'>>
type CompactListFilterQueryKeys = Assert<Equal<typeof completeViewPropsList.filters.queryKeys, typeof completeFilters.queryKeys>>
type CompactListFilterDraftMapper = Assert<Equal<typeof completeViewPropsList.filters.toDraft, typeof completeFilters.toDraft>>

// @ts-expect-error Resource output hides the list filter schema implementation detail.
void completeViewPropsList.filters.schema.compiler

type FilterQuery = { search?: string }
type FilterInput = { term: string }
const mappedFilters = {
  schema: rawSchema<FilterInput, { search: string }>(),
  fields: { term: { renderer: 'text' } },
  defaults: { term: 'rows' },
  queryKeys: ['search'],
  toDraft: (query) => typeof query.search === 'string' ? { term: query.search } : {},
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
const mappedFiltersResourceList = mappedFiltersResource.list()
void mappedFiltersResourceList.filters?.fields.term
type MappedResourceFilterQueryKeys = Assert<Equal<typeof mappedFiltersResourceList.filters.queryKeys, typeof mappedFilters.queryKeys>>
type MappedResourceFilterDraftMapper = Assert<Equal<typeof mappedFiltersResourceList.filters.toDraft, typeof mappedFilters.toDraft>>
type MappedResourceFilterSchema = Assert<Equal<typeof mappedFiltersResourceList.filters.schema, RawSchema<FilterInput, { search: string }>>>
type MappedResourceFilterFields = Assert<Equal<keyof typeof mappedFiltersResourceList.filters.fields, 'term'>>
type MappedResourceFilterRenderer = Assert<Equal<typeof mappedFiltersResourceList.filters.fields.term.renderer, 'text'>>
type MappedResourceFilterCannotSubmit = Assert<Equal<typeof mappedFiltersResourceList.filters.submit, undefined>>

const typedCreateFormBase = {
  schema: rawSchema<TypedCreateInput, TypedCreateOutput>(),
  fields: { name: { renderer: 'text' as const, props: { placeholder: 'Name' } } },
  submit: async (output: TypedCreateOutput) => ({ id: 'typed-result', name: output.normalizedName, status: 'new' as const }),
}
const typedCreateForm = { ...typedCreateFormBase, fields: { ...typedCreateFormBase.fields } }
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
const typedCreateResourceCreate = typedCreateResource.create()
void typedCreateResourceCreate.afterSubmit
type TypedCreateSchema = Assert<Equal<typeof typedCreateResourceCreate.form.schema, RawSchema<TypedCreateInput, TypedCreateOutput>>>
type TypedCreateFieldKeys = Assert<Equal<keyof typeof typedCreateResourceCreate.form.fields, 'name'>>
type TypedCreateFieldRenderer = Assert<Equal<typeof typedCreateResourceCreate.form.fields.name.renderer, 'text'>>
const typedCreateFieldProps: FormRendererProps<'text'> | undefined = typedCreateResourceCreate.form.fields.name.props
const typedCreateOutput: Promise<{ id: string; name: string; status: 'new' }> = typedCreateResourceCreate.form.submit({ normalizedName: 'Ada' })
type TypedCreateSubmitUsesParsedOutput = Assert<Equal<Parameters<typeof typedCreateResourceCreate.form.submit>[0], TypedCreateOutput>>
type TypedCreateSubmitResultStaysDistinct = Assert<Equal<Awaited<ReturnType<typeof typedCreateResourceCreate.form.submit>>, { id: string; name: string; status: 'new' }>>
const typedCreateWithBindingLoad = typedCreateResource.create({ load: async () => ({ name: 'Prepared at binding' }) })
const typedCreateBoundLoad: ((context: RecordLoadContext) => Promise<FormDraft<TypedCreateInput> | undefined>) | undefined = typedCreateWithBindingLoad.form.load
const typedCreateBoundLoadResult: Promise<FormDraft<TypedCreateInput> | undefined> | undefined = typedCreateWithBindingLoad.form.load?.({
  searchParameters: { source: 'invitation' },
  signal: new AbortController().signal,
})
void [typedCreateBoundLoad, typedCreateBoundLoadResult]

// @ts-expect-error A create loader returns the form input draft, not the parsed output.
typedCreateResource.create({ load: async () => ({ normalizedName: 'Prepared output' }) })

// @ts-expect-error A create loader receives record request parameters, not a custom query context.
typedCreateResource.create({ load: async (context: { query: string }) => ({ name: context.query }) })

const declaredCreateLoadResource = defineResource({
  key: 'declared-create-load',
  identity: (record: { id: string }) => record.id,
  create: {
    permission: null,
    form: {
      schema: rawSchema<TypedCreateInput, TypedCreateOutput>(),
      fields: { name: { renderer: 'text' } },
      load: async () => ({ name: 'Prepared in declaration' }),
      submit: async (output: TypedCreateOutput) => ({ id: 'declared', ...output }),
    },
  },
})
const declaredCreateBoundLoad: (context: RecordLoadContext) => Promise<{ name: string }> = declaredCreateLoadResource.create().form.load
void declaredCreateBoundLoad

type ContextCreateInput = { projectId: string; category: string }
type ProjectCreateContext = { project: string }
type CategoryCreateContext = { category: string }
const contextCreateSchema = rawSchema<ContextCreateInput, ContextCreateInput>()
const contextCreate = defineResource({
  key: 'context-create',
  identity: (record: { id: string }) => record.id,
  create: {
    permission: null,
    form: defineForm({
      schema: contextCreateSchema,
      fields: {
        projectId: ({ context }: FormFieldContext<ContextCreateInput, ProjectCreateContext>) => ({ renderer: 'text', label: context.project }),
        category: ({ context }: FormFieldContext<ContextCreateInput, CategoryCreateContext>) => ({ renderer: 'text', label: context.category }),
      },
      submit: async (output) => ({ id: 'context', ...output }),
    }),
  },
})
contextCreate.create({ context: { project: 'North', category: 'Safety' } })

// @ts-expect-error Create context must satisfy each configured field resolver.
contextCreate.create({ context: { project: 'North' } })

const draftOnlyCreateSchema = rawSchema<{ name: string }, { name: string }>()
const draftOnlyCreate = defineResource({
  key: 'draft-only-create',
  identity: (record: { id: string }) => record.id,
  create: {
    permission: null,
    form: defineForm({
      schema: draftOnlyCreateSchema,
      fields: { name: ({ draft }: FormFieldContext<{ name: string }>) => ({ renderer: 'text', label: draft.name ?? 'Name' }) },
      submit: async (output) => ({ id: 'draft-only', ...output }),
    }),
  },
})
draftOnlyCreate.create()

type AdditionalRecordContext = { organizationId: string }
const combinedReadContextResource = defineResource({
  key: 'combined-read-context',
  identity: (record: Row) => record.id,
  list: {
    permission: null,
    table: {
      schema: rowSchema,
      columns: {
        name: ({ context }: TableColumnContext<TenantContext>) => ({ read: (record: Row) => `${context.tenantId}:${record.name}` }),
        status: { cell: ({ record, context }: { record: Row; context: AdditionalRecordContext }) => ({ read: () => `${context.organizationId}:${record.status}` }) },
      },
      load: async () => ({ data: [] as Row[] }),
    },
  },
  detail: {
    permission: null,
    detail: ({ id }) => ({
      schema: detailSchema,
      fields: {
        name: ({ record, context }: DetailFieldContext<DetailRecord, TenantContext>) => ({ read: () => `${context.tenantId}:${record.name}` }),
        summary: ({ record, context }: DetailFieldContext<DetailRecord, AdditionalRecordContext>) => ({ read: () => `${context.organizationId}:${record.summary}` }),
      },
      load: async () => ({ id, name: 'One', status: 'new', summary: 'Summary' }),
    }),
  },
})
combinedReadContextResource.list({ context: { tenantId: 'north', organizationId: 'west' } })
combinedReadContextResource.detail({ id: '1', context: { tenantId: 'north', organizationId: 'west' } })

// @ts-expect-error Table and row-cell contexts are combined.
combinedReadContextResource.list({ context: { tenantId: 'north' } })

// @ts-expect-error Detail field contexts are combined.
combinedReadContextResource.detail({ id: '1', context: { tenantId: 'north' } })

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
