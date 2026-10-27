import { z } from 'zod'
import type { DialogFormProps, FormProps } from '../../../forms/props'
import type { FormFieldContext } from '../../../contracts/forms'
import type { FormFields } from '../../../contracts/forms'
import { defineForm } from '../../../forms/defineForm'

const schema = z.object({
  id: z.string(),
  name: z.string(),
})

type Input = z.input<typeof schema>
type Output = z.output<typeof schema>

const fields = {
  id: { renderer: 'text' },
  name: { renderer: 'text' },
} satisfies FormFields<Input>

const formSubmit = async (output: Output) => output.id
const dialogProps: DialogFormProps<Input, Output, string> = {
  schema,
  fields,
  submit: formSubmit,
  beforeClose: async (context) => !context.dirty,
}
const formProps: FormProps<Input, Output, string> = {
  schema,
  fields,
  submit: formSubmit,
}
const modelBoundDialog: DialogFormProps<Input, Output> = {
  schema,
  fields,
  modelValue: undefined,
  open: false,
}

type WorkspaceContext = { workspaceId: string }
const contextualDialog: DialogFormProps<Input, Output, string, Extract<keyof Input, string>, WorkspaceContext> = {
  schema,
  fields: {
    name: ({ context }: FormFieldContext<Input, WorkspaceContext>) => ({
      renderer: 'text',
      label: context.workspaceId,
    }),
  },
  context: { workspaceId: 'north' },
  submit: async (value) => value.name,
  open: true,
}
const modelBoundForm: FormProps<Input, Output> = {
  schema,
  fields,
  modelValue: undefined,
}
// @ts-expect-error An open model does not satisfy Form's draft binding requirement.
const missingDialogBinding: DialogFormProps<Input, Output> = { schema, fields, open: true }
const selectedRecordSchema = z.object({
  owner: z.object({ id: z.string(), name: z.string() }),
})
const selectedRecordForm = defineForm({
  schema: selectedRecordSchema,
  fields: { owner: { renderer: 'select', props: { data: [{ id: 'owner-1', name: 'Owner' }], asWhole: true } } },
})

type Assignable<T, U> = [T] extends [U] ? true : false
type AssertFalse<T extends false> = T
type InvalidFormBinding = AssertFalse<Assignable<{
  schema: typeof schema
  fields: typeof fields
}, FormProps<Input, Output>>>

const incompatibleBaseRenderer = defineForm({
  schema,
  fields: {
    // @ts-expect-error NumberInput emits numbers and cannot edit this string.
    name: { renderer: 'number' },
  },
})

void dialogProps
void formProps
void modelBoundDialog
void contextualDialog
void modelBoundForm
void missingDialogBinding
void selectedRecordForm
void incompatibleBaseRenderer
