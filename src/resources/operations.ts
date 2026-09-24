import type { AccessAdapter, CollectionLoadContext, CollectionResult, DetailProps, FormProps, MaybePromise, RecordIdentity, RecordLoadContext, ResourceOperation, TableProps } from '../contracts'
import type { RawSchema, RawSchemaOutput } from '../contracts/schema'
import type { RouteLocationRaw, RouteMap } from 'vue-router'

type RouteRawParams<TName extends keyof RouteMap> = RouteMap[TName]['paramsRaw']
type RouteParamKeys<TName extends keyof RouteMap> = keyof RouteRawParams<TName>
type RequiredRouteParamKeys<TName extends keyof RouteMap> = {
  [TKey in RouteParamKeys<TName>]-?: undefined extends RouteRawParams<TName>[TKey] ? never : TKey
}[RouteParamKeys<TName>]
type OptionalRouteParamKeys<TName extends keyof RouteMap> = Exclude<RouteParamKeys<TName>, RequiredRouteParamKeys<TName>>
type RouteParamValue<TValue> = TValue extends (infer TItem)[] ? TValue | readonly TItem[] : TValue

export type ResourceRouteParams<TName extends keyof RouteMap> = {
  [TKey in RequiredRouteParamKeys<TName>]-?: RouteParamValue<RouteRawParams<TName>[TKey]>
} & {
  [TKey in OptionalRouteParamKeys<TName>]?: RouteParamValue<RouteRawParams<TName>[TKey]>
}

type RouteName = Extract<keyof RouteMap, string>
type ResourceRouteLocation<TName extends RouteName, TIdentity extends RecordIdentity, TParams = ResourceRouteParams<TName>> =
  [RequiredRouteParamKeys<TName>] extends [never]
    ? { name: TName; params?: TParams | ((id: TIdentity) => TParams) }
    : { name: TName; params: TParams | ((id: TIdentity) => TParams) }
type ResourceStaticRouteLocation<TName extends RouteName, TParams = ResourceRouteParams<TName>> =
  [RequiredRouteParamKeys<TName>] extends [never]
    ? { name: TName; params?: TParams }
    : { name: TName; params: TParams }

export type ResourceRoute<TIdentity extends RecordIdentity = RecordIdentity> = {
  [TName in RouteName]: ResourceRouteLocation<TName, TIdentity>
}[RouteName]

export type ResourceStaticRoute = {
  [TName in RouteName]: ResourceStaticRouteLocation<TName>
}[RouteName]

export interface ResourceBinding<TIdentity extends RecordIdentity, TRecord extends object> {
  id: TIdentity
  record?: TRecord
}

export type ResourceIdentityFunction = (...args: never[]) => RecordIdentity

export type ResourceIdentityValue<TIdentityFunction extends ResourceIdentityFunction> = ReturnType<TIdentityFunction>

type IdentityFunctionGuard<TIdentityFunction extends ResourceIdentityFunction> = Parameters<TIdentityFunction> extends [infer TRecord]
  ? [TRecord] extends [never]
    ? never
    : TRecord extends object ? unknown : never
  : never

export interface ResourceVisibility<TRecord extends object = Record<string, unknown>> {
  visible?: (context: { record?: TRecord; access: AccessAdapter }) => boolean
}

export interface ResourceListTable<TRecord extends object = object, TQuery extends object = object> extends Omit<TableProps<TRecord, TQuery>, 'data' | 'resource'> {
  data?: never
  resource?: never
  load: (context: CollectionLoadContext<TQuery>) => MaybePromise<CollectionResult<TRecord>>
}

export interface ResourceFormBag<TInput extends object = object, TOutput extends object = object, TResult = unknown> extends Omit<FormProps<TInput, TOutput, TResult>, 'modelValue' | 'load' | 'id' | 'resource'> {
  modelValue?: never
  id?: never
  resource?: never
  load?: (context: RecordLoadContext) => MaybePromise<Partial<TInput> | undefined>
  submit: (output: TOutput) => MaybePromise<TResult>
}

export interface ResourceDetailBag<TRecord extends object = object> extends Omit<DetailProps<TRecord>, 'data' | 'id' | 'resource'> {
  data?: never
  id?: never
  resource?: never
  load: (context: RecordLoadContext) => MaybePromise<TRecord | undefined>
}

export type ResourceCustomPermission<TRun extends (...args: never[]) => unknown> =
  | string
  | readonly string[]
  | ((...args: Parameters<TRun>) => string | readonly string[] | null)
  | null

export interface ResourceCustomCommand<TRun extends (...args: never[]) => unknown = (...args: never[]) => unknown, TIdentity extends RecordIdentity = RecordIdentity> {
  run: TRun
  permission: ResourceCustomPermission<TRun>
  visible?: (context: { record?: Record<string, unknown>; access: AccessAdapter }) => boolean
  route?: ResourceRoute<TIdentity>
}

export type ResourceCustomContext<TRecord extends object = Record<string, unknown>> = {
  record?: TRecord
}

export type ResourceCustomHandle<TRun extends (...args: never[]) => unknown, TIdentity extends RecordIdentity, TRecord extends object> = {
  can: (...args: [...Parameters<TRun>, context?: ResourceCustomContext<TRecord>]) => boolean
  run: (...args: [...Parameters<TRun>, context?: ResourceCustomContext<TRecord>]) => Promise<Awaited<ReturnType<TRun>>>
  route?: ResourceRoute<TIdentity>
}

type TableRecord<TTable> = TTable extends { schema: RawSchema<unknown, infer TRecord> }
  ? TRecord extends object ? TRecord : never
  : never

type ListTableShape = {
  schema: RawSchema
  columns: Readonly<Record<string, unknown>>
  load: (...args: never[]) => unknown
  data?: never
  resource?: never
  namespace?: string
}

type FormBagShape = {
  schema: RawSchema
  fields: object
  submit: (...args: never[]) => unknown
  load?: (context: RecordLoadContext) => unknown
  modelValue?: never
  id?: never
  resource?: never
  namespace?: string
}

type UpdateFormBagShape = FormBagShape & {
  load: (context: RecordLoadContext) => unknown
}

type DetailBagShape = {
  schema: RawSchema
  fields: object
  load: (context: RecordLoadContext) => unknown
  data?: never
  id?: never
  resource?: never
  namespace?: string
}

export type ResourceListDeclaration<TTable extends ListTableShape = ListTableShape> = {
  permission: string | null
  route?: ResourceStaticRoute
  title?: string
  description?: string
  visible?: (context: { access: AccessAdapter }) => boolean
  table: TTable
}

export type ResourceCreateDeclaration<TForm extends FormBagShape = FormBagShape> = {
  permission: string | null
  route?: ResourceStaticRoute
  title?: string
  description?: string
  visible?: (context: { access: AccessAdapter }) => boolean
  defaultTo?: RouteLocationRaw | ((result: FormSubmitResult<TForm>) => RouteLocationRaw | undefined) | false
  successMessage?: string | false
  form: TForm
}

export type ResourceDetailDeclaration<TIdentity extends RecordIdentity, TIdentityRecord extends object, TFactory extends (binding: ResourceBinding<TIdentity, TIdentityRecord>) => DetailBagShape = (binding: ResourceBinding<TIdentity, TIdentityRecord>) => DetailBagShape> = ResourceVisibility<TIdentityRecord> & {
  permission: string | null
  route?: ResourceRoute<TIdentity>
  title?: string
  backTo?: RouteLocationRaw
  detail: TFactory
}

export type ResourceUpdateDeclaration<TIdentity extends RecordIdentity, TIdentityRecord extends object, TFactory extends (binding: ResourceBinding<TIdentity, TIdentityRecord>) => UpdateFormBagShape = (binding: ResourceBinding<TIdentity, TIdentityRecord>) => UpdateFormBagShape> = ResourceVisibility<TIdentityRecord> & {
  permission: string | null
  route?: ResourceRoute<TIdentity>
  title?: string
  description?: string
  defaultTo?: RouteLocationRaw | ((result: FormSubmitResult<ReturnType<TFactory>>) => RouteLocationRaw | undefined) | false
  successMessage?: string | false
  form: TFactory
}

export type ResourceDeleteDeclaration<TIdentity extends RecordIdentity, TIdentityRecord extends object> = ResourceVisibility<TIdentityRecord> & {
  permission: string | null
  route?: ResourceRoute<TIdentity>
  run: (id: TIdentity) => MaybePromise<unknown>
}

export type ResourceDefinitionInput<
  TIdentityFunction extends ResourceIdentityFunction,
  TIdentityRecord extends object = IdentityRecord<TIdentityFunction>,
> = {
  key: string
  identity: TIdentityFunction
  list?: ResourceListDeclaration
  create?: ResourceCreateDeclaration
  detail?: ResourceDetailDeclaration<ResourceIdentityValue<TIdentityFunction>, TIdentityRecord>
  update?: ResourceUpdateDeclaration<ResourceIdentityValue<TIdentityFunction>, TIdentityRecord>
  delete?: ResourceDeleteDeclaration<ResourceIdentityValue<TIdentityFunction>, TIdentityRecord>
  actions?: Record<string, ResourceCustomCommand<(...args: never[]) => unknown, ResourceIdentityValue<TIdentityFunction>>>
}

export type IdentityRecord<TIdentityFunction> = TIdentityFunction extends (record: infer TRecord) => RecordIdentity
  ? [TRecord] extends [never] ? object : TRecord extends object ? TRecord : object
  : object

export type FormSubmitResult<TForm> = TForm extends { submit: (...args: never[]) => infer TResult }
  ? Awaited<TResult>
  : never

export type FormOutputOf<TForm> = TForm extends { schema: RawSchema<unknown, infer TOutput> }
  ? TOutput extends object ? TOutput : never
  : never

export type BoundCollectionLoad<TLoad> = TLoad extends (context: infer TContext) => infer TResult
  ? (context: TContext) => Promise<Awaited<TResult>>
  : never

export type BoundRecordLoad<TLoad> = TLoad extends (context: infer TContext) => infer TResult
  ? (context: TContext) => Promise<Awaited<TResult>>
  : never

export type BoundSubmit<TForm> = TForm extends { submit: (output: infer TOutput) => infer TResult }
  ? (output: TOutput) => Promise<Awaited<TResult>>
  : never

export type BoundTable<TTable extends ListTableShape> = Omit<TTable, 'load' | 'data' | 'resource' | 'namespace'> & {
  load: BoundCollectionLoad<TTable['load']>
  data?: never
  resource: string
  namespace: string
}

export type BoundForm<TForm extends FormBagShape> = Omit<TForm, 'submit' | 'load' | 'modelValue' | 'resource' | 'namespace' | 'id'> & {
  submit: BoundSubmit<TForm>
  resource: string
  namespace: string
} & (TForm extends { load: infer TLoad } ? { load: BoundRecordLoad<TLoad> } : {})

export type BoundUpdateForm<TForm extends FormBagShape, TIdentity extends RecordIdentity> = BoundForm<TForm> & {
  id: TIdentity
}

export type BoundDetail<TDetail extends DetailBagShape, TIdentity extends RecordIdentity> = Omit<TDetail, 'load' | 'data' | 'resource' | 'namespace' | 'id'> & {
  load: BoundRecordLoad<TDetail['load']>
  data?: never
  resource: string
  namespace: string
  id: TIdentity
}

type CustomName<TActions> = Exclude<Extract<keyof TActions, string>, 'list' | 'create' | 'detail' | 'update' | 'delete'>

export type BoundCustomActions<TActions, TIdentity extends RecordIdentity, TRecord extends object> = {
  [TKey in CustomName<TActions>]: TActions[TKey] extends { run: infer TRun }
    ? TRun extends (...args: never[]) => unknown
      ? ResourceCustomHandle<TRun, TIdentity, TRecord>
      : never
    : never
}

export type ResourcePermissions<TDefinition> = {
  [TKey in Extract<keyof TDefinition, 'list' | 'create' | 'detail' | 'update' | 'delete'>]: TDefinition[TKey] extends { permission: infer TPermission }
    ? TPermission
    : never
}

type ResultRecord<TValue> = Awaited<TValue> extends object ? Awaited<TValue> : never
type LoadResult<TLoad> = TLoad extends (...args: never[]) => infer TResult ? Awaited<TResult> : never
type CollectionRecord<TLoad> = LoadResult<TLoad> extends CollectionResult<infer TRecord> ? TRecord : never
type DetailRecord<TDetail> = TDetail extends { load: infer TLoad }
  ? LoadResult<TLoad> extends infer TValue
    ? Exclude<TValue, undefined> extends object ? Exclude<TValue, undefined> : never
    : never
  : never

type DetailSchemaRecord<TDetail> = TDetail extends { schema: RawSchema<unknown, infer TRecord> }
  ? TRecord extends object ? TRecord : never
  : never

type FormSubmitInput<TForm> = TForm extends { submit: (output: infer TInput) => unknown }
  ? TInput extends object ? TInput : never
  : never

type FormOutputGuard<TForm> = [FormOutputOf<TForm>] extends [never]
  ? never
  : [FormSubmitInput<TForm>] extends [never]
    ? never
    : [FormOutputOf<TForm>] extends [FormSubmitInput<TForm>] ? unknown : never

type IdentityRecordGuard<TRecord, TIdentityRecord extends object> = [TRecord] extends [never]
  ? never
  : TRecord extends object
    ? TRecord extends TIdentityRecord ? unknown : never
    : never

type SubmitFunctionResult<TForm> = TForm extends { submit: infer TSubmit }
  ? TSubmit extends (...args: never[]) => infer TResult ? ResultRecord<TResult> : never
  : never

type IdentityResultGuard<TResult, TIdentityRecord extends object> = [TResult] extends [never]
  ? never
  : TResult extends object
    ? TResult extends TIdentityRecord ? unknown : never
    : never

type OperationRecordGuard<TDefinition, TIdentityRecord extends object> =
  (TDefinition extends { list: { table: infer TTable } }
    ? IdentityRecordGuard<TableRecord<TTable>, TIdentityRecord>
      & IdentityRecordGuard<CollectionRecord<TTable extends { load: infer TLoad } ? TLoad : never>, TIdentityRecord>
      & (CollectionRecord<TTable extends { load: infer TLoad } ? TLoad : never> extends TableRecord<TTable> ? unknown : never)
    : unknown)
  & (TDefinition extends { create: { form: infer TForm } }
    ? FormOutputGuard<TForm> & IdentityResultGuard<SubmitFunctionResult<TForm>, TIdentityRecord>
    : unknown)

type NoExtraKeys<TActual, TAllowed extends object> = [TActual] extends [object]
  ? Exclude<keyof TActual, keyof TAllowed> extends never ? unknown : never
  : never

type SameType<TLeft, TRight> = (<T>() => T extends TLeft ? 1 : 2) extends (<T>() => T extends TRight ? 1 : 2)
  ? (<T>() => T extends TRight ? 1 : 2) extends (<T>() => T extends TLeft ? 1 : 2) ? true : false
  : false

type NonemptyPermissionValue<TPermission> = TPermission extends null
  ? unknown
  : TPermission extends string
    ? TPermission extends '' ? never : unknown
    : TPermission extends readonly [string, ...string[]]
      ? '' extends TPermission[number] ? never : unknown
      : TPermission extends readonly [] ? never
        : TPermission extends readonly string[] ? unknown
      : never

type CustomPermissionGuard<TAction> = TAction extends { run: infer TRun; permission: infer TPermission }
  ? TRun extends (...args: never[]) => unknown
    ? TPermission extends (...args: infer TArgs) => infer TResult
      ? SameType<TArgs, Parameters<TRun>> extends true
        ? TResult extends string | readonly string[] | null ? unknown : never
        : never
      : NonemptyPermissionValue<TPermission>
    : never
  : never

type CustomActionGuard<TActions> = TActions extends object
  ? Exclude<Extract<keyof TActions, string>, 'list' | 'create' | 'detail' | 'update' | 'delete'> extends never
    ? never
    : { [TKey in keyof TActions]: NoExtraKeys<TActions[TKey], ResourceCustomCommand> & CustomPermissionGuard<TActions[TKey]> }[keyof TActions]
  : never

type ResourceShapeGuard<TDefinition, TIdentityRecord extends object> =
  NoExtraKeys<TDefinition, ResourceDefinitionInput<ResourceIdentityFunction>>
  & (TDefinition extends { list: infer TList }
    ? NoExtraKeys<TList, ResourceListDeclaration>
      & (TList extends { table: infer TTable } ? NoExtraKeys<TTable, ResourceListTable> : never)
    : unknown)
  & (TDefinition extends { create: infer TCreate }
    ? NoExtraKeys<TCreate, ResourceCreateDeclaration>
      & (TCreate extends { form: infer TForm } ? NoExtraKeys<TForm, ResourceFormBag> : never)
    : unknown)
  & (TDefinition extends { detail: infer TDetail }
    ? NoExtraKeys<TDetail, ResourceDetailDeclaration<RecordIdentity, TIdentityRecord>>
      & (TDetail extends { detail: (...args: never[]) => infer TBag } ? NoExtraKeys<TBag, ResourceDetailBag> : never)
    : unknown)
  & (TDefinition extends { update: infer TUpdate }
    ? NoExtraKeys<TUpdate, ResourceUpdateDeclaration<RecordIdentity, TIdentityRecord>>
      & (TUpdate extends { form: (...args: never[]) => infer TForm } ? NoExtraKeys<TForm, ResourceFormBag> : never)
    : unknown)
  & (TDefinition extends { delete: infer TDelete }
    ? NoExtraKeys<TDelete, ResourceDeleteDeclaration<RecordIdentity, TIdentityRecord>>
    : unknown)
  & (TDefinition extends { actions: infer TActions } ? CustomActionGuard<TActions> : unknown)
  & (TDefinition extends { detail: { detail: (...args: never[]) => infer TDetail } }
    ? IdentityRecordGuard<DetailRecord<TDetail>, TIdentityRecord>
      & IdentityRecordGuard<DetailRecord<TDetail>, DetailSchemaRecord<TDetail>>
    : unknown)
  & (TDefinition extends { update: { form: (...args: never[]) => infer TForm } }
    ? FormOutputGuard<TForm> & IdentityResultGuard<SubmitFunctionResult<TForm>, TIdentityRecord>
    : unknown)

export type ResourceDefinitionGuard<TDefinition, TIdentityFunction extends ResourceIdentityFunction> =
  IdentityFunctionGuard<TIdentityFunction>
  & ([ReturnType<TIdentityFunction>] extends [never] ? never : ReturnType<TIdentityFunction> extends RecordIdentity ? unknown : never)
  & OperationRecordGuard<TDefinition, IdentityRecord<TIdentityFunction>>
  & ResourceShapeGuard<TDefinition, IdentityRecord<TIdentityFunction>>

export type ResourceListPage<TList> = TList extends { table: infer TTable extends ListTableShape }
  ? {
      title?: string
      description?: string
      table: BoundTable<TTable>
      createRoute?: RouteLocationRaw
      detailRoute?: (record: TableRecord<TTable>) => RouteLocationRaw | undefined
      updateRoute?: (record: TableRecord<TTable>) => RouteLocationRaw | undefined
      can?: (operation: ResourceOperation, record?: TableRecord<TTable>) => boolean
      deleteRecord?: (record: TableRecord<TTable>) => Promise<unknown>
    }
  : never

export type ResourceCreatePage<TCreate> = TCreate extends { form: infer TForm extends FormBagShape }
  ? {
      title?: string
      description?: string
      form: BoundForm<TForm>
      defaultTo?: RouteLocationRaw | ((result: FormSubmitResult<TForm>) => RouteLocationRaw | undefined)
      afterSubmit?: (context: unknown) => MaybePromise<void>
      successMessage?: string | false
    }
  : never

export type ResourceDetailPage<TDetail, TIdentity extends RecordIdentity> = TDetail extends { detail: (binding: never) => infer TBag extends DetailBagShape }
  ? {
      title?: string
      backTo?: RouteLocationRaw
      detail: BoundDetail<TBag, TIdentity>
    }
  : never

export type ResourceUpdatePage<TUpdate, TIdentity extends RecordIdentity> = TUpdate extends { form: (binding: never) => infer TForm extends FormBagShape }
  ? {
      title?: string
      description?: string
      form: BoundUpdateForm<TForm, TIdentity>
      defaultTo?: RouteLocationRaw | ((result: FormSubmitResult<TForm>) => RouteLocationRaw | undefined)
      successMessage?: string | false
    }
  : never

export type BoundDelete<TDelete, TIdentity extends RecordIdentity, TRecord extends object> = TDelete extends { run: (id: TIdentity) => infer TResult }
  ? (binding: ResourceBinding<TIdentity, TRecord>) => {
      run: () => Promise<Awaited<TResult>>
      can: () => boolean
      route?: ResourceRoute<TIdentity>
    }
  : never

export type BoundResource<TDefinition, TIdentityFunction extends ResourceIdentityFunction> = {
  key: TDefinition extends { key: infer TKey extends string } ? TKey : string
  permissions: ResourcePermissions<TDefinition>
  invalidate: (args?: { id?: ResourceIdentityValue<TIdentityFunction> }) => Promise<void>
  actions: TDefinition extends { actions: infer TActions }
    ? BoundCustomActions<TActions, ResourceIdentityValue<TIdentityFunction>, IdentityRecord<TIdentityFunction>>
    : Record<never, never>
} & (TDefinition extends { list: infer TList } ? { list: ResourceListPage<TList> } : {})
  & (TDefinition extends { create: infer TCreate } ? { create: ResourceCreatePage<TCreate> } : {})
  & (TDefinition extends { detail: infer TDetail } ? { detail: (binding: ResourceBinding<ResourceIdentityValue<TIdentityFunction>, IdentityRecord<TIdentityFunction>>) => ResourceDetailPage<TDetail, ResourceIdentityValue<TIdentityFunction>> } : {})
  & (TDefinition extends { update: infer TUpdate } ? { update: (binding: ResourceBinding<ResourceIdentityValue<TIdentityFunction>, IdentityRecord<TIdentityFunction>>) => ResourceUpdatePage<TUpdate, ResourceIdentityValue<TIdentityFunction>> } : {})
  & (TDefinition extends { delete: infer TDelete } ? { delete: BoundDelete<TDelete, ResourceIdentityValue<TIdentityFunction>, IdentityRecord<TIdentityFunction>> } : {})

export function isStandardRowOperation(operation: string): operation is Extract<ResourceOperation, 'detail' | 'update' | 'delete'> {
  return operation === 'detail' || operation === 'update' || operation === 'delete'
}
