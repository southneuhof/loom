import type {
  AccessAdapter,
  CollectionLoadContext,
  CollectionResult,
  DetailProps,
  FormDraft,
  FormInput,
  FormProps,
  FormValidatorEntry,
  LabelDictionary,
  MaybePromise,
  RecordIdentity,
  RecordLoadContext,
  ResourceOperation,
  TableProps,
} from '../contracts'
import type { DetailViewProps, FormViewProps, ListFilters, ListViewActions, ListViewProps } from '../contracts/views'
import type { FormRendererKey } from '../renderers/formContracts'
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
type ResourceRouteLocation<TName extends RouteName, TIdentity extends RecordIdentity, TParams = ResourceRouteParams<TName>> = [RequiredRouteParamKeys<TName>] extends [never]
  ? { name: TName; params?: TParams | ((id: TIdentity) => TParams) }
  : { name: TName; params: TParams | ((id: TIdentity) => TParams) }
type ResourceStaticRouteLocation<TName extends RouteName, TParams = ResourceRouteParams<TName>> = [RequiredRouteParamKeys<TName>] extends [never]
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

type IdentityFunctionGuard<TIdentityFunction extends ResourceIdentityFunction> =
  Parameters<TIdentityFunction> extends [infer TRecord] ? ([TRecord] extends [never] ? never : [TRecord] extends [object] ? unknown : never) : never

export interface ResourceVisibility<TRecord extends object = Record<string, unknown>> {
  visible?: (context: { record?: TRecord; access: AccessAdapter }) => boolean
}

export interface ResourceListTable<TRecord extends object = object, TQuery extends object = object> extends Omit<TableProps<TRecord, TQuery>, 'data' | 'resource'> {
  data?: never
  resource?: never
  load: (context: CollectionLoadContext<TQuery>) => MaybePromise<CollectionResult<TRecord>>
}

export interface ResourceFormBag<TInput extends object = object, TOutput extends object = object, TResult = unknown> extends Omit<
  FormProps<TInput, TOutput, TResult>,
  'modelValue' | 'load' | 'id' | 'resource'
> {
  modelValue?: never
  id?: never
  resource?: never
  load?: (context: RecordLoadContext) => MaybePromise<FormDraft<TInput> | undefined>
  submit: (output: TOutput) => MaybePromise<TResult>
}

export interface ResourceDetailBag<TRecord extends object = object> extends Omit<DetailProps<TRecord>, 'data' | 'id' | 'resource'> {
  data?: never
  id?: never
  resource?: never
  load: (context: RecordLoadContext) => MaybePromise<TRecord | undefined>
}

export type ResourceCustomPermission<TRun extends (...args: never[]) => unknown> = string | readonly string[] | ((...args: Parameters<TRun>) => string | readonly string[] | null) | null

export interface ResourceCustomCommand<
  TRun extends (...args: never[]) => unknown = (...args: never[]) => unknown,
  TIdentity extends RecordIdentity = RecordIdentity,
  TRecord extends object = Record<string, unknown>,
> {
  run: TRun
  permission: ResourceCustomPermission<TRun>
  visible?: (context: { record?: TRecord; access: AccessAdapter }) => boolean
  route?: ResourceRoute<TIdentity>
}

export type ResourceCustomContext<TRecord extends object = Record<string, unknown>> = {
  record: TRecord
}

export type ResourceCustomHandle<
  TRun extends (...args: never[]) => unknown,
  TIdentity extends RecordIdentity,
  TRecord extends object,
  TRoute extends ResourceRoute<TIdentity> = ResourceRoute<TIdentity>,
> = {
  can: (...args: Parameters<TRun>) => boolean
  run: (...args: Parameters<TRun>) => Promise<Awaited<ReturnType<TRun>>>
  route?: TRoute
  withContext: (context: ResourceCustomContext<TRecord>) => ResourceCustomHandle<TRun, TIdentity, TRecord, TRoute>
}

type TableRecord<TTable> = TTable extends { schema: RawSchema<unknown, infer TRecord> } ? (TRecord extends object ? TRecord : never) : never

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

type TableQuery<TTable> = TTable extends { load: (context: CollectionLoadContext<infer TQuery>) => unknown } ? (TQuery extends object ? TQuery : Record<string, unknown>) : Record<string, unknown>

type ListFilterInput<TList, TQuery extends object> = TList extends { filters: infer TFilters }
  ? TFilters extends { schema: { readonly _input: infer TInput } }
    ? TInput extends object
      ? TInput
      : Partial<TQuery>
    : Partial<TQuery>
  : Partial<TQuery>

type ResourceFormViewProps<TResult> = Omit<FormViewProps<object, object, TResult>, 'form'>

export type ResourceListDeclaration<TTable extends ListTableShape = ListTableShape, TRecord extends object = Record<string, unknown>, TFilterInput extends object = Partial<TableQuery<TTable>>> = Omit<
  ListViewProps<TRecord, TableQuery<TTable>, TFilterInput>,
  'table' | 'can' | 'deleteRecord'
> & {
  permission: string | null
  route?: ResourceStaticRoute
  visible?: (context: { access: AccessAdapter }) => boolean
  table: TTable
}

export type ResourceCreateDeclaration<TForm extends FormBagShape = FormBagShape> = ResourceFormViewProps<ResourceFormResult<TForm>> & {
  permission: string | null
  route?: ResourceStaticRoute
  visible?: (context: { access: AccessAdapter }) => boolean
  form: TForm
}

export type ResourceDetailDeclaration<
  TIdentity extends RecordIdentity,
  TIdentityRecord extends object,
  TFactory extends (binding: ResourceBinding<TIdentity, TIdentityRecord>) => DetailBagShape = (binding: ResourceBinding<TIdentity, TIdentityRecord>) => DetailBagShape,
> = Omit<DetailViewProps<TIdentityRecord>, 'detail'> &
  ResourceVisibility<TIdentityRecord> & {
    permission: string | null
    route?: ResourceRoute<TIdentity>
    detail: TFactory
  }

type ResourceUpdateViewProps<TFactory extends (binding: never) => UpdateFormBagShape> = ResourceFormViewProps<ResourceFormResult<ReturnType<TFactory>>>

export type ResourceUpdateDeclaration<
  TIdentity extends RecordIdentity,
  TIdentityRecord extends object,
  TFactory extends (binding: ResourceBinding<TIdentity, TIdentityRecord>) => UpdateFormBagShape = (binding: ResourceBinding<TIdentity, TIdentityRecord>) => UpdateFormBagShape,
> = ResourceUpdateViewProps<TFactory> &
  ResourceVisibility<TIdentityRecord> & {
    permission: string | null
    route?: ResourceRoute<TIdentity>
    form: TFactory
  }

export type ResourceDeleteDeclaration<TIdentity extends RecordIdentity, TIdentityRecord extends object> = ResourceVisibility<TIdentityRecord> & {
  permission: string | null
  route?: ResourceRoute<TIdentity>
  run: (id: TIdentity) => MaybePromise<unknown>
}

export type ResourceDefinitionInput<TIdentityFunction extends ResourceIdentityFunction, TIdentityRecord extends object = IdentityRecord<TIdentityFunction>, TFilterInput extends object = object> = {
  key: string
  identity: TIdentityFunction
  list?: ResourceListDeclaration<ListTableShape, TIdentityRecord, TFilterInput>
  create?: ResourceCreateDeclaration
  detail?: ResourceDetailDeclaration<ResourceIdentityValue<TIdentityFunction>, TIdentityRecord>
  update?: ResourceUpdateDeclaration<ResourceIdentityValue<TIdentityFunction>, TIdentityRecord>
  delete?: ResourceDeleteDeclaration<ResourceIdentityValue<TIdentityFunction>, TIdentityRecord>
  actions?: Record<string, ResourceCustomCommand<(...args: never[]) => unknown, ResourceIdentityValue<TIdentityFunction>, TIdentityRecord>>
}

export type IdentityRecord<TIdentityFunction> = TIdentityFunction extends (record: infer TRecord) => RecordIdentity
  ? [TRecord] extends [never]
    ? object
    : TRecord extends object
      ? TRecord
      : object
  : object

export type FormSubmitResult<TForm> = TForm extends { submit: (output: infer _TOutput) => infer TResult } ? Awaited<TResult> : never

type ResourceFormResult<TForm> = unknown extends FormSubmitResult<TForm> ? never : FormSubmitResult<TForm>

export type FormOutputOf<TForm> = TForm extends { schema: { readonly _output: infer TOutput } } ? (TOutput extends object ? TOutput : never) : never

export type BoundCollectionLoad<TLoad> = TLoad extends (context: infer TContext) => infer TResult ? (context: TContext) => Promise<Awaited<TResult>> : never

export type BoundRecordLoad<TLoad> = TLoad extends (context: infer TContext) => infer TResult ? (context: TContext) => Promise<Awaited<TResult>> : never

type TablePageOptionKeys = Exclude<keyof TableProps, 'schema' | 'columns' | 'querySchema' | 'load' | 'data' | 'resource' | 'namespace' | 'labels'>
type TablePageOptions<TTable> = Pick<TTable, Extract<keyof TTable, TablePageOptionKeys>>

type BoundTable<TRecord extends object, TQuery extends object, TColumns extends object, TOptions extends object, TLoad> = Omit<
  TableProps<TRecord, TQuery>,
  'schema' | 'columns' | 'querySchema' | 'load' | 'data' | 'resource' | 'namespace'
> & TOptions & {
  schema: RawSchema<object, TRecord>
  querySchema?: RawSchema<object, TQuery>
  columns: TColumns
  load: BoundCollectionLoad<TLoad>
  data?: never
  resource: string
  namespace: string
}

type FormFieldRenderers<TFields extends object> = {
  readonly [TKey in keyof TFields]: Exclude<TFields[TKey], undefined> extends { renderer: infer TRenderer extends FormRendererKey } ? TRenderer : never
}

type ResourceFormFields<TInput extends object, TRenderers extends object> = {
  readonly [TKey in keyof TRenderers]: TKey extends Extract<keyof TInput, string>
    ? FormInput<TInput, TInput[TKey], Extract<TRenderers[TKey], FormRendererKey>>
    : never
}

type ResourceFormOptionKeys<TForm> = Exclude<keyof TForm, 'schema' | 'fields' | 'labels' | 'validators' | 'submit' | 'load' | 'modelValue' | 'id' | 'resource' | 'namespace'>
type ResourceFormOptions<TForm> = Pick<TForm, ResourceFormOptionKeys<TForm>>
type ResourceFormLoad<TForm> = TForm extends { load: infer TLoad } ? { load: BoundRecordLoad<TLoad> } : {}

type ResourceFormContract<
  TInput extends object,
  TOutput extends object,
  TResult,
  TRenderers extends object,
  TOptions extends object,
> = {
  schema: RawSchema<TInput, TOutput>
  fields: ResourceFormFields<TInput, TRenderers>
  labels?: LabelDictionary
  validators?: readonly FormValidatorEntry<TInput, TOutput>[]
  submit: (output: TOutput) => Promise<Awaited<TResult>>
  resource: string
  namespace: string
} & TOptions

type BoundForm<TForm extends FormBagShape> = TForm extends {
  schema: RawSchema<infer TInput extends object, infer TOutput extends object>
  fields: infer TFields extends object
  submit: (...args: never[]) => unknown
}
  ? ResourceFormContract<TInput, TOutput, ResourceFormResult<TForm>, FormFieldRenderers<TFields>, ResourceFormOptions<TForm>> & ResourceFormLoad<TForm>
  : never

type BoundUpdateForm<TForm extends FormBagShape, TIdentity extends RecordIdentity> = BoundForm<TForm> & {
  id: TIdentity
}

type DetailPageOptionKeys = Extract<keyof DetailProps, 'searchParameters'>
type DetailPageOptions<TDetail> = Pick<TDetail, Extract<keyof TDetail, DetailPageOptionKeys>>

type BoundDetail<TRecord extends object, TFields extends object, TOptions extends object, TLoad, TIdentity extends RecordIdentity> = Omit<
  DetailProps<TRecord>,
  'schema' | 'fields' | 'labels' | 'load' | 'data' | 'resource' | 'namespace' | 'id'
> & TOptions & {
  schema: RawSchema<object, TRecord>
  fields: TFields
  labels?: LabelDictionary
  load: BoundRecordLoad<TLoad>
  data?: never
  resource: string
  namespace: string
  id: TIdentity
}

type BoundTableContract<TTable extends ListTableShape> = BoundTable<TableRecord<TTable>, TableQuery<TTable>, TTable['columns'], TablePageOptions<TTable>, TTable['load']>
type BoundDetailContract<TDetail extends DetailBagShape, TIdentity extends RecordIdentity> = BoundDetail<DetailSchemaRecord<TDetail>, TDetail['fields'], DetailPageOptions<TDetail>, TDetail['load'], TIdentity>

type CustomName<TActions> = Exclude<Extract<keyof TActions, string>, 'list' | 'create' | 'detail' | 'update' | 'delete'>

type CustomActionRoute<TAction, TIdentity extends RecordIdentity> = 'route' extends keyof TAction
  ? TAction extends { route?: infer TRoute }
    ? Exclude<TRoute, undefined>
    : ResourceRoute<TIdentity>
  : ResourceRoute<TIdentity>

export type BoundCustomActions<TActions, TIdentity extends RecordIdentity, TRecord extends object> = {
  [TKey in CustomName<TActions>]: TActions[TKey] extends { run: infer TRun }
    ? TRun extends (...args: never[]) => unknown
      ? ResourceCustomHandle<TRun, TIdentity, TRecord, CustomActionRoute<TActions[TKey], TIdentity>>
      : never
    : never
}

export type ResourcePermissions<TDefinition> = {
  [TKey in Extract<keyof TDefinition, 'list' | 'create' | 'detail' | 'update' | 'delete'>]: TDefinition[TKey] extends { permission: infer TPermission } ? TPermission : never
}

type ResultRecord<TValue> = [Awaited<TValue>] extends [object] ? Awaited<TValue> : never
type LoadResult<TLoad> = TLoad extends (...args: never[]) => infer TResult ? Awaited<TResult> : never
type CollectionRecord<TLoad> = LoadResult<TLoad> extends CollectionResult<infer TRecord> ? TRecord : never
type DetailRecord<TDetail> = TDetail extends { load: infer TLoad }
  ? LoadResult<TLoad> extends infer TValue
    ? Exclude<TValue, undefined> extends object
      ? Exclude<TValue, undefined>
      : never
    : never
  : never

type DetailSchemaRecord<TDetail> = TDetail extends { schema: RawSchema<unknown, infer TRecord> } ? (TRecord extends object ? TRecord : never) : never

type FormSubmitInput<TForm> = TForm extends { submit: (output: infer TInput) => unknown } ? (TInput extends object ? TInput : never) : never

type FormOutputGuard<TForm> = [FormOutputOf<TForm>] extends [never]
  ? never
  : [FormSubmitInput<TForm>] extends [never]
    ? never
    : [FormOutputOf<TForm>] extends [FormSubmitInput<TForm>]
      ? unknown
      : never

type IdentityRecordGuard<TRecord, TIdentityRecord extends object> = [TRecord] extends [never] ? never : [TRecord] extends [object] ? ([TRecord] extends [TIdentityRecord] ? unknown : never) : never

type SubmitFunctionResult<TForm> = TForm extends { submit: infer TSubmit } ? (TSubmit extends (...args: never[]) => infer TResult ? ResultRecord<TResult> : never) : never

type IdentityResultGuard<TResult, TIdentityRecord extends object> = [TResult] extends [never] ? never : [TResult] extends [object] ? ([TResult] extends [TIdentityRecord] ? unknown : never) : never

type OperationRecordGuard<TDefinition, TIdentityRecord extends object> = (TDefinition extends { list: { table: infer TTable } }
  ? IdentityRecordGuard<TableRecord<TTable>, TIdentityRecord> &
      IdentityRecordGuard<CollectionRecord<TTable extends { load: infer TLoad } ? TLoad : never>, TIdentityRecord> &
      ([CollectionRecord<TTable extends { load: infer TLoad } ? TLoad : never>] extends [TableRecord<TTable>] ? unknown : never)
  : unknown) &
  (TDefinition extends { create: { form: infer TForm } } ? FormOutputGuard<TForm> & IdentityResultGuard<SubmitFunctionResult<TForm>, TIdentityRecord> : unknown)

type KeysOfUnion<TValue> = TValue extends unknown ? keyof TValue : never

type NoExtraKeys<TActual, TAllowed extends object> = [TActual] extends [object] ? (Exclude<KeysOfUnion<TActual>, keyof TAllowed> extends never ? unknown : never) : never

type SameType<TLeft, TRight> =
  (<T>() => T extends TLeft ? 1 : 2) extends <T>() => T extends TRight ? 1 : 2 ? ((<T>() => T extends TRight ? 1 : 2) extends <T>() => T extends TLeft ? 1 : 2 ? true : false) : false

type PermissionValueMemberValid<TPermission> = TPermission extends null
  ? true
  : TPermission extends string
    ? TPermission extends ''
      ? false
      : true
    : TPermission extends readonly [string, ...string[]]
      ? '' extends TPermission[number]
        ? false
        : true
      : TPermission extends readonly []
        ? false
        : TPermission extends readonly string[]
          ? true
          : false

type PermissionValueValid<TPermission> = EveryTrue<PermissionValueMemberValid<TPermission>>

type PermissionResultMemberValid<TResult> = TResult extends null
  ? true
  : TResult extends string
    ? TResult extends ''
      ? false
      : true
    : TResult extends readonly [string, ...string[]]
      ? '' extends TResult[number]
        ? false
        : true
      : TResult extends readonly []
        ? false
        : TResult extends readonly string[]
          ? true
          : false

type PermissionResultValid<TResult> = EveryTrue<PermissionResultMemberValid<TResult>>
type EveryTrue<TValue> = [TValue] extends [true] ? true : false

type CustomPermissionMemberValid<TRun, TPermission> = [TPermission] extends [(...args: never[]) => unknown]
  ? TPermission extends (...args: infer TArgs) => infer TResult
    ? TRun extends (...args: never[]) => unknown
      ? SameType<TArgs, Parameters<TRun>> extends true
        ? [TResult] extends [string | readonly string[] | null]
          ? PermissionResultValid<TResult>
          : false
        : false
      : false
    : false
  : [PermissionValueValid<TPermission>] extends [true]
    ? true
    : false

type CustomActionMemberValid<TAction> = TAction extends unknown
  ? [NoExtraKeys<TAction, ResourceCustomCommand>] extends [never]
    ? false
    : TAction extends { run: infer TRun; permission: infer TPermission }
      ? [TRun] extends [(...args: never[]) => unknown]
        ? [EveryTrue<CustomPermissionMemberValid<TRun, TPermission>>] extends [true]
          ? true
          : false
        : false
      : false
  : false

type ActionValue<TActions, TKey extends PropertyKey> = TActions extends unknown ? (TKey extends keyof TActions ? TActions[TKey] : never) : never

type ReservedAction = 'list' | 'create' | 'detail' | 'update' | 'delete'
type ActionKeys<TActions> = KeysOfUnion<TActions>
type InvalidCustomActionKeys<TActions> = {
  [TKey in ActionKeys<TActions>]-?: TKey extends string ? (TKey extends ReservedAction ? TKey : [EveryTrue<CustomActionMemberValid<ActionValue<TActions, TKey>>>] extends [true] ? never : TKey) : TKey
}[ActionKeys<TActions>]

type CustomActionGuard<TActions> = [TActions] extends [object]
  ? [TActions] extends [readonly unknown[]]
    ? never
    : string extends ActionKeys<TActions>
      ? never
      : [InvalidCustomActionKeys<TActions>] extends [never]
        ? unknown
        : never
  : never

type ResourceShapeGuard<TDefinition, TIdentityRecord extends object> = NoExtraKeys<TDefinition, ResourceDefinitionInput<ResourceIdentityFunction>> &
  (TDefinition extends { list: infer TList } ? NoExtraKeys<TList, ResourceListDeclaration> & (TList extends { table: infer TTable } ? NoExtraKeys<TTable, ResourceListTable> : never) : unknown) &
  (TDefinition extends { create: infer TCreate } ? NoExtraKeys<TCreate, ResourceCreateDeclaration> & (TCreate extends { form: infer TForm } ? NoExtraKeys<TForm, ResourceFormBag> : never) : unknown) &
  (TDefinition extends { detail: infer TDetail }
    ? NoExtraKeys<TDetail, ResourceDetailDeclaration<RecordIdentity, TIdentityRecord>> & (TDetail extends { detail: (...args: never[]) => infer TBag } ? NoExtraKeys<TBag, ResourceDetailBag> : never)
    : unknown) &
  (TDefinition extends { update: infer TUpdate }
    ? NoExtraKeys<TUpdate, ResourceUpdateDeclaration<RecordIdentity, TIdentityRecord>> & (TUpdate extends { form: (...args: never[]) => infer TForm } ? NoExtraKeys<TForm, ResourceFormBag> : never)
    : unknown) &
  (TDefinition extends { delete: infer TDelete } ? NoExtraKeys<TDelete, ResourceDeleteDeclaration<RecordIdentity, TIdentityRecord>> : unknown) &
  (TDefinition extends { actions: infer TActions } ? CustomActionGuard<TActions> : unknown) &
  (TDefinition extends { detail: { detail: (...args: never[]) => infer TDetail } }
    ? IdentityRecordGuard<DetailRecord<TDetail>, TIdentityRecord> & IdentityRecordGuard<DetailRecord<TDetail>, DetailSchemaRecord<TDetail>>
    : unknown) &
  (TDefinition extends { update: { form: (...args: never[]) => infer TForm } } ? FormOutputGuard<TForm> & IdentityResultGuard<SubmitFunctionResult<TForm>, TIdentityRecord> : unknown)

export type ResourceDefinitionGuard<TDefinition, TIdentityFunction extends ResourceIdentityFunction> = IdentityFunctionGuard<TIdentityFunction> &
  ([ReturnType<TIdentityFunction>] extends [never] ? never : [ReturnType<TIdentityFunction>] extends [RecordIdentity] ? unknown : never) &
  OperationRecordGuard<TDefinition, IdentityRecord<TIdentityFunction>> &
  ResourceShapeGuard<TDefinition, IdentityRecord<TIdentityFunction>>

type ResourceListPagePropKeys = 'title' | 'description' | 'filters' | 'export' | 'createRoute' | 'detailRoute' | 'updateRoute'
type ResourceListPageProps<TList> = Pick<TList, Extract<keyof TList, Exclude<ResourceListPagePropKeys, 'filters'>>>
type ResourceListFilterOptions<TFilters> = Pick<TFilters, Extract<keyof TFilters, 'defaults' | 'label' | 'resetLabel'>>
type ResourceListFilterContract<TFilters, TQuery extends object> = TFilters extends {
  schema: RawSchema<infer TInput extends object, infer TOutput extends object>
  fields: infer TFields extends object
}
  ? Omit<ListFilters<TQuery, TInput>, 'schema' | 'fields' | 'labels' | 'validators' | 'submit' | 'defaults' | 'label' | 'resetLabel'> & {
      schema: RawSchema<TInput, TOutput>
      fields: ResourceFormFields<TInput, FormFieldRenderers<TFields>>
      labels?: LabelDictionary
      validators?: readonly FormValidatorEntry<TInput, TOutput>[]
      submit?: never
    } & ResourceListFilterOptions<TFilters>
  : never
type ResourceListFilterProp<TList, TQuery extends object, TFilterInput extends object> = TList extends { filters: infer TFilters }
  ? { filters: ResourceListFilterContract<TFilters, TQuery> }
  : 'filters' extends keyof TList
    ? { filters?: ResourceListFilterContract<Exclude<TList['filters'], undefined>, TQuery> }
    : { filters?: ListFilters<TQuery, TFilterInput> }
type ResourceFormPageStaticPropKeys = 'title' | 'description' | 'backTo' | 'successMessage'
type ResourceFormPageStaticProps<TDeclaration> = Pick<TDeclaration, Extract<keyof TDeclaration, ResourceFormPageStaticPropKeys>>
type PageCallback = (...args: never[]) => unknown
type ReplacePageCallback<TSource, TNormalized> = Exclude<TSource, PageCallback> | ([Extract<TSource, PageCallback>] extends [never] ? never : Extract<TNormalized, PageCallback>)
type ResourceFormPageProps<TDeclaration, TResult> = ResourceFormPageStaticProps<TDeclaration> &
  {
    [TKey in Extract<keyof TDeclaration, 'defaultTo' | 'afterSubmit'>]: TKey extends 'defaultTo'
      ? ReplacePageCallback<TDeclaration[TKey], ResourceFormViewProps<TResult>['defaultTo']>
      : ResourceFormViewProps<TResult>['afterSubmit']
  }
type ResourceDetailPagePropKeys = 'title' | 'backTo'
type ResourceDetailPageProps<TDeclaration> = Pick<TDeclaration, Extract<keyof TDeclaration, ResourceDetailPagePropKeys>>

export type ResourceListPage<
  TRecord extends object,
  TQuery extends object,
  TFilterInput extends object,
  TTable extends object,
  TPageProps extends object,
  TFilterProps extends object,
> = TPageProps & Partial<Omit<ListViewProps<TRecord, TQuery, TFilterInput>, 'table' | 'can' | 'deleteRecord' | 'filters'>> & TFilterProps & {
  table: TTable
  can?: ListViewActions<TRecord>['can']
  deleteRecord?: ListViewActions<TRecord>['deleteRecord']
}

export type ResourceCreatePage<TForm extends object, TResult, TPageProps extends object> = TPageProps & Partial<ResourceFormViewProps<TResult>> & {
  form: TForm
}

export type ResourceDetailPage<TRecord extends object, TDetail extends object, TPageProps extends object> = TPageProps &
  Partial<Omit<DetailViewProps<TRecord>, 'detail'>> & {
    detail: TDetail
  }

export type ResourceUpdatePage<TForm extends object, TResult, TPageProps extends object> = TPageProps & Partial<ResourceFormViewProps<TResult>> & {
  form: TForm
}

type DetailFactory<TDetail> = TDetail extends { detail: infer TFactory } ? TFactory : never
type DetailBag<TDetail> = DetailFactory<TDetail> extends (...args: never[]) => infer TBag ? TBag : never
type UpdateFactory<TUpdate> = TUpdate extends { form: infer TFactory } ? TFactory : never
type UpdateForm<TUpdate> = UpdateFactory<TUpdate> extends (...args: never[]) => infer TForm ? TForm : never

type DeleteResult<TDelete> = TDelete extends { run: (...args: never[]) => infer TResult } ? Awaited<TResult> : never
type DeleteRoute<TDelete, TIdentity extends RecordIdentity> = 'route' extends keyof TDelete
  ? TDelete extends { route?: infer TRoute }
    ? Exclude<TRoute, undefined>
    : ResourceRoute<TIdentity>
  : ResourceRoute<TIdentity>

type BoundDelete<TIdentity extends RecordIdentity, TRecord extends object, TResult, TRoute> = (binding: ResourceBinding<TIdentity, TRecord>) => {
  run: () => Promise<TResult>
  can: () => boolean
  route?: TRoute
}

export type ResourceBoundOperations<TDefinition, TIdentityFunction extends ResourceIdentityFunction> =
  (TDefinition extends { list: infer TList }
    ? TList extends { table: infer TTable extends ListTableShape }
      ? {
          list: ResourceListPage<
            TableRecord<TTable>,
            TableQuery<TTable>,
            ListFilterInput<TList, TableQuery<TTable>>,
            BoundTableContract<TTable>,
            ResourceListPageProps<TList>,
            ResourceListFilterProp<TList, TableQuery<TTable>, ListFilterInput<TList, TableQuery<TTable>>>
          >
        }
      : never
    : {}) &
  (TDefinition extends { create: infer TCreate }
    ? TCreate extends { form: infer TForm extends FormBagShape }
      ? { create: ResourceCreatePage<BoundForm<TForm>, ResourceFormResult<TForm>, ResourceFormPageProps<TCreate, ResourceFormResult<TForm>>> }
      : never
    : {}) &
  (TDefinition extends { detail: infer TDetail }
    ? DetailBag<TDetail> extends infer TBag extends DetailBagShape
      ? {
          detail: (binding: ResourceBinding<ResourceIdentityValue<TIdentityFunction>, IdentityRecord<TIdentityFunction>>) => ResourceDetailPage<
            DetailRecord<TBag>,
            BoundDetailContract<TBag, ResourceIdentityValue<TIdentityFunction>>,
            ResourceDetailPageProps<TDetail>
          >
        }
      : never
    : {}) &
  (TDefinition extends { update: infer TUpdate }
    ? UpdateForm<TUpdate> extends infer TForm extends FormBagShape
      ? {
          update: (binding: ResourceBinding<ResourceIdentityValue<TIdentityFunction>, IdentityRecord<TIdentityFunction>>) => ResourceUpdatePage<
            BoundUpdateForm<TForm, ResourceIdentityValue<TIdentityFunction>>,
            ResourceFormResult<TForm>,
            ResourceFormPageProps<TUpdate, ResourceFormResult<TForm>>
          >
        }
      : never
    : {}) &
  (TDefinition extends { delete: infer TDelete }
    ? {
        delete: BoundDelete<
          ResourceIdentityValue<TIdentityFunction>,
          IdentityRecord<TIdentityFunction>,
          DeleteResult<TDelete>,
          DeleteRoute<TDelete, ResourceIdentityValue<TIdentityFunction>>
        >
      }
    : {})

export type BoundResource<
  TIdentity extends RecordIdentity,
  TKey extends string,
  TPermissions extends object,
  TActions extends object,
  TOperations extends object,
> = {
  key: TKey
  permissions: TPermissions
  invalidate: (args?: { id?: TIdentity }) => Promise<void>
  actions: TActions
} & TOperations

export function isStandardRowOperation(operation: string): operation is Extract<ResourceOperation, 'detail' | 'update' | 'delete'> {
  return operation === 'detail' || operation === 'update' || operation === 'delete'
}
