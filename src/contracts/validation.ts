/**
 * Validation contracts.
 *
 * Zod schemas are the source of truth for validation, but core components only
 * depend on this structural contract so schemas can be RPC-derived (plan 003)
 * or hand-written without changing the components.
 */

export interface ValidationIssue {
  /** Property path; empty for whole-draft issues. */
  path: readonly (string | number)[]
  message: string
  /** Operational failures block submission but are not user validation rejections. */
  kind?: 'operational'
}

export type ValidationResult<TOutput> =
  | { success: true; data: TOutput }
  | { success: false; issues: ValidationIssue[] }

export interface ValidationSchema<TOutput = unknown, TInput = unknown> {
  validate: (input: TInput) => ValidationResult<TOutput>
}

export type FormValidationTrigger = 'blur' | 'submit'

export interface FormValidatorContext<TData extends object, TRaw extends object = Partial<TData>> {
  data: TData
  draft: TRaw
  initial: Partial<TData>
  context: import('./fields').FieldContext
  field?: string
  signal: AbortSignal
}

export type FormValidatorResult = void | ValidationIssue | readonly ValidationIssue[]

export type FormValidator<TData extends object> = (
  context: FormValidatorContext<TData>,
) => import('./load').MaybePromise<FormValidatorResult>

export interface FormValidatorDefinition<TData extends object> {
  validate: FormValidator<TData>
  triggers?: readonly FormValidationTrigger[]
  /** Declares which field should expose pending validation state. */
  path?: readonly (string | number)[]
}

export type FormValidatorInput<TData extends object> = FormValidator<TData> | FormValidatorDefinition<TData>

/** Backend validation errors normalized by the project adapter. */
export interface SubmitError {
  message: string
  issues?: ValidationIssue[]
}
