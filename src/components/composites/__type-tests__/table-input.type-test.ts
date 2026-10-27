import { z } from 'zod/v4'
import { defineForm } from '../../../forms/defineForm'
import { defineTable } from '../../../tables/defineTable'
import type { FormFieldContext, TableColumnContext } from '../../../contracts'
import type { TableInputProps } from '../form-inputs/tableInput.types'

const rowSchema = z.object({ id: z.string(), name: z.string() })
type Row = z.output<typeof rowSchema>

const inputSchema = z.object({ id: z.string(), label: z.string() }).transform(({ id, label }) => ({ id, name: label }))
type RowInput = z.input<typeof inputSchema>

const table = defineTable({ schema: rowSchema, columns: { name: {} } })
const form = defineForm({ schema: inputSchema, fields: { label: { renderer: 'text' } } })
const toDraft = (row: Row): Partial<RowInput> => ({ id: row.id, label: row.name })

type WorkspaceContext = { workspaceId: string }
const contextualForm = defineForm({
  schema: inputSchema,
  fields: {
    label: ({ context }: FormFieldContext<RowInput, WorkspaceContext>) => ({
      renderer: 'text' as const,
      props: { placeholder: context.workspaceId },
    }),
  },
})
const contextualTable = defineTable({
  schema: rowSchema,
  columns: {
    name: ({ context }: TableColumnContext<WorkspaceContext>) => ({
      read: (row: Row) => `${context.workspaceId}: ${row.name}`,
    }),
  },
})
const contextualEditor: TableInputProps<RowInput, Row, WorkspaceContext> = {
  table: contextualTable,
  form: contextualForm,
  context: { workspaceId: 'north' },
  toDraft,
  modelValue: [],
}

type NumericWorkspaceContext = { workspaceId: number }
const mismatchedTableContext: TableInputProps<RowInput, Row, NumericWorkspaceContext> = {
  // @ts-expect-error The nested table resolver requires a string workspaceId.
  table: contextualTable,
  form,
  toDraft,
  modelValue: [],
}
const mismatchedFormContext: TableInputProps<RowInput, Row, NumericWorkspaceContext> = {
  table,
  // @ts-expect-error The nested form resolver requires a string workspaceId.
  form: contextualForm,
  toDraft,
  modelValue: [],
}

const editableTable: TableInputProps<RowInput, Row> = {
  table,
  form,
  toDraft,
  modelValue: [],
  reorderable: true,
  rowKey: 'id',
}
const readOnlyTable: TableInputProps<Row, Row> = { table, modelValue: [] }

// @ts-expect-error Editing needs an explicit row-to-draft mapping.
const missingEditorMapper: TableInputProps<RowInput, Row> = {
  table,
  form,
  modelValue: [],
}

const editorWithSubmit = defineForm({
  schema: inputSchema,
  fields: { label: { renderer: 'text' } },
  submit: async () => 'saved',
})
const submittingEditor: TableInputProps<RowInput, Row> = {
  table,
  modelValue: [],
  // @ts-expect-error TableInput owns the row editor submit function.
  form: editorWithSubmit,
  toDraft,
}

const tableWithData = { ...table, data: [] as Row[] }
const tableWithLoader = { ...table, load: async () => ({ data: [] as Row[] }) }
const formWithLoader = { ...form, load: async () => ({ id: 'one', label: 'Name' }) }
const formWithModel = { ...form, modelValue: { id: 'one', label: 'Name' } }
const readOnlyReorder = { table, modelValue: [] as Row[], reorderable: true, rowKey: 'id' as const }

// @ts-expect-error TableInput owns the Table data source.
const conflictingData: TableInputProps<RowInput, Row> = { table: tableWithData, form, toDraft, modelValue: [] }
// @ts-expect-error TableInput owns the Table loader.
const conflictingLoad: TableInputProps<RowInput, Row> = { table: tableWithLoader, form, toDraft, modelValue: [] }
// @ts-expect-error TableInput owns the row editor submit function.
const conflictingSubmit: TableInputProps<RowInput, Row> = { table, form: editorWithSubmit, toDraft, modelValue: [] }
// @ts-expect-error TableInput owns row form loading.
const conflictingFormLoad: TableInputProps<RowInput, Row> = { table, form: formWithLoader, toDraft, modelValue: [] }
// @ts-expect-error TableInput owns the row form model.
const conflictingFormModel: TableInputProps<RowInput, Row> = { table, form: formWithModel, toDraft, modelValue: [] }
// @ts-expect-error Read-only TableInput cannot reorder its model.
const conflictingReadOnlyReorder: TableInputProps<Row, Row> = readOnlyReorder

void [editableTable, readOnlyTable, submittingEditor, missingEditorMapper, conflictingData, conflictingLoad, conflictingSubmit, conflictingFormLoad, conflictingFormModel, conflictingReadOnlyReorder, contextualEditor, mismatchedTableContext, mismatchedFormContext]
