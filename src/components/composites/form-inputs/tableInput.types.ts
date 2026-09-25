import type { FormDefinition, FormDraft } from '../../../contracts/forms'
import type { TableColumn, TableDefinition, TableProps } from '../../../contracts'

export type TableInputTable<TRow extends object> = Omit<TableDefinition<TRow>, 'columns'> & {
  columns: Readonly<Record<string, TableColumn<NoInfer<TRow>>>>
  data?: never
  load?: never
}

export type TableInputForm<TInput extends object, TRow extends object> = FormDefinition<TInput, NoInfer<TRow>> & {
  submit?: never
  load?: never
  modelValue?: never
}

interface TableInputBase<TInput extends object, TRow extends object> {
  table: TableInputTable<TRow>
  disabled?: boolean
  field?: string
  label?: string
  enableHelperMessage?: boolean
  helperMessage?: string
  error?: string
  required?: boolean
}

type TableInputEditor<TInput extends object, TRow extends object> = {
  form: TableInputForm<TInput, TRow>
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

export type TableInputCoreProps<TInput extends object, TRow extends object> = TableInputBase<TInput, TRow>
  & (TableInputReadOnly | TableInputEditor<TInput, TRow>)

export type TableInputProps<TInput extends object, TRow extends object> = TableInputCoreProps<TInput, TRow> & {
  modelValue: TRow[]
}
