import { defineFields, defineResource, defineSchema } from '../../index'
import type { CollectionResult, ValidationResult, WebResourceCreateOf, WebResourceRecordOf, WebResourceUpdateOf } from '../../contracts'

type Row = { id: string; name: string; status: string }
type Draft = { name: string; password: string }
type Update = { name?: string; active: boolean }
type Selection = { id: string; name: string }
const schema = defineSchema({
  identity: 'id',
  record: { schema: { validate: (value: unknown): ValidationResult<Row> => ({ success: true, data: value as Row }) } },
  query: { schema: { validate: (value: unknown): ValidationResult<Record<string, never>> => ({ success: true, data: value as Record<string, never> }) } },
  create: { schema: { validate: (value: unknown): ValidationResult<Draft> => ({ success: true, data: value as Draft }) } },
  update: { schema: { validate: (value: unknown): ValidationResult<Update> => ({ success: true, data: value as Update }) } },
})

const recordShape: WebResourceRecordOf<typeof schema> = { id: '1', name: 'One', status: 'new' }
const createShape: WebResourceCreateOf<typeof schema> = { name: 'One', password: 'secret' }
const updateShape: WebResourceUpdateOf<typeof schema> = { active: true }
const recordKey: Extract<keyof WebResourceRecordOf<typeof schema>, string> = 'name'
const createKey: Extract<keyof WebResourceCreateOf<typeof schema>, string> = 'password'
const updateKey: Extract<keyof WebResourceUpdateOf<typeof schema>, string> = 'active'
void [recordShape, createShape, updateShape, recordKey, createKey, updateKey]
const fields = defineFields(schema, {
  name: {
    label: 'Name',
    display: { read: (record) => {
      // @ts-expect-error reads use the schema record type
      record.missing
      return record.name
    } },
    form: { renderer: 'text', write: (value) => value, behavior: { visible: ({ draft }) => {
      // @ts-expect-error form behavior uses the create/update draft union
      draft.missing
      return (draft.name?.length ?? 0) > 0
    } } },
  },
  password: { label: 'Password', form: { renderer: 'text' } },
  active: { label: 'Active', form: { renderer: 'switch' } },
  computed: { label: 'Computed', display: { read: (record) => record.status, renderer: 'text' }, form: false },
})

const resource = defineResource(schema, {
  key: 'rows',
  actions: {
    list: {
      run: async () => ({ data: [] } satisfies CollectionResult<Row>),
      fields: [fields.computed, 'name'],
    },
    create: { run: async (input: Draft) => ({ id: '1', name: input.name, status: 'new' }), fields: [fields.name, 'password'] },
    update: { run: async (id: string, input: Update) => ({ id, name: input.name ?? '', status: 'updated' }), fields: [fields.name, 'active'] },
  },
})

const terminal = fields.name.override({ label: 'New name', form: { props: { required: true } } })
// @ts-expect-error an override is terminal
terminal.override({ label: 'Again' })

// @ts-expect-error update-only fields are not valid create fields
defineResource(schema, { key: 'bad-create', actions: { create: { run: async (input: Draft) => ({ id: '1', name: input.name, status: 'new' }), fields: [fields.active] } } })
// @ts-expect-error update-only keys are not valid create fields
defineResource(schema, { key: 'bad-create-key', actions: { create: { run: async (input: Draft) => ({ id: '1', name: input.name, status: 'new' }), fields: ['active'] } } })
// @ts-expect-error create-only keys are not valid update fields
defineResource(schema, { key: 'bad-update-key', actions: { update: { run: async (id: string, input: Update) => ({ id, name: input.name ?? '', status: 'updated' }), fields: ['password'] } } })
// @ts-expect-error create-only keys are not valid list fields
defineResource(schema, { key: 'bad-list-key', actions: { list: { run: async () => ({ data: [] } satisfies CollectionResult<Row>), fields: ['password'] } } })
// @ts-expect-error unknown schema keys are not valid action fields
defineResource(schema, { key: 'bad-unknown-key', actions: { list: { run: async () => ({ data: [] } satisfies CollectionResult<Row>), fields: ['missing'] } } })
// @ts-expect-error computed display fields are not valid form fields
defineResource(schema, { key: 'bad-form', actions: { update: { run: async (id: string, input: Update) => ({ id, name: input.name ?? '', status: 'updated' }), fields: [fields.computed] } } })

// @ts-expect-error a definition key without a schema property must declare display.read and form: false
defineFields(schema, { typo: { label: 'Typo' } })

const computed = defineFields(schema, { statusLabel: { display: { read: (record) => record.status, renderer: 'text' }, form: false } })
void [resource, computed]

const computedWithoutFormExclusion = defineFields(schema, {
  // @ts-expect-error computed display fields must opt out of the form surface
  statusLabel: { display: { read: (record) => record.status, renderer: 'text' } },
})
void computedWithoutFormExclusion

const builtInSchema = defineSchema({
  identity: 'id',
  record: { schema: { validate: (value: unknown): ValidationResult<{ id: string; amount: number; image: string; images: string[]; lookupValues: Selection[] }> => ({ success: true, data: value as never }) } },
  create: { schema: { validate: (value: unknown): ValidationResult<{ amount: number; image: string; images: string[]; lookupValues: Selection[] }> => ({ success: true, data: value as never }) } },
  update: { schema: { validate: (value: unknown): ValidationResult<{ amount: number; image: string; images: string[]; lookupValues: Selection[] }> => ({ success: true, data: value as never }) } },
})
const builtInFields = defineFields(builtInSchema, {
  amount: {
    form: {
      renderer: 'number',
      validate: (value) => {
        // @ts-expect-error number renderer values are numbers
        return value === '12' ? 'bad' : undefined
      },
    },
  },
  image: { form: { renderer: 'image', validate: (value) => value.id } },
  images: { form: { renderer: 'image', props: { multi: true }, write: (value) => value.map((entry) => entry.id) } },
  lookupValues: { form: { renderer: 'lookup', props: { multi: true, pick: 'id', view: 'name' } } },
})
void builtInFields

const invalidSelectionField = defineFields(builtInSchema, {
  lookupValues: {
    // @ts-expect-error selection keys must exist on the item type
    form: {
      renderer: 'lookup',
      props: { multi: true, pick: 'missing' },
    },
  },
})
void invalidSelectionField

const invalidSelectionWriter = defineFields(builtInSchema, {
  // @ts-expect-error multi lookup values stay as selected records; no writer is allowed
  lookupValues: { form: { renderer: 'lookup', props: { multi: true }, write: (value: Selection[]) => value.map((entry) => entry.id) } },
})
void invalidSelectionWriter

const inferredNumber = defineFields(builtInSchema, {
  amount: {
    form: {
      validate: (value) => {
        const numeric: number = value
        void numeric
        // @ts-expect-error inferred number values reject string assignment
        const text: string = value
        void text
        // @ts-expect-error inferred number values reject string comparisons
        return value === '12' ? 'bad' : undefined
      },
    },
  },
})
const customRenderer = defineFields(builtInSchema, {
  amount: { form: { renderer: 'map-widget', validate: (value) => { const unknownValue: unknown = value; void unknownValue; return undefined } } },
})
void [inferredNumber, customRenderer]

const validation: ValidationResult<Row> = { success: true, data: { id: '1', name: 'One', status: 'new' } }
void validation
