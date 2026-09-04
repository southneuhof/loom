import type { TableInputProps } from '../form-inputs/tableInput.types'

type Row = {
  id: string
  name: string
}

const fields = {
  id: { label: 'ID', form: { renderer: 'text' } },
  name: { label: 'Name', form: { renderer: 'text' } },
}

const staticTable = {
  fields,
  form: {},
  table: { pagination: false },
} satisfies TableInputProps<Row>

const reorderableTable = {
  fields,
  reorderable: true,
  rowKey: 'id',
} satisfies TableInputProps<Row>

void staticTable
void reorderableTable

// @ts-expect-error Reorderable TableInput requires stable row identity.
const missingRowKey: TableInputProps<Row> = { fields, reorderable: true }
void missingRowKey

// @ts-expect-error TableInput owns the core Table data source.
const ownedTableData: TableInputProps<Row> = { fields, table: { data: [] } }
void ownedTableData

// @ts-expect-error TableInput owns core Form submission.
const ownedFormSubmit: TableInputProps<Row> = { fields, form: { submit: async () => undefined } }
void ownedFormSubmit

// @ts-expect-error The outer form owns the TableInput field label.
const nestedTitle: TableInputProps<Row> = { fields, title: 'Rows' }
void nestedTitle
