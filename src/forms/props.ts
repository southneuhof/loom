import type { FormActionSlotProps, FormDefinition, FormDraft, FormSlots } from '../contracts/forms'
import type { MaybePromise, RecordIdentity, RecordLoadContext } from '../contracts/load'
import type { QueryNamespace } from '../contracts/query'
import type { SubmitError } from '../contracts/results'
import type { AriaAttributes, ClassValue, StyleValue } from 'vue'
import { assertFormBehavior } from './behavior'

export type FormNativeAttributes = {
  readonly acceptCharset?: string
  readonly action?: string
  readonly autocomplete?: string
  readonly enctype?: string
  readonly method?: string
  readonly name?: string
  readonly novalidate?: boolean | '' | 'true' | 'false'
  readonly target?: string
  readonly accesskey?: string
  readonly contenteditable?: boolean | 'true' | 'false' | 'inherit' | 'plaintext-only'
  readonly dir?: 'ltr' | 'rtl' | 'auto'
  readonly draggable?: boolean | 'true' | 'false'
  readonly hidden?: boolean | '' | 'hidden' | 'until-found'
  readonly inert?: boolean | 'true' | 'false'
  readonly lang?: string
  readonly role?: string
  readonly spellcheck?: boolean | 'true' | 'false'
  readonly tabindex?: number | string
  readonly class?: ClassValue
  readonly style?: StyleValue
}
  & AriaAttributes

export const formNativeAttributeNames = [
  'acceptCharset', 'action', 'autocomplete', 'enctype', 'method', 'name', 'novalidate', 'target',
  'accesskey', 'contenteditable', 'dir', 'draggable', 'hidden', 'inert', 'lang', 'role',
  'spellcheck', 'tabindex', 'class', 'style',
] as const satisfies readonly (keyof FormNativeAttributes)[]

export type FormSubmit<TOutput extends object, TResult> = (output: TOutput) => MaybePromise<TResult>

export interface FormRuntimeProps<TInput extends object> {
  modelValue?: FormDraft<TInput> | undefined
  initialData?: FormDraft<TInput>
  load?: (context: RecordLoadContext) => MaybePromise<FormDraft<TInput> | undefined>
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
  | { submit: FormSubmit<TOutput, TResult>; modelValue?: FormDraft<TInput> | undefined }
  | { submit?: never; modelValue: FormDraft<TInput> | undefined }

export type FormProps<
  TInput extends object = Record<string, unknown>,
  TOutput extends object = Record<string, unknown>,
  TResult = unknown,
  TKeys extends Extract<keyof TInput, string> = Extract<keyof TInput, string>,
> = Omit<FormDefinition<TInput, TOutput, TResult, TKeys>, 'submit'>
  & FormRuntimeProps<TInput>
  & FormBindingProps<TInput, TOutput, TResult>
  & FormNativeAttributes

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
  TKeys extends Extract<keyof TInput, string> = Extract<keyof TInput, string>,
> = FormProps<TInput, TOutput, TResult, TKeys> & DialogFormPresentationProps

export type DialogFormSlots<
  TInput extends object,
  TKeys extends Extract<keyof TInput, string> = Extract<keyof TInput, string>,
> = Omit<FormSlots<TInput, TKeys>, 'actions'> & {
  actions?: (props: Omit<FormActionSlotProps, 'submit'> & {
    submit: () => Promise<void> | undefined
    requestClose: (reason: DialogFormCloseReason) => Promise<boolean>
  }) => unknown
  trigger?: (props: { readonly setOpen: (value: boolean) => void; readonly disabled: boolean }) => unknown
  title?: (props: { readonly requestClose: (reason: DialogFormCloseReason) => Promise<boolean> }) => unknown
  description?: (props: { readonly requestClose: (reason: DialogFormCloseReason) => Promise<boolean> }) => unknown
  header?: (props: { readonly requestClose: (reason: DialogFormCloseReason) => Promise<boolean> }) => unknown
  footer?: (props: { readonly requestClose: (reason: DialogFormCloseReason) => Promise<boolean> }) => unknown
}

const formInputMembers = new Set(['label', 'renderer', 'props', 'span', 'initialValue', 'behavior'])
const unsafeKeys = new Set(['__proto__', 'prototype', 'constructor'])

interface FormInputRuntime {
  renderer: string
  label?: unknown
  props?: unknown
  span?: unknown
  initialValue?: unknown
  behavior?: unknown
}

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

export function assertFormInput(key: string, value: unknown): asserts value is FormInputRuntime {
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
  if ('span' in value && (typeof value.span !== 'number' || !Number.isInteger(value.span) || value.span < 1)) {
    invalidOption(key, 'span', 'a positive integer')
  }
  if ('initialValue' in value && typeof value.initialValue !== 'function') {
    invalidOption(key, 'initialValue', 'a zero-argument function')
  }
  if ('behavior' in value) assertFormBehavior(value.behavior, key)

  if (typeof value.renderer !== 'string') throw new Error(`[loom][INPUT_RENDERER_REQUIRED] Form field "${key}" needs an explicit renderer.`)
}

export function isFormInputRecord(value: unknown): value is Record<string, unknown> {
  return isRecord(value)
}
