import { defineComponent } from 'vue'
import { z as z3 } from 'zod/v3'
import { z as z4 } from 'zod/v4'
import { defineDetail } from '../../details/defineDetail'
import { defineForm } from '../../forms/defineForm'
import { defineTable } from '../../tables/defineTable'
import type { DetailField } from '../details'
import type { FormDefinition, FormDraft, FormDraftSnapshot, FormFieldContext, FormFieldResolver, FormFields } from '../forms'
import type { RawSchema, RawSchemaInput, RawSchemaOutput } from '../schema'
import type { TableColumn, TableColumnContext } from '../tables'
import type { FormRendererProps } from '../../renderers/formContracts'

const BadgeRenderer = defineComponent({
  props: {
    value: { type: String, required: true },
    tone: { type: String as () => 'muted' | 'strong', required: false },
  },
})
const CaptionRenderer = defineComponent({
  props: {
    value: { type: String, required: true },
    prefix: { type: String, required: true },
  },
})

declare module '../../renderers/displayContracts' {
  interface DisplayRendererComponents {
    badge: typeof BadgeRenderer
    caption: typeof CaptionRenderer
  }
}

type Assert<T extends true> = T
type Equal<TLeft, TRight> =
  (<T>() => T extends TLeft ? 1 : 2) extends <T>() => T extends TRight ? 1 : 2 ? ((<T>() => T extends TRight ? 1 : 2) extends <T>() => T extends TLeft ? 1 : 2 ? true : false) : false
type IsAssignable<TValue, TTarget> = [TValue] extends [TTarget] ? true : false
type DraftMatchesEditableShape = Assert<Equal<FormDraft<{ name: string; age: number }>, { name?: string | null; age?: number | null }>>
const draftShape: DraftMatchesEditableShape = true
type DraftSnapshotsAreDeeplyReadonly = Assert<
  Equal<FormDraftSnapshot<{ profile: { date: Date; tags: string[] } }>, { readonly profile?: { readonly date: Date; readonly tags: readonly string[] } | null }>
>
const readonlyDraftShape: DraftSnapshotsAreDeeplyReadonly = true
type FormArgument<TSchema extends RawSchema<object, object>, TFields extends object> = Parameters<typeof defineForm<TSchema, TFields>>[0]
type TableArgument<TSchema extends RawSchema<object, object>, TColumns extends Record<string, TableColumn<RawSchemaOutput<TSchema>>>> = Parameters<typeof defineTable<TSchema, TColumns>>[0]
type DetailArgument<TSchema extends RawSchema<object, object>, TFields extends Record<string, DetailField<RawSchemaOutput<TSchema>>>> = Parameters<typeof defineDetail<TSchema, TFields>>[0]
const schema3 = z3.object({ name: z3.string() }).transform(({ name }) => ({ length: name.length }))
const input3: RawSchemaInput<typeof schema3> = { name: 'Ada' }
const output3: RawSchemaOutput<typeof schema3> = { length: 3 }
const form3Definition = {
  schema: schema3,
  fields: { name: { renderer: 'text' } },
} as const
const form3 = defineForm({ ...form3Definition, fields: { ...form3Definition.fields }, submit: (output) => String(output.length) })
const reconstructedForm3 = defineForm({ ...form3, fields: { ...form3.fields } })
const submitted3: Promise<string> = Promise.resolve(reconstructedForm3.submit(output3))

const schema4 = z4.object({ amount: z4.string() }).transform(({ amount }) => ({ amount: Number(amount), amountText: amount }))
const input4: RawSchemaInput<typeof schema4> = { amount: '4' }
const output4: RawSchemaOutput<typeof schema4> = { amount: 4, amountText: '4' }
const nullableDraft: FormDraft<{ name: string; age: number }> = { name: null, age: undefined }
const form4 = defineForm({
  schema: schema4,
  fields: { amount: { renderer: 'text', props: { placeholder: 'Amount' } } },
  submit: async (output) => `${output.amount.toFixed(2)} ${output.amountText}`,
})
const submitted4: Promise<string> = Promise.resolve(form4.submit(output4))
const formWithoutSubmit = defineForm({
  schema: z4.object({ name: z4.string(), ignored: z4.string() }).transform(({ name }) => ({ displayName: name })),
  fields: { name: { renderer: 'text' }, ignored: { renderer: 'text' } },
})
type NoSubmitRemainsAbsent = Assert<Equal<typeof formWithoutSubmit.submit, undefined>>
type SubmitResultIsAwaited = Assert<Equal<Awaited<ReturnType<typeof form4.submit>>, string>>

const resolverSchema = z4.object({ name: z4.string(), note: z4.string().optional(), value: z4.string() })
const resolverForm = defineForm({
  schema: resolverSchema,
  fields: {
    name: { renderer: 'text' },
    note: ({ draft }) => {
      const note: string | undefined = draft.note ?? undefined
      // @ts-expect-error A field resolver reads the schema's input type.
      const invalidDraft: number = draft.note
      void [note, invalidDraft]
      return { renderer: 'text', props: { placeholder: draft.name ?? '', maxlength: draft.note?.length ?? 1 } }
    },
    value: ({ draft }) => draft.note
      ? { renderer: 'textarea', props: { rows: 2 } }
      : { renderer: 'text', props: { placeholder: draft.name ?? '' } },
  },
})
type ResolverFormFieldsStaySelected = Assert<Equal<keyof typeof resolverForm.fields, 'name' | 'note' | 'value'>>
type ResolverBranchesKeepTheirRenderer = Assert<Equal<ReturnType<Exclude<typeof resolverForm.fields.value, undefined>>['renderer'], 'text' | 'textarea'>>

// @ts-expect-error A field resolver cannot change a string input to a number input.
defineForm({ schema: z4.object({ value: z4.string() }), fields: { value: () => ({ renderer: 'number' }) } })

// @ts-expect-error A field resolver cannot provide props from another renderer.
defineForm({ schema: z4.object({ value: z4.string() }), fields: { value: () => ({ renderer: 'text', props: { options: [] } }) } })

type WorkspaceContext = { workspaceId: string; scale: number }
const contextualFieldEntries: FormFields<{ amount: number }, 'amount', WorkspaceContext> = {
  amount: () => ({ renderer: 'number', behavior: { derived: ({ context }) => context.scale } }),
}
const annotatedResolverForm = defineForm({
  schema: z4.object({ name: z4.string() }),
  fields: {
    name: ({ context }: FormFieldContext<{ name: string }, WorkspaceContext>) => ({
      renderer: 'text',
      props: { placeholder: context.workspaceId },
    }),
  },
})
type AnnotatedResolverKeepsItsRenderer = Assert<Equal<ReturnType<Exclude<typeof annotatedResolverForm.fields.name, undefined>>['renderer'], 'text'>>

const lookupContextSchema = z4.object({ id: z4.string(), name: z4.string() })
const nestedLookupProps: FormRendererProps<'lookup', WorkspaceContext> = {
  data: [],
  table: {
    schema: lookupContextSchema,
    columns: {
      name: ({ context }) => {
        // @ts-expect-error The framework-inferred workspaceId remains a string.
        const numericWorkspaceId: number = context.workspaceId
        void numericWorkspaceId
        return { read: () => `${context.workspaceId.toUpperCase()}:${context.scale.toFixed(0)}` }
      },
    },
  },
  context: { workspaceId: 'north', scale: 2 },
}
type LookupFieldInput = { ownerId: string }
const contextAwareLookupResolver: FormFieldResolver<LookupFieldInput, string, 'lookup', WorkspaceContext> = ({ context }) => ({
  renderer: 'lookup',
  behavior: { derived: ({ context: derivedContext }) => `${derivedContext.workspaceId.toUpperCase()}:${derivedContext.scale.toFixed(0)}` },
  props: {
    data: [],
    table: {
      schema: lookupContextSchema,
      columns: { name: ({ context: columnContext }) => ({ read: () => `${context.workspaceId.toUpperCase()}:${context.scale.toFixed(0)}:${columnContext.workspaceId.toUpperCase()}:${columnContext.scale.toFixed(0)}` }) },
    },
    context,
  },
})
const contextAwareLookupFields: FormFields<LookupFieldInput, 'ownerId', WorkspaceContext> = { ownerId: contextAwareLookupResolver }

const recordSchema = z4.record(z4.string(), z4.string())
type FormRejectsUnboundedInput = Assert<Equal<IsAssignable<{ schema: typeof recordSchema; fields: {} }, FormArgument<typeof recordSchema, {}>>, false>>
type TableRejectsUnboundedOutput = Assert<Equal<IsAssignable<{ schema: typeof recordSchema; columns: { label: {} } }, TableArgument<typeof recordSchema, { label: {} }>>, false>>

const schemaUser = z4.object({ id: z4.string(), name: z4.string(), amount: z4.number() })
type User = RawSchemaOutput<typeof schemaUser>
const sharedName = {
  read: (record: User) => record.name,
  renderer: 'badge',
  props: { tone: 'strong' },
} as const
const goodTable = defineTable({
  schema: schemaUser,
  columns: {
    name: { sortable: true },
    displayName: { ...sharedName, sortable: true, sortKey: 'name' },
  },
})
const goodDetail = defineDetail({ schema: schemaUser, fields: { displayName: sharedName } })
const displaySchema = z4.object({ name: z4.string(), amount: z4.number() })
type DisplayRecord = RawSchemaOutput<typeof displaySchema>
const resolvedDetail = defineDetail({
  schema: displaySchema,
  fields: {
    name: ({ record }) => {
      // @ts-expect-error Detail resolvers receive the schema output record.
      const invalidRecord: string = record.amount
      void invalidRecord
      return { read: () => record.name, span: 6 }
    },
  },
})
const cellTable = defineTable({
  schema: displaySchema,
  columns: {
    name: { cell: ({ record }) => {
      // @ts-expect-error Cell resolvers receive the schema output record.
      const invalidRecord: string = record.amount
      void invalidRecord
      return { read: () => record.name, format: 'uppercase' }
    } },
  },
})
const resolvedCellTable = defineTable({
  schema: displaySchema,
  columns: {
    name: () => ({ cell: ({ record }) => ({ read: () => record.name }) }),
  },
})
const syntheticCellTable = defineTable({
  schema: displaySchema,
  columns: {
    summary: { cell: ({ record }) => ({ read: () => `${record.name}: ${record.amount}` }) },
  },
})
const displayRecord: DisplayRecord = { name: 'Ada', amount: 1 }
const resolvedDetailValue: string | undefined = resolvedDetail.fields.name({ record: displayRecord, context: {} }).read?.()
const staticCellValue: string | undefined = cellTable.columns.name.cell({ record: displayRecord, context: {} }).read?.()
const resolverCellValue: string | undefined = resolvedCellTable.columns.name().cell({ record: displayRecord, context: {} }).read?.()
const syntheticCellValue: string | undefined = syntheticCellTable.columns.summary.cell({ record: displayRecord, context: {} }).read?.()
type DisplayContext = { workspaceId: string }
const contextualCellTable = defineTable({
  schema: displaySchema,
  columns: {
    name: ({ context }: TableColumnContext<DisplayContext>) => ({
      cell: ({ record, context: cellContext }: { record: DisplayRecord; context: DisplayContext }) => {
        return { read: () => `${context.workspaceId}:${cellContext.workspaceId}:${record.name}` }
      },
    }),
  },
})
const branchedCellTable = defineTable({
  schema: displaySchema,
  columns: {
    name: {
      cell: ({ record }) => record.amount > 0
        ? { read: () => record.name, renderer: 'badge', props: { tone: 'strong' } }
        : { read: () => record.name, renderer: 'caption', props: { prefix: 'Name:' } },
    },
  },
})
type CellRendererBranchesArePreserved = Assert<Equal<ReturnType<Exclude<typeof branchedCellTable.columns.name.cell, undefined>>['renderer'], 'badge' | 'caption'>>
// @ts-expect-error Synthetic cells need a read accessor.
defineTable({ schema: displaySchema, columns: { summary: { cell: { renderer: 'badge', props: { tone: 'strong' } } } } })

// @ts-expect-error A cell cannot mix its configuration with flat display members.
defineTable({ schema: displaySchema, columns: { name: { read: (record) => record.name, cell: { read: (record) => record.name } } } })

// @ts-expect-error Cell renderer props use the selected display renderer contract.
defineTable({ schema: displaySchema, columns: { summary: { cell: { read: (record) => record.name, renderer: 'badge', props: { tone: 'loud' } } } } })

// @ts-expect-error Every cell resolver renderer branch must accept its read value.
defineTable({ schema: displaySchema, columns: { name: { cell: ({ record }) => record.amount > 0
  ? { read: () => record.name, renderer: 'badge', props: { tone: 'strong' } }
  : { read: () => record.amount, renderer: 'badge', props: { tone: 'strong' } } } } })

// @ts-expect-error Every cell resolver renderer branch must satisfy its props contract.
defineTable({ schema: displaySchema, columns: { name: { cell: ({ record }) => record.amount > 0
  ? { read: () => record.name, renderer: 'badge', props: { tone: 'strong' } }
  : { read: () => record.name, renderer: 'badge', props: { tone: 'loud' } } } } })
const sharedFormFields = { name: { renderer: 'text' } } as const
const goodSpreadForm = defineForm({ schema: schemaUser, fields: { ...sharedFormFields } })
const sharedTableColumns = { name: {} } as const
const goodSpreadTable = defineTable({ schema: schemaUser, columns: { ...sharedTableColumns } })
const sharedDetailFields = { name: {} } as const
const goodSpreadDetail = defineDetail({ schema: schemaUser, fields: { ...sharedDetailFields } })

const userRoleReadSchema = z4.object({
  id: z4.string(),
  roleIds: z4.array(z4.string()),
  roles: z4.array(z4.object({ id: z4.string(), name: z4.string() })),
})
type UserRoleReadModel = RawSchemaOutput<typeof userRoleReadSchema>
const roleChoice = { identity: 'id', view: 'name' } as const
const readRoleNames = (record: UserRoleReadModel) => record.roles.map((role) => role[roleChoice.view]).join(', ')
const roleNameDisplay = { read: readRoleNames } as const
const userRoleTable = defineTable({
  schema: userRoleReadSchema,
  columns: { roleIds: roleNameDisplay },
})
const userRoleDetail = defineDetail({
  schema: userRoleReadSchema,
  fields: { roleIds: roleNameDisplay },
})
type SharedTableAndDetailAccessor = Assert<Equal<typeof userRoleTable.columns.roleIds.read, typeof userRoleDetail.fields.roleIds.read>>
const mutableNamedField: { renderer: 'text'; props: { placeholder: string } } = { renderer: 'text', props: { placeholder: 'Name' } }
const readOnlyForm = defineForm({ schema: z4.object({ name: z4.string() }), fields: { name: mutableNamedField } })
type FormMapIsReadonly = Assert<Equal<Pick<typeof readOnlyForm, 'fields'>, Readonly<Pick<typeof readOnlyForm, 'fields'>>>>
type FormEntryIsReadonly = Assert<Equal<Pick<typeof readOnlyForm.fields.name, 'props'>, Readonly<Pick<typeof readOnlyForm.fields.name, 'props'>>>>
type TableMapIsReadonly = Assert<Equal<Pick<typeof goodTable, 'columns'>, Readonly<Pick<typeof goodTable, 'columns'>>>>
type DetailMapIsReadonly = Assert<Equal<Pick<typeof goodDetail, 'fields'>, Readonly<Pick<typeof goodDetail, 'fields'>>>>

const wrongSharedProps = { currency: 7 }
const wrongNumberFragment = { renderer: 'number', props: { ...wrongSharedProps } } as const
const wrongNumberFields = { amount: wrongNumberFragment }
type NamedRendererPropsAreRejected = Assert<Equal<IsAssignable<{ schema: typeof schema4; fields: typeof wrongNumberFields }, FormArgument<typeof schema4, typeof wrongNumberFields>>, false>>

const wrongInferredProps = { currency: 'USD' }
const wrongInferredFragment = { props: wrongInferredProps }
const wrongInferredFields = { name: wrongInferredFragment }
const inferredTextSchema = z4.object({ name: z4.string() })
const removedBehavior = { resetWhen: () => undefined } as const
const removedBehaviorFields = { name: { renderer: 'text', behavior: removedBehavior } } as const
type RemovedBehaviorIsRejected = Assert<
  Equal<IsAssignable<{
    schema: typeof inferredTextSchema
    fields: typeof removedBehaviorFields
  }, FormArgument<typeof inferredTextSchema, typeof removedBehaviorFields>>, false>
>
const removedBehaviorIsRejected: RemovedBehaviorIsRejected = true
type InferredRendererPropsAreRejected = Assert<
  Equal<IsAssignable<{ schema: typeof inferredTextSchema; fields: typeof wrongInferredFields }, FormArgument<typeof inferredTextSchema, typeof wrongInferredFields>>, false>
>

const wrongBadgeValue = { read: (record: User) => record.amount, renderer: 'badge' } as const
const wrongBadgeFields = { amountText: wrongBadgeValue }
type RendererValueIsChecked = Assert<Equal<IsAssignable<{ schema: typeof schemaUser; columns: typeof wrongBadgeFields }, TableArgument<typeof schemaUser, typeof wrongBadgeFields>>, false>>

const wrongBadgeProps = { renderer: 'badge', props: { tone: 'loud' } } as const
type RendererPropsAreChecked = Assert<Equal<IsAssignable<typeof wrongBadgeProps, TableColumn<User>>, false>>

const wrongAccessor = { read: (record: { id: string; missing: boolean }) => record.missing } as const
type AccessorRecordIsChecked = Assert<Equal<IsAssignable<typeof wrongAccessor, TableColumn<User>>, false>>

const missingSortKey = { read: (record: User) => record.name, sortable: true } as const
const missingSortKeyColumns = { displayName: missingSortKey }
type SortableAccessorNeedsKey = Assert<Equal<IsAssignable<{ schema: typeof schemaUser; columns: typeof missingSortKeyColumns }, TableArgument<typeof schemaUser, typeof missingSortKeyColumns>>, false>>

const invalidSortKey = { read: (record: User) => record.name, sortable: true, sortKey: 'missing' } as const
type SortKeyMustBeRecordKey = Assert<Equal<IsAssignable<typeof invalidSortKey, TableColumn<User>>, false>>

const tableOnlyField = { label: 'Name', sortable: true } as const
type DetailRejectsTableMembers = Assert<
  Equal<IsAssignable<{ schema: typeof schemaUser; fields: { name: typeof tableOnlyField } }, DetailArgument<typeof schemaUser, { name: typeof tableOnlyField }>>, false>
>

const tableOnlyInput = { label: 'Name', sortable: true } as const
const tableOnlyFormFields = { name: tableOnlyInput }
type FormRejectsDisplayMembers = Assert<
  Equal<IsAssignable<{ schema: typeof inferredTextSchema; fields: typeof tableOnlyFormFields }, FormArgument<typeof inferredTextSchema, typeof tableOnlyFormFields>>, false>
>

const unsafeSchema = z4.object({ constructor: z4.string() })
const unsafeFields = { constructor: { renderer: 'text' } } as const
type SchemaNamedUnsafeFormKeyIsRejected = Assert<Equal<IsAssignable<{ schema: typeof unsafeSchema; fields: typeof unsafeFields }, FormArgument<typeof unsafeSchema, typeof unsafeFields>>, false>>

type FormContractAcceptsInput3 = Assert<IsAssignable<typeof form3, FormDefinition<RawSchemaInput<typeof schema3>, RawSchemaOutput<typeof schema3>, string>>>

const stringValueSchema = z4.object({ value: z4.string() })
const nullableValueSchema = z4.object({ value: z4.string().nullable() })
const optionalValueSchema = z4.object({ value: z4.string().optional() })
const neverValueSchema = z4.object({ value: z4.never() })
const numberValueSchema = z4.object({ value: z4.number() })
const unknownValueSchema = z4.object({ value: z4.custom<unknown>() })
const mixedValueSchema = z4.object({ value: z4.custom<string | { id: string }>() })

const nullableTextForm = defineForm({ schema: nullableValueSchema, fields: { value: { renderer: 'text' } } })
const optionalNumberForm = defineForm({ schema: z4.object({ value: z4.number().optional() }), fields: { value: { renderer: 'number' } } })

const stringValueTable = defineTable({ schema: stringValueSchema, columns: { value: { renderer: 'badge' } } })
const nullableValueTable = defineTable({ schema: nullableValueSchema, columns: { value: { renderer: 'badge' } } })
const optionalValueDetail = defineDetail({ schema: optionalValueSchema, fields: { value: { renderer: 'badge' } } })
const neverValueDetail = defineDetail({ schema: neverValueSchema, fields: { value: { renderer: 'badge' } } })

// @ts-expect-error Number controls cannot accept string schema input.
const stringNumberForm = defineForm({ schema: stringValueSchema, fields: { value: { renderer: 'number' } } })

// @ts-expect-error A wholly incompatible renderer value must fail.
const numberValueTable = defineTable({ schema: numberValueSchema, columns: { value: { renderer: 'badge' } } })

// @ts-expect-error An unknown value cannot be assigned to a string renderer.
const unknownValueDetail = defineDetail({ schema: unknownValueSchema, fields: { value: { renderer: 'badge' } } })

const mixedValueDisplay = {
  renderer: 'badge',
  read: (record: RawSchemaOutput<typeof mixedValueSchema>) => record.value,
} as const

// @ts-expect-error A valid string branch cannot hide an incompatible object branch.
const mixedValueTable = defineTable({ schema: mixedValueSchema, columns: { value: mixedValueDisplay } })

// @ts-expect-error Detail uses the same whole-union display compatibility check.
const mixedValueDetail = defineDetail({ schema: mixedValueSchema, fields: { value: mixedValueDisplay } })

type FormContractKeysAreSelected = Assert<Equal<keyof typeof readOnlyForm.fields, 'name'>>
type FormRendererCorrelationIsPreserved = Assert<Equal<typeof readOnlyForm.fields.name.renderer, 'text'>>
type TableSelectedKeysArePreserved = Assert<Equal<keyof typeof goodTable.columns, 'name' | 'displayName'>>
type DetailSelectedKeysArePreserved = Assert<Equal<keyof typeof goodDetail.fields, 'displayName'>>
type FormSchemaIsCompact = Assert<Equal<typeof form3.schema, RawSchema<RawSchemaInput<typeof schema3>, RawSchemaOutput<typeof schema3>>>>

const validTextEntry = { renderer: 'text', props: { placeholder: 'Name' } } as const
const invalidTextEntry = { renderer: 'text', props: { options: [{ value: 'ada', label: 'Ada' }] } } as const
const mixedTextEntry = Math.random() > 0.5 ? validTextEntry : invalidTextEntry
const mixedTextFields = { name: mixedTextEntry }
type MixedEntryArgumentRejectsInvalidBranch = Assert<Equal<IsAssignable<{ schema: typeof inferredTextSchema; fields: typeof mixedTextFields }, FormArgument<typeof inferredTextSchema, typeof mixedTextFields>>, false>>

// @ts-expect-error A valid field branch cannot hide invalid renderer props.
defineForm({ schema: inferredTextSchema, fields: mixedTextFields })

const validTextPresentation = { renderer: 'text', props: { placeholder: 'Name' } } as const
const invalidTextPresentation = { renderer: 'text', props: { options: [{ value: 'ada', label: 'Ada' }] } } as const
const mixedTextPresentation = Math.random() > 0.5 ? validTextPresentation : invalidTextPresentation

defineForm({
  schema: z4.object({ name: z4.string() }),
  // @ts-expect-error A valid resolver result cannot hide invalid renderer props.
  fields: { name: () => mixedTextPresentation },
})

void [
  input3,
  submitted3,
  submitted4,
  goodSpreadForm,
  contextualFieldEntries,
  contextAwareLookupFields,
  goodSpreadTable,
  goodSpreadDetail,
  resolvedDetail,
  resolvedDetailValue,
  cellTable,
  staticCellValue,
  resolvedCellTable,
  resolverCellValue,
  syntheticCellTable,
  syntheticCellValue,
  contextualCellTable,
  branchedCellTable,
  readRoleNames,
  nullableDraft,
  draftShape,
  stringValueTable,
  nullableValueTable,
  optionalValueDetail,
  neverValueDetail,
  nullableTextForm,
  optionalNumberForm,
  stringNumberForm,
  numberValueTable,
  unknownValueDetail,
  mixedValueTable,
  mixedValueDetail,
  mixedTextEntry,
  mixedTextPresentation,
  removedBehaviorIsRejected,
]
