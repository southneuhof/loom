import type { FormDefinition, FormDraft } from '../../../contracts/forms'
import type { TableColumnEntry, TableDefinition, TableProps } from '../../../contracts'

export type TableInputTable<TRow extends object, TContext extends object = Readonly<Record<string, unknown>>> = Omit<TableDefinition<TRow, Readonly<Record<string, TableColumnEntry<NoInfer<TRow>, TContext>>>, TContext>, 'columns'> & {
  columns: Readonly<Record<string, TableColumnEntry<NoInfer<TRow>, TContext>>>
  data?: never
  load?: never
}

export type TableInputForm<TInput extends object, TRow extends object, TContext extends object = Readonly<Record<string, unknown>>> = FormDefinition<TInput, NoInfer<TRow>, unknown, Extract<keyof TInput, string>, TContext> & {
  context?: TContext
  submit?: never
  load?: never
  modelValue?: never
}

type TableInputBase<TInput extends object, TRow extends object, TContext extends object> = {
  table: TableInputTable<TRow, TContext>
  disabled?: boolean
  field?: string
  label?: string
  helperMessage?: string
  error?: string
  required?: boolean
  context?: TContext
}

type TableInputEditor<TInput extends object, TRow extends object, TContext extends object> = {
  form: TableInputForm<TInput, TRow, TContext>
  toDraft: (row: TRow) => FormDraft<TInput>
} & TableInputReordering<TRow>

type TableInputReadOnly = {
  form?: never
  toDraft?: never
  reorderable?: false
  rowKey?: never
}

type TableInputReordering<TRow extends object> =
  | {
      reorderable: true
      rowKey: NonNullable<TableProps<TRow>['rowKey']>
    }
  | {
      reorderable?: false
      rowKey?: TableProps<TRow>['rowKey']
    }

export type TableInputCoreProps<TInput extends object, TRow extends object, TContext extends object = Readonly<Record<string, unknown>>> = TableInputBase<TInput, TRow, TContext>
  & (TableInputReadOnly | TableInputEditor<TInput, TRow, TContext>)

export type TableInputProps<TInput extends object, TRow extends object, TContext extends object = Readonly<Record<string, unknown>>> = TableInputCoreProps<TInput, TRow, TContext> & {
  modelValue: TRow[]
}
