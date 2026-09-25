import type FileInput from '../components/inputs/FileInput.vue'
import type NumberInput from '../components/inputs/NumberInput.vue'
import type TextInput from '../components/inputs/TextInput.vue'
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
import type { TableInputProps } from '../components/composites/form-inputs/tableInput.types'
import type FormSeparator from '../components/composites/form-inputs/FormSeparator.vue'
import type DrawingCanvas from '../components/inputs/DrawingCanvas.vue'
import type { TextInputDataAttributes } from '../components/inputs/textInput.types'

export type RichTextFormInput = typeof import('../components/inputs/RichTextInput.vue').default

type AsyncFormComponent<TComponent> = () => Promise<{ default: TComponent }>
type RawFormComponent<T> = T extends AsyncFormComponent<infer TLoaded> ? TLoaded : T
type PublicFormProps<T> = RawFormComponent<T> extends abstract new (...args: infer _TArgs) => infer TInstance
  ? TInstance extends { $props: infer TProps } ? TProps : never
  : never

export interface BuiltInFormRendererComponents {
  text: typeof TextInput
  textarea: AsyncFormComponent<typeof TextareaInput>
  password: AsyncFormComponent<typeof PasswordInput>
  number: AsyncFormComponent<typeof NumberInput>
  select: AsyncFormComponent<typeof SelectInput>
  radio: AsyncFormComponent<typeof RadioGroupInput>
  date: AsyncFormComponent<typeof DateInput>
  daterange: AsyncFormComponent<typeof DateRangeInput>
  month: AsyncFormComponent<typeof MonthInput>
  year: AsyncFormComponent<typeof YearInput>
  time: AsyncFormComponent<typeof TimeInput>
  checkbox: AsyncFormComponent<typeof CheckboxInput>
  'checkbox-group': AsyncFormComponent<typeof CheckboxGroupInput>
  switch: AsyncFormComponent<typeof SwitchInput>
  file: typeof FileInput
  image: AsyncFormComponent<typeof ImageInput>
  tag: AsyncFormComponent<typeof TagInput>
  color: AsyncFormComponent<typeof ColorInput>
  lookup: AsyncFormComponent<typeof LookupInput>
  location: AsyncFormComponent<typeof LocationInput>
  'multi-location': AsyncFormComponent<typeof MultiLocationInput>
  'rich-text': AsyncFormComponent<RichTextFormInput>
  'icon-select': AsyncFormComponent<typeof IconSelectInput>
  table: AsyncFormComponent<typeof TableInput>
  separator: AsyncFormComponent<typeof FormSeparator>
  canvas: AsyncFormComponent<typeof DrawingCanvas>
}

export interface FormRendererComponents extends BuiltInFormRendererComponents {}

export type FormRendererKey = keyof FormRendererComponents & string

type FormOwnedProp =
  | 'required'
  | 'label'
  | 'modelValue'
  | 'model-value'
  | 'onUpdate:modelValue'
  | 'onUpdate:model-value'
  | 'value'
  | 'setValue'
  | 'draft'
  | 'field'
  | 'error'
  | 'touched'
  | 'validating'
  | 'formValidating'
  | 'onValidation:touch'
  | 'onValidation:error'
  | 'validation:touch'
  | 'validation:error'

export type FormRendererPropBag<TRenderer extends keyof FormRendererComponents> = TRenderer extends 'table'
  ? TableInputProps<object, object>
  : PublicFormProps<FormRendererComponents[TRenderer]>

export type FormRendererProps<TRenderer extends keyof FormRendererComponents> = Omit<
  FormRendererPropBag<TRenderer>,
  FormOwnedProp
> & (TRenderer extends 'text' | 'password' ? TextInputDataAttributes : {})

export type FormRendererPropPatch<TRenderer extends keyof FormRendererComponents> = Partial<
  FormRendererProps<TRenderer>
>

type RequiredKeys<TObject> = TObject extends object
  ? {
      [TKey in keyof TObject]-?: {} extends Pick<TObject, TKey> ? never : TKey
    }[keyof TObject]
  : never

export type FormRendererNeedsProps<TRenderer extends keyof FormRendererComponents> =
  [RequiredKeys<FormRendererProps<TRenderer>>] extends [never] ? false : true

type ModelPropValue<TComponent> = PublicFormProps<TComponent> extends infer TProps
  ? TProps extends { modelValue?: unknown } ? TProps['modelValue'] : never
  : never

type ModelUpdateValue<TComponent> = PublicFormProps<TComponent> extends infer TProps
  ? TProps extends { 'onUpdate:modelValue'?: (...args: infer TArgs) => unknown }
    ? TArgs extends [infer TValue, ...unknown[]] ? TValue : never
    : never
  : never

type MatchingModelValue<TComponent> =
  [Exclude<ModelPropValue<TComponent>, undefined>] extends [Exclude<ModelUpdateValue<TComponent>, undefined>]
    ? [Exclude<ModelUpdateValue<TComponent>, undefined>] extends [Exclude<ModelPropValue<TComponent>, undefined>]
      ? Exclude<ModelPropValue<TComponent>, undefined>
      : never
    : never

export type FormRendererModelValue<TRenderer extends keyof FormRendererComponents> = TRenderer extends 'table'
  ? TableInputProps<object, object>['modelValue']
  : MatchingModelValue<FormRendererComponents[TRenderer]>
