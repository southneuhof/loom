import { defineComponent } from 'vue'
import { z as z3 } from 'zod/v3'
import { z as z4 } from 'zod/v4'
import { defineDetail } from '../../details/defineDetail'
import { defineForm } from '../../forms/defineForm'
import { defineTable } from '../../tables/defineTable'
import type { DetailField } from '../details'
import type { FormDefinition, FormFields } from '../forms'
import type { RawSchema, RawSchemaInput, RawSchemaOutput } from '../schema'
import type { TableColumn } from '../tables'

const BadgeRenderer = defineComponent({
  props: {
    value: { type: String, required: true },
    tone: { type: String as () => 'muted' | 'strong', required: false },
  },
})

declare module '../../renderers/displayContracts' {
  interface DisplayRendererComponents {
    badge: typeof BadgeRenderer
  }
}

type Assert<T extends true> = T
type Equal<TLeft, TRight> = (<T>() => T extends TLeft ? 1 : 2) extends (<T>() => T extends TRight ? 1 : 2)
  ? (<T>() => T extends TRight ? 1 : 2) extends (<T>() => T extends TLeft ? 1 : 2) ? true : false
  : false
type IsAssignable<TValue, TTarget> = [TValue] extends [TTarget] ? true : false
type FormArgument<TSchema extends RawSchema<object, object>, TFields extends FormFields<RawSchemaInput<TSchema>>> =
  Parameters<typeof defineForm<TSchema, TFields>>[0]
type TableArgument<
  TSchema extends RawSchema<object, object>,
  TColumns extends Record<string, TableColumn<RawSchemaOutput<TSchema>>>,
> = Parameters<typeof defineTable<TSchema, TColumns>>[0]
type DetailArgument<
  TSchema extends RawSchema<object, object>,
  TFields extends Record<string, DetailField<RawSchemaOutput<TSchema>>>,
> = Parameters<typeof defineDetail<TSchema, TFields>>[0]
const schema3 = z3.object({ name: z3.string() }).transform(({ name }) => ({ length: name.length }))
const input3: RawSchemaInput<typeof schema3> = { name: 'Ada' }
const output3: RawSchemaOutput<typeof schema3> = { length: 3 }
const form3 = defineForm({
  schema: schema3,
  fields: { name: {} },
  submit: (output) => String(output.length),
})
const submitted3: Promise<string> = Promise.resolve(form3.submit(output3))

const schema4 = z4.object({ amount: z4.string().transform(Number) })
const input4: RawSchemaInput<typeof schema4> = { amount: '4' }
const output4: RawSchemaOutput<typeof schema4> = { amount: 4 }
const form4 = defineForm({
  schema: schema4,
  fields: { amount: { props: { placeholder: 'Amount' } } },
  submit: async (output) => output.amount.toFixed(2),
})
const submitted4: Promise<string> = Promise.resolve(form4.submit(output4))
const formWithoutSubmit = defineForm({ schema: z4.object({ name: z4.string() }), fields: { name: {} } })
type NoSubmitRemainsAbsent = Assert<Equal<typeof formWithoutSubmit.submit, undefined>>
type SubmitResultIsAwaited = Assert<Equal<Awaited<ReturnType<typeof form4.submit>>, string>>

const recordSchema = z4.record(z4.string(), z4.string())
type FormRejectsUnboundedInput = Assert<Equal<
  IsAssignable<{ schema: typeof recordSchema; fields: {} }, FormArgument<typeof recordSchema, {}>>,
  false
>>
type TableRejectsUnboundedOutput = Assert<Equal<
  IsAssignable<{ schema: typeof recordSchema; columns: { label: {} } }, TableArgument<typeof recordSchema, { label: {} }>>,
  false
>>

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
type SharedTableAndDetailAccessor = Assert<Equal<
  typeof userRoleTable.columns.roleIds.read,
  typeof userRoleDetail.fields.roleIds.read
>>
const mutableNamedField = { props: { placeholder: 'Name' } }
const readOnlyForm = defineForm({ schema: z4.object({ name: z4.string() }), fields: { name: mutableNamedField } })
type FormMapIsReadonly = Assert<Equal<Pick<typeof readOnlyForm, 'fields'>, Readonly<Pick<typeof readOnlyForm, 'fields'>>>>
type FormEntryIsReadonly = Assert<Equal<Pick<typeof readOnlyForm.fields.name, 'props'>, Readonly<Pick<typeof readOnlyForm.fields.name, 'props'>>>>
type TableMapIsReadonly = Assert<Equal<Pick<typeof goodTable, 'columns'>, Readonly<Pick<typeof goodTable, 'columns'>>>>
type DetailMapIsReadonly = Assert<Equal<Pick<typeof goodDetail, 'fields'>, Readonly<Pick<typeof goodDetail, 'fields'>>>>

const wrongSharedProps = { currency: 7 }
const wrongNumberFragment = { renderer: 'number', props: { ...wrongSharedProps } } as const
const wrongNumberFields = { amount: wrongNumberFragment }
type NamedRendererPropsAreRejected = Assert<Equal<
  IsAssignable<{ schema: typeof schema4; fields: typeof wrongNumberFields }, FormArgument<typeof schema4, typeof wrongNumberFields>>,
  false
>>

const wrongInferredProps = { currency: 'USD' }
const wrongInferredFragment = { props: wrongInferredProps }
const wrongInferredFields = { name: wrongInferredFragment }
const inferredTextSchema = z4.object({ name: z4.string() })
type InferredRendererPropsAreRejected = Assert<Equal<
  IsAssignable<{ schema: typeof inferredTextSchema; fields: typeof wrongInferredFields }, FormArgument<typeof inferredTextSchema, typeof wrongInferredFields>>,
  false
>>

const wrongBadgeValue = { read: (record: User) => record.amount, renderer: 'badge' } as const
const wrongBadgeFields = { amountText: wrongBadgeValue }
type RendererValueIsChecked = Assert<Equal<
  IsAssignable<{ schema: typeof schemaUser; columns: typeof wrongBadgeFields }, TableArgument<typeof schemaUser, typeof wrongBadgeFields>>,
  false
>>

const wrongBadgeProps = { renderer: 'badge', props: { tone: 'loud' } } as const
type RendererPropsAreChecked = Assert<Equal<
  IsAssignable<typeof wrongBadgeProps, TableColumn<User>>,
  false
>>

const wrongAccessor = { read: (record: { id: string; missing: boolean }) => record.missing } as const
type AccessorRecordIsChecked = Assert<Equal<
  IsAssignable<typeof wrongAccessor, TableColumn<User>>,
  false
>>

const missingSortKey = { read: (record: User) => record.name, sortable: true } as const
const missingSortKeyColumns = { displayName: missingSortKey }
type SortableAccessorNeedsKey = Assert<Equal<
  IsAssignable<{ schema: typeof schemaUser; columns: typeof missingSortKeyColumns }, TableArgument<typeof schemaUser, typeof missingSortKeyColumns>>,
  false
>>

const invalidSortKey = { read: (record: User) => record.name, sortable: true, sortKey: 'missing' } as const
type SortKeyMustBeRecordKey = Assert<Equal<
  IsAssignable<typeof invalidSortKey, TableColumn<User>>,
  false
>>

const tableOnlyField = { label: 'Name', sortable: true } as const
type DetailRejectsTableMembers = Assert<Equal<
  IsAssignable<{ schema: typeof schemaUser; fields: { name: typeof tableOnlyField } }, DetailArgument<typeof schemaUser, { name: typeof tableOnlyField }>>,
  false
>>

const tableOnlyInput = { label: 'Name', sortable: true } as const
const tableOnlyFormFields = { name: tableOnlyInput }
type FormRejectsDisplayMembers = Assert<Equal<
  IsAssignable<{ schema: typeof inferredTextSchema; fields: typeof tableOnlyFormFields }, FormArgument<typeof inferredTextSchema, typeof tableOnlyFormFields>>,
  false
>>

const unsafeSchema = z4.object({ constructor: z4.string() })
const unsafeFields = { constructor: { renderer: 'text' } } as const
type SchemaNamedUnsafeFormKeyIsRejected = Assert<Equal<
  IsAssignable<{ schema: typeof unsafeSchema; fields: typeof unsafeFields }, FormArgument<typeof unsafeSchema, typeof unsafeFields>>,
  false
>>

type FormContractAcceptsInput3 = Assert<IsAssignable<typeof form3, FormDefinition<RawSchemaInput<typeof schema3>, RawSchemaOutput<typeof schema3>, string>>>
void [input3, submitted3, submitted4, readRoleNames]
