import type { RouteLocationRaw } from 'vue-router'
import type { FormProps } from '../forms/props'
import type { ListExportOptions } from '../services/excel'
import type { DetailProps, TableProps } from './components'
import type { FormDefinition, FormDraft, FormSlots } from './forms'
import type { MaybePromise } from './load'
import type { ResourceOperation } from './access'

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
  TKeys extends Extract<keyof TInput, string> = Extract<keyof TInput, string>,
> = {
  form: FormProps<TInput, TOutput, TResult, TKeys>
  title?: string
  description?: string
  backTo?: RouteLocationRaw | false
  defaultTo?: RouteLocationRaw | ((result: TResult) => RouteLocationRaw | undefined) | false
  afterSubmit?: (context: AfterSubmitContext<TResult>) => MaybePromise<void>
  successMessage?: string | false
}

export type FormViewSlots<TInput extends object, TOutput extends object, TResult, TKeys extends Extract<keyof TInput, string> = Extract<keyof TInput, string>> = FormSlots<TInput, TKeys> & {
  header?: () => unknown
  controls?: () => unknown
  body?: (props: { readonly form: FormProps<TInput, TOutput, TResult, TKeys> }) => unknown
  footer?: () => unknown
}

export type ListFilters<TQuery extends object = Record<string, unknown>, TInput extends object = Partial<TQuery>> = Omit<FormDefinition<TInput, Partial<TQuery>>, 'submit'> & {
  submit?: never
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
}

export type ListViewProps<TRecord extends object = Record<string, unknown>, TQuery extends object = Record<string, unknown>, TFilterInput extends object = Partial<TQuery>> = {
  title?: string
  description?: string
  filters?: ListFilters<TQuery, TFilterInput>
  export?: ListExportOptions<TRecord, TQuery> | false
  table: TableProps<TRecord, TQuery>
} & ListViewActions<TRecord>

export type DetailViewProps<TRecord extends object = Record<string, unknown>> = {
  detail: DetailProps<TRecord>
  title?: string
  backTo?: RouteLocationRaw | false
}
