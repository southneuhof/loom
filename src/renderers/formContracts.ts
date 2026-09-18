/**
 * Component-derived form renderer prop contracts.
 *
 * The Vue component declaration owns its known prop types. Field authoring
 * infers those types instead of copying them into a hand-written map. Extra
 * props stay open. Required component props stay optional at authoring
 * because defaults, sources, and adapters can supply them later.
 *
 * Component value imports stay type-only so plain `tsc` consumers without
 * the Vue SFC plugin keep working. The runtime registry in `./form` owns
 * the lazy loaders and stays the single runtime source.
 */
import type FileInput from '../components/inputs/FileInput.vue'
import type NumberInput from '../components/inputs/NumberInput.vue'
import type TextareaInput from '../components/inputs/TextareaInput.vue'
import type PasswordInput from '../components/inputs/PasswordInput.vue'
import type SelectInput from '../components/inputs/SelectInput.vue'
import type RadioGroupInput from '../components/inputs/RadioGroupInput.vue'
import type DateInput from '../components/inputs/DateInput.vue'
import type DateRangeInput from '../components/inputs/DateRangeInput.vue'
import type MonthInput from '../components/inputs/MonthInput.vue'
import type YearInput from '../components/inputs/YearInput.vue'
import type TimeInput from '../components/inputs/TimeInput.vue'
import type CheckboxInput from '../components/inputs/CheckboxInput.vue'
import type CheckboxGroupInput from '../components/inputs/CheckboxGroupInput.vue'
import type SwitchInput from '../components/inputs/Switch.vue'
import type ImageInput from '../components/inputs/ImageInput.vue'
import type TagInput from '../components/inputs/TagInput.vue'
import type ColorInput from '../components/inputs/ColorInput.vue'
import type LookupInput from '../components/composites/form-inputs/LookupInput.vue'
import type LocationInput from '../components/composites/form-inputs/LocationInput.vue'
import type MultiLocationInput from '../components/composites/form-inputs/MultiLocationInput.vue'
import type IconSelectInput from '../components/inputs/IconSelectInput.vue'
import type TableInput from '../components/composites/form-inputs/TableInput.vue'
import type FormSeparator from '../components/composites/form-inputs/FormSeparator.vue'
import type DrawingCanvas from '../components/inputs/DrawingCanvas.vue'
import type { coreTextRenderer } from './form'

/** Raw component type for the rich-text renderer, loaded lazily at runtime. */
export type RichTextFormInput = typeof import('../components/inputs/RichTextInput.vue').default

type AnyFormComponent = abstract new (...args: never[]) => unknown

type RawFormComponent<T> = T extends () => Promise<{ default: infer TLoaded }> ? TLoaded : T

type FormComponentOf<T> = RawFormComponent<T> extends AnyFormComponent ? RawFormComponent<T> : never

type PublicFormProps<T extends AnyFormComponent> = InstanceType<T> extends { $props: infer TProps } ? TProps : Record<string, unknown>

/** Form-owned plumbing never authored per field. */
type FormPlumbingKeys =
  | 'modelValue'
  | 'model-value'
  | 'onUpdate:modelValue'
  | 'onUpdate:model-value'
  | 'value'
  | 'setValue'
  | 'onValidation:touch'
  | 'validation:touch'
  | 'draft'
  | 'field'
  | 'touched'
  | 'validating'
  | 'formValidating'

/**
 * Public augmentable map from form renderer key to component type. Custom
 * renderers add their key through module augmentation with `typeof` the
 * component. No second prop interface is required.
 */
export interface FormRendererComponents {
  text: typeof coreTextRenderer
  textarea: () => Promise<{ default: typeof TextareaInput }>
  password: () => Promise<{ default: typeof PasswordInput }>
  number: () => Promise<{ default: typeof NumberInput }>
  currency: () => Promise<{ default: typeof NumberInput }>
  select: () => Promise<{ default: typeof SelectInput }>
  radio: () => Promise<{ default: typeof RadioGroupInput }>
  date: () => Promise<{ default: typeof DateInput }>
  daterange: () => Promise<{ default: typeof DateRangeInput }>
  month: () => Promise<{ default: typeof MonthInput }>
  year: () => Promise<{ default: typeof YearInput }>
  time: () => Promise<{ default: typeof TimeInput }>
  checkbox: () => Promise<{ default: typeof CheckboxInput }>
  'checkbox-group': () => Promise<{ default: typeof CheckboxGroupInput }>
  switch: () => Promise<{ default: typeof SwitchInput }>
  file: typeof FileInput
  image: () => Promise<{ default: typeof ImageInput }>
  tag: () => Promise<{ default: typeof TagInput }>
  color: () => Promise<{ default: typeof ColorInput }>
  lookup: () => Promise<{ default: typeof LookupInput }>
  location: () => Promise<{ default: typeof LocationInput }>
  'multi-location': () => Promise<{ default: typeof MultiLocationInput }>
  'rich-text': () => Promise<{ default: RichTextFormInput }>
  'icon-select': () => Promise<{ default: typeof IconSelectInput }>
  table: () => Promise<{ default: typeof TableInput }>
  separator: () => Promise<{ default: typeof FormSeparator }>
  canvas: () => Promise<{ default: typeof DrawingCanvas }>
}

export type FormRendererKey = keyof FormRendererComponents & string

export type FormRendererPropBag<TRenderer extends keyof FormRendererComponents> = PublicFormProps<
  FormComponentOf<FormRendererComponents[TRenderer]>
>

export type FormRendererProps<TRenderer extends keyof FormRendererComponents> = Partial<
  Omit<FormRendererPropBag<TRenderer>, FormPlumbingKeys>
> & Record<string, unknown>
