import type { RouteLocationRaw } from 'vue-router'
import type { FormProps } from '../forms/props'
import type { ListExportOptions } from '../services/excel'
import type { DetailProps, TableProps } from './components'
import type { FormDefinition, FormDraft, FormSlots } from './forms'
import type { QueryValues } from './query'
import type { MaybePromise, RecordIdentity } from './load'
import type { ResourceOperation } from './access'
import type { SubmitError } from './results'

export interface AfterSubmitContext<TResult> {
  result: TResult
  defaultTo: RouteLocationRaw | undefined
  navigate: (to: RouteLocationRaw) => Promise<void>
  preventDefaultNavigation: () => void
}

export type FormViewProps<
  TInput extends object = Record<string, unknown>,
  TOutput extends object = Record<string, unknown>,
  TResult = unknown,
  TKeys extends string = Extract<keyof TInput, string>,
  TContext extends object = Readonly<Record<string, unknown>>,
> = {
  form: FormProps<TInput, TOutput, TResult, TKeys, TContext>
  title?: string
  description?: string
  backTo?: RouteLocationRaw | false
  defaultTo?: RouteLocationRaw | ((result: TResult) => RouteLocationRaw | undefined) | false
  afterSubmit?: (context: AfterSubmitContext<TResult>) => MaybePromise<void>
  successMessage?: string | false
}

export type FormViewSlots<
  TInput extends object,
  TOutput extends object,
  TResult,
  TKeys extends string = Extract<keyof TInput, string>,
  TContext extends object = Readonly<Record<string, unknown>>,
> = FormSlots<TInput, TKeys> & {
  header?: () => unknown
  controls?: () => unknown
  body?: (props: { readonly form: FormProps<TInput, TOutput, TResult, TKeys, TContext> }) => unknown
  footer?: () => unknown
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
  createRoute?: RouteLocationRaw | false
  detailRoute?: ((record: TRecord) => RouteLocationRaw | undefined) | false
  updateRoute?: ((record: TRecord) => RouteLocationRaw | undefined) | false
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
  export?: ListExportOptions<TRecord, TQuery, TContext> | false
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
  detail: Omit<DetailProps<TRecord, TContext>, 'load' | 'data'> & { data: TRecord }
}

export type DetailViewControls<TRecord extends object = Record<string, unknown>> = {
  record?: TRecord
  loading: boolean
  error?: SubmitError
  refresh: () => Promise<void>
}

export type DetailViewProps<TRecord extends object = Record<string, unknown>, TContext extends object = Readonly<Record<string, unknown>>> = {
  detail: DetailProps<TRecord, TContext>
  title?: string
  backTo?: RouteLocationRaw | false
}
