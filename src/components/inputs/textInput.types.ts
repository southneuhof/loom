import type { AriaAttributes, InputHTMLAttributes } from 'vue'

export type TextInputConstraint = 'number' | 'integer' | 'integerString' | 'decimal' | 'text'
export type NumericTextInputConstraint = 'number' | 'integer' | 'decimal'

export interface TextInputNativeAttributes {
  id?: InputHTMLAttributes['id']
  name?: InputHTMLAttributes['name']
  autocomplete?: string
  inputmode?: InputHTMLAttributes['inputmode']
  maxlength?: InputHTMLAttributes['maxlength']
  minlength?: InputHTMLAttributes['minlength']
  pattern?: InputHTMLAttributes['pattern']
  readonly?: Extract<InputHTMLAttributes['readonly'], boolean>
  placeholder?: InputHTMLAttributes['placeholder']
  title?: InputHTMLAttributes['title']
  tabindex?: InputHTMLAttributes['tabindex']
  'aria-label'?: AriaAttributes['aria-label']
  'aria-labelledby'?: AriaAttributes['aria-labelledby']
  'aria-describedby'?: AriaAttributes['aria-describedby']
  'aria-details'?: AriaAttributes['aria-details']
  'aria-errormessage'?: AriaAttributes['aria-errormessage']
  'aria-invalid'?: AriaAttributes['aria-invalid']
  'aria-required'?: AriaAttributes['aria-required']
  'aria-disabled'?: AriaAttributes['aria-disabled']
  'aria-autocomplete'?: AriaAttributes['aria-autocomplete']
  'aria-busy'?: AriaAttributes['aria-busy']
  'aria-controls'?: AriaAttributes['aria-controls']
  'aria-current'?: AriaAttributes['aria-current']
  'aria-expanded'?: AriaAttributes['aria-expanded']
  'aria-haspopup'?: AriaAttributes['aria-haspopup']
  'aria-live'?: AriaAttributes['aria-live']
  'aria-atomic'?: AriaAttributes['aria-atomic']
  'aria-relevant'?: AriaAttributes['aria-relevant']
  'aria-owns'?: AriaAttributes['aria-owns']
  'aria-roledescription'?: AriaAttributes['aria-roledescription']
}

export type TextInputDataAttributes = {
  [TAttribute in `data-${string}`]?: string | number | boolean | null | undefined
}

export type TextInputProps = TextInputNativeAttributes & {
  prefix?: string
  suffix?: string
  icon?: string
  type?: string
  constraint?: readonly TextInputConstraint[]
  field?: string
  enableHelperMessage?: boolean
  label?: string
  helperMessage?: string
  disabled?: boolean
  error?: string
  required?: boolean
}

export type PasswordInputProps = Omit<TextInputProps, 'type' | 'constraint'> & {
  constraint?: readonly ('number' | 'text')[]
  inputClass?: string
}

export type TextInputModelValue<TConstraint extends readonly TextInputConstraint[]> = TConstraint extends readonly [infer TConstraintValue]
  ? TConstraintValue extends NumericTextInputConstraint ? number | undefined : string | undefined
  : number extends TConstraint['length'] ? string | number | undefined : string | undefined
