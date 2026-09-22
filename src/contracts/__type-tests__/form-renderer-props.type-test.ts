/**
 * Compile-time cases for component-derived props on covered authoring paths.
 * Type-checked by the framework `type-check`; excluded from vitest by filename.
 */
import { defineFields } from '../../fields/defineFields'
import { resolveFrameworkFieldDefaults } from '../../fields/defaults'
import { createInputPropsRegistry } from '../../renderers/inputProps'
import type { ValidationResult } from '../index'

type Doc = { id: string; doc: unknown; amount: number }
const docSchema = {
  identity: 'id' as const,
  record: { schema: { validate: (value: unknown): ValidationResult<Doc> => ({ success: true, data: value as Doc }) } },
  create: { schema: { validate: (value: unknown): ValidationResult<Pick<Doc, 'doc' | 'amount'>> => ({ success: true, data: value as never }) } },
  update: { schema: { validate: (value: unknown): ValidationResult<Pick<Doc, 'doc' | 'amount'>> => ({ success: true, data: value as never }) } },
}

// defineFields: correct declared prop passes, extra props pass.
const docFields = defineFields(docSchema, {
  doc: { form: { renderer: 'file', source: [], props: { accept: ['application/pdf'], extra: true } } },
  amount: { form: { renderer: 'number', props: { currency: 'USD' } } },
})
void docFields

// defineFields: incorrect declared prop fails (inline literal).
const docBadInline = defineFields(docSchema, {
  // @ts-expect-error FileInput.accept is string[], not string
  doc: { form: { renderer: 'file', props: { accept: 'application/pdf' } } },
  amount: { form: { renderer: 'number' } },
})
void docBadInline

// defineFields: incorrect declared prop fails (named variable).
const wrongAccept = 'application/pdf'
const docBadVariable = defineFields(docSchema, {
  // @ts-expect-error FileInput.accept is string[], not string
  doc: { form: { renderer: 'file', props: { accept: wrongAccept } } },
  amount: { form: { renderer: 'number' } },
})
void docBadVariable

// defineFields: incorrect declared prop fails (retained object spread).
const wrongSpread = { accept: 'application/pdf' as string }
const docBadSpread = defineFields(docSchema, {
  // @ts-expect-error spread keeps the wrong string type for accept
  doc: { form: { renderer: 'file', props: { ...wrongSpread } } },
  amount: { form: { renderer: 'number' } },
})
void docBadSpread

// defineFields: misspelled extra prop stays valid.
const docTypo = defineFields(docSchema, {
  doc: { form: { renderer: 'file', props: { accpet: ['application/pdf'] } } },
  amount: { form: { renderer: 'number' } },
})
void docTypo

// Field and projection keys stay closed; props stay open.
const fieldKeyTypo = defineFields(docSchema, {
  // @ts-expect-error fields is not a field definition key
  doc: { fields: [], form: { renderer: 'file' } },
})
void fieldKeyTypo
const formKeyTypo = defineFields(docSchema, {
  // @ts-expect-error fields belongs inside props
  doc: { form: { renderer: 'table', fields: [] } },
})
void formKeyTypo
const tableFields = defineFields(docSchema, {
  doc: { form: { renderer: 'table', props: { fields: [] } } },
})
void tableFields
const misplacedTableFields = { renderer: 'table' as const, fields: [] }
const variableFormKeyTypo = defineFields(docSchema, {
  // @ts-expect-error named form definitions also reject unknown keys
  doc: { form: misplacedTableFields },
})
void variableFormKeyTypo
const displayKeyTypo = defineFields(docSchema, {
  // @ts-expect-error formatName is not a display key
  doc: { display: { formatName: 'date' } },
})
void displayKeyTypo
const tableKeyTypo = defineFields(docSchema, {
  // @ts-expect-error order is not a table key
  doc: { table: { order: 1 } },
})
void tableKeyTypo
const detailKeyTypo = defineFields(docSchema, {
  // @ts-expect-error order is not a detail key
  doc: { detail: { order: 1 } },
})
void detailKeyTypo
const computedKeyTypo = defineFields(docSchema, {
  // @ts-expect-error computed fields also use the closed definition keys
  derived: { display: { read: () => 'derived' }, form: false, fields: [] },
})
void computedKeyTypo

// schema-bound reference override keeps the base renderer check: an override
// that repeats the renderer checks props against it.
const fileOverrideBad = docFields.doc.override(
  // @ts-expect-error override props use the repeated file renderer contract
  {
    form: { renderer: 'file', props: { accept: 'application/pdf' } },
  },
)
void fileOverrideBad
const fileOverrideOk = docFields.doc.override({ form: { renderer: 'file', props: { accept: ['application/pdf'] } } })
void fileOverrideOk
const overrideKeyTypo = docFields.doc.override(
  // @ts-expect-error override form keys are closed
  { form: { renderer: 'table', fields: [] } },
)
void overrideKeyTypo
const overrideOuterTypo = docFields.doc.override(
  // @ts-expect-error override definition keys are closed
  { fields: [] },
)
void overrideOuterTypo

// behavior.props uses the base renderer contract.
const behaviorPropsBad = defineFields(docSchema, {
  // @ts-expect-error behavior props use the base file renderer contract
  doc: { form: { renderer: 'file', behavior: { props: () => ({ accept: 'application/pdf' }) } } },
  amount: { form: { renderer: 'number' } },
})
void behaviorPropsBad

// behavior.presentation uses the selected renderer contract.
const presentationBad = defineFields(docSchema, {
  // @ts-expect-error presentation props use the selected file renderer contract
  doc: { form: { renderer: 'text', behavior: { presentation: () => ({ renderer: 'file' as const, props: { accept: 'application/pdf' } }) } } },
  amount: { form: { renderer: 'number' } },
})
void presentationBad

// Framework field defaults use the same contract.
const defaultsInput = {
  fields: {
    doc: { form: { renderer: 'file' as const, props: { accept: 'application/pdf' } } },
  },
}
const defaultsBad = resolveFrameworkFieldDefaults(
  // @ts-expect-error field default props use the file renderer contract
  defaultsInput,
)
void defaultsBad
const defaultsKeyTypo = resolveFrameworkFieldDefaults(
  // @ts-expect-error field default form keys are closed
  { fields: { doc: { form: { renderer: 'table', fields: [] } } } },
)
void defaultsKeyTypo

// Input adapter defaults use the same contract.
const adaptersBad = createInputPropsRegistry({
  // @ts-expect-error adapter defaults use the file renderer contract
  file: { defaults: { accept: 'application/pdf' } },
})
void adaptersBad
