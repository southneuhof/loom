import type { FormDefinition } from '../contracts/forms'
import type { MaybePromise, RecordIdentity, RecordLoadContext } from '../contracts/load'
import type { QueryNamespace } from '../contracts/query'
import type { SchemaFieldMetadata } from '../contracts/schema'
import type { SubmitError } from '../contracts/results'
import { assertFormBehavior } from './behavior'

export interface FormInputProps {
  label?: string | (() => string)
  renderer?: string
  props?: Record<string, unknown>
  source?: object
  span?: number
  initialValue?: () => unknown
  behavior?: object
}

export type FormSubmit<TOutput extends object, TResult> = (output: TOutput) => MaybePromise<TResult>

export interface FormRuntimeProps<TInput extends object> {
  modelValue?: Partial<TInput> | undefined
  initialData?: Partial<TInput>
  load?: (context: RecordLoadContext) => MaybePromise<Partial<TInput> | undefined>
  id?: RecordIdentity
  resource?: string
  namespace?: QueryNamespace
  searchParameters?: Record<string, unknown>
  context?: Readonly<Record<string, unknown>>
  normalizeError?: (error: unknown) => SubmitError
  disabled?: boolean
  submitLabel?: string
  submittingLabel?: string
}

export type FormBindingProps<TInput extends object, TOutput extends object, TResult> =
  | { submit: FormSubmit<TOutput, TResult>; modelValue?: Partial<TInput> | undefined }
  | { submit?: never; modelValue: Partial<TInput> | undefined }

export type FormProps<
  TInput extends object = Record<string, unknown>,
  TOutput extends object = Record<string, unknown>,
  TResult = unknown,
> = Omit<FormDefinition<TInput, TOutput, TResult>, 'submit'>
  & FormRuntimeProps<TInput>
  & FormBindingProps<TInput, TOutput, TResult>

export type DialogFormCloseReason = 'cancel' | 'dismiss'

export interface DialogFormCloseContext {
  reason: DialogFormCloseReason
  dirty: boolean
  submitting: boolean
  validating: boolean
}

export interface DialogFormPresentationProps {
  open?: boolean
  title?: string
  description?: string
  closeOnSubmitted?: boolean
  beforeClose?: (context: DialogFormCloseContext) => MaybePromise<boolean>
  cancelLabel?: string
}

export type DialogFormProps<
  TInput extends object = Record<string, unknown>,
  TOutput extends object = Record<string, unknown>,
  TResult = unknown,
> = FormProps<TInput, TOutput, TResult> & DialogFormPresentationProps

const formInputMembers = new Set(['label', 'renderer', 'props', 'source', 'span', 'initialValue', 'behavior'])
const unsafeKeys = new Set(['__proto__', 'prototype', 'constructor'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function invalidOption(key: string, member: string, expected: string): never {
  throw new Error(`[loom][SURFACE_OPTION_INVALID] Form field "${key}" member "${member}" must be ${expected}.`)
}

export function assertSafeFieldKey(key: string): void {
  if (unsafeKeys.has(key) || /^\d+$/.test(key)) {
    throw new Error(`[loom][SURFACE_OPTION_INVALID] Form field key "${key}" must be a named object property.`)
  }
}

export function assertFormInput(key: string, value: unknown, metadata: SchemaFieldMetadata): asserts value is FormInputProps {
  if (!isRecord(value)) invalidOption(key, 'field', 'an object')

  for (const member of Object.keys(value)) {
    if (!formInputMembers.has(member)) invalidOption(key, member, 'a FormInput member')
  }

  if ('label' in value && typeof value.label !== 'string' && typeof value.label !== 'function') {
    invalidOption(key, 'label', 'a string or a function that returns a string')
  }
  if ('renderer' in value && typeof value.renderer !== 'string') invalidOption(key, 'renderer', 'a registered input key')
  if ('props' in value && !isRecord(value.props)) invalidOption(key, 'props', 'an object')
  if (isRecord(value.props) && Object.hasOwn(value.props, 'required')) {
    invalidOption(key, 'props.required', 'controlled by the input schema')
  }
  if ('source' in value && (!isRecord(value.source) || typeof value.source.load !== 'function')) {
    invalidOption(key, 'source', 'an input source object with a load function')
  }
  if ('span' in value && (typeof value.span !== 'number' || !Number.isInteger(value.span) || value.span < 1)) {
    invalidOption(key, 'span', 'a positive integer')
  }
  if ('initialValue' in value && typeof value.initialValue !== 'function') {
    invalidOption(key, 'initialValue', 'a zero-argument function')
  }
  if ('behavior' in value) assertFormBehavior(value.behavior, key)

  if (typeof value.renderer !== 'string' && !['string', 'number', 'boolean', 'date', 'enum'].includes(metadata.kind)) {
    throw new Error(`[loom][INPUT_RENDERER_REQUIRED] Form field "${key}" has schema kind "${metadata.kind}" and needs an explicit renderer.`)
  }
}

export function isFormInputRecord(value: unknown): value is Record<string, unknown> {
  return isRecord(value)
}
