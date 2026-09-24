import type { FormDefinition } from '../contracts/forms'
import type { Label } from '../contracts/labels'
import type { RawSchema, SchemaFieldKind } from '../contracts/schema'
import { compileSchema } from '../schemas/compileSchema'
import { assertFormBehavior, assertRendererInputCompatibility } from './behavior'
import { assertFormInput, assertSafeFieldKey, isFormInputRecord } from './props'

export interface CompiledFormField {
  key: string
  renderer: string
  required: boolean
  kind: SchemaFieldKind
  label?: Label
  props: Readonly<Record<string, unknown>>
  source?: object
  span?: number
  initialValue?: () => unknown
  behavior?: Readonly<Record<string, unknown>>
  options?: readonly string[]
}

export interface CompiledForm<TInput extends object, TOutput extends object, TResult> {
  definition: FormDefinition<TInput, TOutput, TResult>
  schema: RawSchema<TInput, TOutput>
  inputKeys: readonly string[]
  fields: readonly CompiledFormField[]
  parseAsync: (input: unknown) => Promise<import('../contracts/schema').SchemaParseResult<TOutput>>
}

const definitionMembers = new Set(['schema', 'fields', 'labels', 'validators', 'submit'])
const inferredRenderers: Readonly<Record<string, string>> = {
  string: 'text',
  number: 'number',
  boolean: 'switch',
  date: 'date',
  enum: 'select',
}
const validatorMembers = new Set(['validate', 'triggers', 'path'])
const validationTriggers = new Set(['blur', 'submit'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isLabel(value: unknown): value is import('../contracts/labels').Label {
  return typeof value === 'string' || typeof value === 'function'
}

function isFactory(value: unknown): value is () => unknown {
  return typeof value === 'function'
}

function invalidOption(member: string, expected: string): never {
  throw new Error(`[loom][SURFACE_OPTION_INVALID] Form member "${member}" must be ${expected}.`)
}

function assertLabels(value: unknown): void {
  if (value === undefined) return
  if (!isRecord(value)) invalidOption('labels', 'a label dictionary')
  for (const [key, label] of Object.entries(value)) {
    if (typeof label !== 'string' && typeof label !== 'function') {
      invalidOption(`labels.${key}`, 'a string or a function that returns a string')
    }
  }
}

function assertValidators(value: unknown): void {
  if (value === undefined) return
  if (!Array.isArray(value)) invalidOption('validators', 'an array of validator descriptors')

  for (const [index, validator] of value.entries()) {
    if (!isRecord(validator)) invalidOption(`validators[${index}]`, 'a validator descriptor')
    for (const member of Object.keys(validator)) {
      if (!validatorMembers.has(member)) invalidOption(`validators[${index}].${member}`, 'a validator descriptor member')
    }
    if (typeof validator.validate !== 'function') invalidOption(`validators[${index}].validate`, 'a function')
    if (validator.triggers !== undefined && (!Array.isArray(validator.triggers) || validator.triggers.some((trigger) => !validationTriggers.has(String(trigger))))) {
      invalidOption(`validators[${index}].triggers`, 'an array of blur or submit triggers')
    }
    if (validator.path !== undefined && (!Array.isArray(validator.path) || validator.path.some((part) => typeof part !== 'string' && typeof part !== 'number'))) {
      invalidOption(`validators[${index}].path`, 'an array of string or number path parts')
    }
  }
}

export function compileForm<
  TInput extends object,
  TOutput extends object,
  TResult,
>(definition: FormDefinition<TInput, TOutput, TResult>): CompiledForm<TInput, TOutput, TResult> {
  if (!isRecord(definition)) invalidOption('definition', 'an object')
  if (!Object.hasOwn(definition, 'schema') || definition.schema == null) {
    throw new Error('[loom][FORM_SCHEMA_REQUIRED] Form requires a raw schema.')
  }
  for (const member of Object.keys(definition)) {
    if (!definitionMembers.has(member)) invalidOption(member, 'a FormDefinition member')
  }
  if (!isRecord(definition.fields)) invalidOption('fields', 'an ordered field map')
  if (definition.submit !== undefined && typeof definition.submit !== 'function') invalidOption('submit', 'a function')

  assertLabels(definition.labels)
  assertValidators(definition.validators)

  const schema = compileSchema(definition.schema)
  const fields: CompiledFormField[] = []

  for (const key of Reflect.ownKeys(definition.fields)) {
    if (typeof key !== 'string') {
      throw new Error('[loom][SURFACE_OPTION_INVALID] Form field keys must be strings.')
    }
    assertSafeFieldKey(key)
    if (!schema.inputKeys.includes(key)) {
      throw new Error(`[loom][FORM_FIELD_UNKNOWN] Form field "${key}" is not in the schema input.`)
    }

    const input = definition.fields[key]
    if (!isFormInputRecord(input)) invalidOption(`fields.${key}`, 'a FormInput object')
    const metadata = schema.fields[key]
    if (!metadata) throw new Error(`[loom][FORM_FIELD_UNKNOWN] Form field "${key}" has no schema metadata.`)
    assertFormInput(key, input, metadata)
    const renderer = typeof input.renderer === 'string' ? input.renderer : inferredRenderers[metadata.kind]
    if (!renderer) {
      throw new Error(`[loom][INPUT_RENDERER_REQUIRED] Form field "${key}" has schema kind "${metadata.kind}" and needs an explicit renderer.`)
    }
    assertRendererInputCompatibility(key, metadata.kind, renderer)
    if (isRecord(input.behavior)) assertFormBehavior(input.behavior, key)

    const props = isRecord(input.props) ? { ...input.props } : {}
    if (renderer === 'select' && metadata.kind === 'enum' && !Object.hasOwn(props, 'options')) {
      props.options = metadata.options ?? []
    }
    const field: CompiledFormField = { key, renderer, required: metadata.required, kind: metadata.kind, props }
    if (isLabel(input.label)) field.label = input.label
    if (isRecord(input.source)) field.source = input.source
    if (typeof input.span === 'number') field.span = input.span
    if (isFactory(input.initialValue)) field.initialValue = input.initialValue
    if (isRecord(input.behavior)) field.behavior = { ...input.behavior }
    if (metadata.options) field.options = metadata.options
    fields.push(field)
  }

  return { definition, schema: definition.schema, inputKeys: schema.inputKeys, fields, parseAsync: schema.parseAsync }
}
