import type { QueryNamespace } from './query'
import type { RouteLocationAsPathGeneric, RouteLocationAsRelativeGeneric } from 'vue-router'
import type { FormProps } from '../forms/props'
import type { ListExportConfiguration, DetailExportConfiguration, ExportControls } from '../exports/contracts'
import type { DetailProps, TableProps } from './components'
import type { FormDefinition, FormDraft, FormDraftSnapshot, FormSlots } from './forms'
import type { QueryValues } from './query'
import type { MaybePromise, RecordIdentity, RecordLoadContext } from './load'
import type { ResourceOperation } from './access'
import type { SubmitError } from './results'

export type RouteTarget = string | RouteLocationAsRelativeGeneric | RouteLocationAsPathGeneric

export interface FormCompletion<TResult> {
  readonly destinations: (result: TResult, values: Readonly<Record<string, unknown>>, original?: object) => readonly RouteTarget[]
}

export interface AfterSubmitContext<TResult> {
  result: TResult
  defaultTo: RouteTarget | undefined
  navigate: (to: RouteTarget) => Promise<void>
  preventDefaultNavigation: () => void
}

export interface LoadedFormSource<TForm extends object> {
  readonly load: (context: RecordLoadContext) => MaybePromise<object | undefined>
  readonly resolve: (record: object) => TForm
  readonly id: RecordIdentity
  readonly resource: string
  readonly namespace: QueryNamespace
  readonly searchParameters?: Record<string, unknown>
  readonly disabled?: boolean
}

export type FormViewProps<
  TInput extends object = Record<string, unknown>,
  TOutput extends object = Record<string, unknown>,
  TResult = unknown,
  TKeys extends string = Extract<keyof TInput, string>,
  TContext extends object = Readonly<Record<string, unknown>>,
  TFields extends object = {},
> = {
  form: FormProps<TInput, TOutput, TResult, TKeys, TContext, TFields> | LoadedFormSource<FormProps<TInput, TOutput, TResult, TKeys, TContext, TFields>>
  title?: string
  description?: string
  backTo?: RouteTarget | false
  defaultTo?: RouteTarget | ((result: TResult) => RouteTarget | undefined) | false
  completion?: FormCompletion<TResult>
  afterSubmit?: (context: AfterSubmitContext<TResult>) => MaybePromise<void>
  successMessage?: string | false
}

export type FormViewSlots<
  TInput extends object,
  TOutput extends object,
  TResult,
  TKeys extends string = Extract<keyof TInput, string>,
  TContext extends object = Readonly<Record<string, unknown>>,
  TFields extends object = {},
> = FormSlots<TInput, TKeys, TOutput, TResult, TContext> & {
  saved?: (props: { readonly result: TResult; readonly values: Readonly<Record<string, unknown>>; readonly retryNavigation: () => Promise<void> }) => unknown
  header?: () => unknown
  controls?: () => unknown
  body?: (props: { readonly form: FormProps<TInput, TOutput, TResult, TKeys, TContext, TFields> }) => unknown
  footer?: (props: { readonly draft: FormDraftSnapshot<TInput> | undefined }) => unknown
}

export type ListFilters<TQuery extends object = Record<string, unknown>, TInput extends object = Partial<TQuery>, TContext extends object = Readonly<Record<string, unknown>>> = Omit<
  FormDefinition<TInput, Partial<TQuery>, unknown, Extract<keyof TInput, string>, TContext>,
  'submit'
> & {
  submit?: never
  queryKeys: readonly Extract<keyof TQuery, string>[]
  toDraft: (query: Readonly<QueryValues>) => FormDraft<TInput>
  defaults?: FormDraft<TInput>
  label?: string
  resetLabel?: string
}

export interface ListViewActions<TRecord extends object = Record<string, unknown>> {
  createRoute?: RouteTarget | false
  detailRoute?: ((record: TRecord) => RouteTarget | undefined) | false
  updateRoute?: ((record: TRecord) => RouteTarget | undefined) | false
  can?: (operation: ResourceOperation, record?: TRecord) => boolean
  deleteRecord?: (record: TRecord) => Promise<unknown>
  recordIdentity?: (record: TRecord) => RecordIdentity
}

export type ListViewDeleteState = Readonly<{
  disabled: boolean
  pending: boolean
  error?: Readonly<SubmitError>
  refreshing?: boolean
  refresh?: () => Promise<void>
}>

export type ListViewSlotActions<TRecord extends object = Record<string, unknown>> = Omit<ListViewActions<TRecord>, 'deleteRecord' | 'recordIdentity'> & {
  deleteRecord?: (record: TRecord) => Promise<unknown>
  deleteState: (record: TRecord) => ListViewDeleteState
}

export type ListViewProps<
  TRecord extends object = Record<string, unknown>,
  TQuery extends object = Record<string, unknown>,
  TFilterInput extends object = Partial<TQuery>,
  TContext extends object = Readonly<Record<string, unknown>>,
> = {
  title?: string
  description?: string
  actionLabels?: Partial<Record<'create' | 'view' | 'edit' | 'delete', string>>
  filters?: ListFilters<TQuery, TFilterInput, TContext>
  exportAccess?: (record?: TRecord) => boolean
  export?: ListExportConfiguration<TRecord, TQuery, TContext> | boolean
  table: TableProps<TRecord, TQuery, TContext>
} & ListViewActions<TRecord> &
  (
    | {
        deleteRecord: (record: TRecord) => Promise<unknown>
        recordIdentity: (record: TRecord) => RecordIdentity
      }
    | {
        deleteRecord?: undefined
        recordIdentity?: never
      }
  )

export type DetailViewReadyProps<TRecord extends object = Record<string, unknown>, TContext extends object = Readonly<Record<string, unknown>>> = {
  record: TRecord
  exportControls?: ExportControls
  detail: Omit<DetailProps<TRecord, TContext>, 'load' | 'data'> & { data: TRecord }
}

export type DetailViewControls<TRecord extends object = Record<string, unknown>> = {
  record?: TRecord
  loading: boolean
  error?: SubmitError
  refresh: () => Promise<void>
  exportControls?: ExportControls
}

export type DetailViewProps<TRecord extends object = Record<string, unknown>, TContext extends object = Readonly<Record<string, unknown>>> = {
  detail: DetailProps<TRecord, TContext>
  exportAccess?: (record?: TRecord) => boolean
  export?: DetailExportConfiguration<TRecord, TContext> | boolean
  title?: string
  backTo?: RouteTarget | false
}
