import type { FieldsInput, FormProps, RowReorderPayload, TableProps } from '../../../contracts'

export type TableInputRow = Record<string, unknown>

export type TableInputFormOptions<TRow extends object = TableInputRow> = Omit<
  FormProps<TRow>,
  'fields' | 'initialData' | 'load' | 'modelValue' | 'submit'
>

export type TableInputTableOptions<TRow extends object = TableInputRow> = Omit<
  TableProps<TRow>,
  'data' | 'fields' | 'load' | 'reorderable' | 'rowKey'
>

interface TableInputPropsBase<TRow extends object = TableInputRow> {
  fields: FieldsInput<TRow, TRow>
  form?: TableInputFormOptions<TRow>
  table?: TableInputTableOptions<TRow>
  modelValue?: TRow[]
  disabled?: boolean
}

export type TableInputProps<TRow extends object = TableInputRow> =
  | (TableInputPropsBase<TRow> & {
      reorderable: true
      rowKey: NonNullable<TableProps<TRow>['rowKey']>
    })
  | (TableInputPropsBase<TRow> & {
      reorderable?: false
      rowKey?: TableProps<TRow>['rowKey']
    })

export type TableInputReorderPayload<TRow extends object = TableInputRow> = RowReorderPayload<TRow>
