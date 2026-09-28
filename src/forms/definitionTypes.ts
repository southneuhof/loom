import type { FormInput, FormValidatorEntry } from '../contracts/forms'
import type { LabelDictionary } from '../contracts/labels'
import type { RawSchema } from '../contracts/schema'
import type { FormRendererKey } from '../renderers/formContracts'

export type FormFieldRenderers<TFields extends object> = {
  readonly [TKey in keyof TFields]: Exclude<TFields[TKey], undefined> extends { renderer: infer TRenderer extends FormRendererKey } ? TRenderer : never
}

export type CompactFormFields<TInput extends object, TFields extends object> = {
  readonly [TKey in keyof FormFieldRenderers<TFields>]: TKey extends Extract<keyof TInput, string>
    ? FormFieldRenderers<TFields>[TKey] extends infer TRenderer extends FormRendererKey
      ? FormInput<TInput, TInput[TKey], TRenderer>
      : never
    : never
}

export type CompactFormDefinition<TInput extends object, TOutput extends object, TFields extends object> = {
  readonly schema: RawSchema<TInput, TOutput>
  readonly fields: CompactFormFields<TInput, TFields>
  readonly labels?: LabelDictionary
  readonly validators?: readonly FormValidatorEntry<TInput, TOutput>[]
}
