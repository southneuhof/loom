/**
 * Shared field catalog contracts.
 *
 * One catalog replaces the legacy parallel maps (`fieldsAlias`, `fieldsType`,
 * `fieldsProxy`, `fieldsParse`, ...). Shared properties apply on every surface;
 * `table`, `detail`, and `form` carry surface-specific behavior.
 *
 * `renderer` is the field-config key for widget selection on every surface.
 * "Control(s)" is reserved for action controls and never appears here.
 *
 * Plan 002 builds the catalog and renderer registry on top of these contracts.
 */
import type { FormRendererComponents, FormRendererKey, FormRendererProps } from '../renderers/formContracts'

export type FieldKey<TRecord> = Extract<keyof TRecord, string> | (string & {})

/** Caller-supplied information a field may read besides the record or draft. */
export type FieldContext = Record<string, unknown>

/** Display-only access and form-only value transformations. */
export type FieldRead<TRecord, TValue = unknown> = (record: TRecord, context: FieldContext) => TValue
export type FieldWrite<TValue = unknown> = (value: TValue, context: FieldContext) => unknown
export type FieldValidate<TValue = unknown> = (value: TValue, context: FieldContext) => string | undefined
export type FieldInitialValue<TValue = unknown> = () => TValue

/** Identity of the field a renderer is rendering. */
export interface FieldRendererInfo {
  key: string
  label?: string
}

/** Context passed to display renderers on table and detail surfaces. */
export interface DisplayRendererContext<TRecord = Record<string, unknown>, TValue = unknown> {
  value: TValue
  record: TRecord
  field: FieldRendererInfo
  index?: number
}

/** Context passed to form renderers. */
export interface FormRendererContext<TDraft = Record<string, unknown>, TValue = unknown> {
  value: TValue
  draft: TDraft
  field: FieldRendererInfo
  setValue: (value: TValue) => void
  error?: string
  touched: boolean
  disabled: boolean
  validating: boolean
  formValidating: boolean
}

/**
 * Context handed to every `behavior` function. Reading a draft property inside
 * a behavior function is what subscribes that function to the property; there
 * is no manual depends-on list.
 */
export interface FieldBehaviorContext<TDraft = Record<string, unknown>, TValue = unknown> {
  draft: TDraft
  value: TValue
  context: FieldContext
}

/**
 * Pure, synchronous behavior options over the reactive draft. Constants belong
 * in the static projection — `behavior` accepts only functions.
 *
 * Behavior decides presence, schemas decide validity: a field whose `visible`
 * evaluates false contributes no value to the submitted draft, and validation
 * runs on the visibility-filtered draft.
 */
export interface FieldBehavior<TDraft = Record<string, unknown>, TValue = unknown, TRenderer extends FormRendererKey | (string & {}) | undefined = FormRendererKey | (string & {}) | undefined> {
  visible?: (context: FieldBehaviorContext<TDraft, TValue>) => boolean
  disabled?: (context: FieldBehaviorContext<TDraft, TValue>) => boolean
  /** Shallow-merges over the static `props` of the same projection. */
  props?: (context: FieldBehaviorContext<TDraft, TValue>) => TRenderer extends keyof FormRendererComponents ? FormRendererProps<TRenderer & keyof FormRendererComponents> : Record<string, unknown>
  /** Atomically changes presentation only; identity, accessors, and validation stay static. */
  presentation?: (context: FieldBehaviorContext<TDraft, TValue>) => FieldBehaviorPresentation<TRenderer>
  derived?: (context: FieldBehaviorContext<TDraft, TValue>) => TValue
  /** Identity is compared with `Object.is`; changed identity clears this field. */
  resetWhen?: (context: FieldBehaviorContext<TDraft, TValue>) => unknown
}

export interface FieldBehaviorPresentation<TRenderer extends FormRendererKey | (string & {}) | undefined = FormRendererKey | (string & {}) | undefined> {
  renderer?: (TRenderer & (FormRendererKey | (string & {}))) | null
  label?: string | null
  props?: (TRenderer extends keyof FormRendererComponents ? FormRendererProps<TRenderer & keyof FormRendererComponents> : Record<string, unknown>) | null
  span?: number | null
}

/** Widget selection shared by every surface projection. */
export interface FieldRendererSelection {
  renderer?: FormRendererKey | (string & {})
  props?: Record<string, unknown>
}

export interface FieldDisplayProjection<TRecord = Record<string, unknown>, TValue = unknown> extends FieldRendererSelection {
  read?: FieldRead<TRecord, TValue>
  format?: string
}

export interface FieldTableProjection<TRecord = Record<string, unknown>, TValue = unknown> extends FieldDisplayProjection<TRecord, TValue> {
  sortable?: boolean
  align?: 'start' | 'center' | 'end'
  class?: string
  headerClass?: string
}

export interface FieldDetailProjection<TRecord = Record<string, unknown>, TValue = unknown> extends FieldDisplayProjection<TRecord, TValue> {
  emphasis?: 'strong' | 'muted'
  span?: number
}

export interface FieldFormProjection<TDraft = Record<string, unknown>, TValue = unknown> extends FieldRendererSelection {
  /** Opaque app-owned authoring data; resolved before renderer invocation. */
  source?: unknown
  behavior?: FieldBehavior<TDraft, TValue>
  span?: number
  /** Fresh form value used only when the incoming form data does not own the key. */
  initialValue?: FieldInitialValue<TValue>
  /** Replaces the renderer's default non-empty control-shape validation. */
  validate?: FieldValidate<TValue>
  /** The only submit writer for this field; omission leaves the copied value unchanged. */
  write?: FieldWrite<TValue>
}

/** Guard that rejects known renderer props with the wrong declared type. */
export type FormRendererPropGuard<TForm> = TForm extends { renderer: infer TRenderer }
  ? TRenderer extends keyof FormRendererComponents
    ? TForm extends { props?: infer TProps }
      ? TProps extends FormRendererProps<TRenderer & keyof FormRendererComponents> ? unknown : never
      : unknown
    : unknown
  : unknown

/** Guard for `behavior.props` against the base renderer of the same form. */
export type BehaviorPropsGuard<TForm> = TForm extends { renderer: infer TRenderer; behavior: infer TBehavior }
  ? TRenderer extends keyof FormRendererComponents
    ? TBehavior extends { props?: infer TPropsFn }
      ? TPropsFn extends (...args: never[]) => infer TReturn
        ? TReturn extends FormRendererProps<TRenderer & keyof FormRendererComponents> ? unknown : never
        : unknown
      : unknown
    : unknown
  : unknown

/** Guard for `behavior.presentation` when it selects a renderer. */
export type BehaviorPresentationGuard<TForm> = TForm extends { behavior: infer TBehavior }
  ? TBehavior extends { presentation?: infer TPresentationFn }
    ? TPresentationFn extends (...args: never[]) => infer TReturn
      ? TReturn extends { renderer?: infer TRenderer }
        ? [TRenderer] extends [undefined] ? unknown
          : Exclude<TRenderer, undefined | null> extends infer TSelected
            ? TSelected extends keyof FormRendererComponents
              ? TReturn extends { props?: infer TProps }
                ? TProps extends FormRendererProps<TSelected & keyof FormRendererComponents> | null | undefined ? unknown : never
                : unknown
              : unknown
            : unknown
        : unknown
      : unknown
    : unknown
  : unknown

export interface FieldDefinition<
  TRecord = Record<string, unknown>,
  TDraft = TRecord,
  TValue = unknown,
> {
  label?: string
  display?: FieldDisplayProjection<TRecord, TValue>
  /** `false` excludes the field from that surface entirely. */
  table?: FieldTableProjection<TRecord, TValue> | false
  detail?: FieldDetailProjection<TRecord, TValue> | false
  form?: FieldFormProjection<TDraft, TValue> | false
}

declare const fieldReferenceSchema: unique symbol

/** A reusable, schema-bound field definition selected by a resource action. */
export interface FieldReference<
  TSchema = unknown,
  TKey extends string = string,
  TDefinition = FieldDefinition<any, any, any>,
> {
  readonly key: TKey
  readonly [fieldReferenceSchema]: TSchema
  override<TPatch extends PartialFieldDefinition>(
    partialDefinition: TPatch & RendererPropGuardForPatch<TDefinition, TPatch>,
  ): FieldOverride<TSchema, TKey, TDefinition>
}

/** Partial definition accepted by `override`; renderer selects prop checks. */
export type PartialFieldDefinition = Partial<Omit<FieldDefinition<any, any, any>, 'form'>> & {
  form?: Partial<FieldDefinition<any, any, any>['form'] & object> | false
}

/** Marker for the authoring-time input that produced a field reference. */
export declare const referenceInput: unique symbol

type BaseRendererOf<TDefinition> = TDefinition extends { readonly [referenceInput]?: infer TInput }
  ? TInput extends { form?: infer TInputForm }
    ? TInputForm extends { renderer: infer TInputRenderer } ? TInputRenderer : unknown
    : unknown
  : TDefinition extends { form: { renderer: infer TRenderer } } ? TRenderer : unknown

type PatchRendererOf<TPatch> = TPatch extends { form?: infer TForm }
  ? unknown extends TForm ? unknown
    : TForm extends { renderer: infer TRenderer } ? TRenderer : unknown
  : unknown

type EffectiveRendererOf<TDefinition, TPatch> = unknown extends PatchRendererOf<TPatch>
  ? unknown extends BaseRendererOf<TDefinition> ? unknown : BaseRendererOf<TDefinition>
  : PatchRendererOf<TPatch>

/** Guard that checks override props against the effective renderer. */
export type RendererPropGuardForPatch<TDefinition, TPatch> = TPatch extends { form?: infer TForm }
  ? TForm extends false | undefined ? unknown
    : TForm extends { props?: infer TProps }
      ? EffectiveRendererOf<TDefinition, TPatch> extends infer TRenderer
        ? unknown extends TRenderer ? unknown
          : TRenderer extends keyof FormRendererComponents
            ? TProps extends FormRendererProps<TRenderer & keyof FormRendererComponents> ? unknown : never
            : unknown
        : unknown
      : unknown
  : unknown

/** The terminal result of a field override. */
export interface FieldOverride<
  TSchema = unknown,
  TKey extends string = string,
  _TDefinition = FieldDefinition<any, any, any>,
> {
  readonly key: TKey
  readonly [fieldReferenceSchema]: TSchema
}

export type FieldCatalog<TRecord = Record<string, unknown>, TDraft = TRecord> = Record<
  string,
  FieldDefinition<TRecord, TDraft>
>

/** A catalog entry paired with the key it was registered under. */
export type ResolvedField<TRecord = Record<string, unknown>, TDraft = TRecord> = FieldDefinition<TRecord, TDraft> & {
  key: string
}

/**
 * What a core component accepts as `fields`: an ordered list of resolved fields
 * (what resource prop factories produce) or a catalog object (ad-hoc usage).
 */
export type FieldsInput<TRecord = Record<string, unknown>, TDraft = TRecord> =
  | readonly ResolvedField<TRecord, TDraft>[]
  | FieldCatalog<TRecord, TDraft>

/** Selection of catalog keys used by resource surface definitions. */
export type FieldSelection<TRecord = Record<string, unknown>> = readonly FieldKey<TRecord>[]
