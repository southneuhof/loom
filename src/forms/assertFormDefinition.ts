import type { FormDefinition } from '../contracts/forms'
import { createSchemaRuntime, type SchemaRuntime } from '../schemas/schemaRuntime'
import { assertFormInput, assertSafeFieldKey, isFormInputRecord } from './props'

const definitionMembers = new Set(['schema', 'fields', 'labels', 'validators', 'submit'])
const validatorMembers = new Set(['validate', 'triggers', 'path'])
const validationTriggers = new Set(['blur', 'submit'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
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

export function assertFormDefinition<
  TInput extends object,
  TOutput extends object,
  TResult,
  TKeys extends Extract<keyof TInput, string>,
>(definition: FormDefinition<TInput, TOutput, TResult, TKeys>, schemaRuntime?: SchemaRuntime<TOutput>): void {
  if (!isRecord(definition)) invalidOption('definition', 'an object')
  if (!Object.hasOwn(definition, 'schema') || definition.schema == null) {
    throw new Error('[loom][FORM_SCHEMA_REQUIRED] Form requires a raw schema.')
  }
  const runtime = schemaRuntime ?? createSchemaRuntime(definition.schema)
  for (const member of Object.keys(definition)) {
    if (!definitionMembers.has(member)) invalidOption(member, 'a FormDefinition member')
  }
  if (!isRecord(definition.fields)) invalidOption('fields', 'an ordered field map')
  if (definition.submit !== undefined && typeof definition.submit !== 'function') invalidOption('submit', 'a function')

  assertLabels(definition.labels)
  assertValidators(definition.validators)

  for (const key of Reflect.ownKeys(definition.fields)) {
    if (typeof key !== 'string') {
      throw new Error('[loom][SURFACE_OPTION_INVALID] Form field keys must be strings.')
    }
    assertSafeFieldKey(key)
    if (!runtime.inputKeys.includes(key)) {
      throw new Error(`[loom][FORM_FIELD_UNKNOWN] Form field "${key}" is not in the schema input.`)
    }

    const input = definition.fields[key as TKeys]
    if (!isFormInputRecord(input)) invalidOption(`fields.${key}`, 'a FormInput object')
    assertFormInput(key, input)
  }
}
