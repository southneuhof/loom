import { z } from 'zod'
import type { DialogFormProps, FormProps } from '../../../forms/props'
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

const incompatiblePresentationRenderer = defineForm({
  schema,
  fields: {
    // @ts-expect-error The base string renderer cannot be changed to a number renderer.
    name: {
      behavior: {
        presentation: () => ({
          renderer: 'number' as const,
        }),
      },
    },
  },
})

void dialogProps
void formProps
void modelBoundDialog
void modelBoundForm
void missingDialogBinding
void selectedRecordForm
void incompatibleBaseRenderer
void incompatiblePresentationRenderer
