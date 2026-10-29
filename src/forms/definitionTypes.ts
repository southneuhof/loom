import type { FormInput, FormInputSlotField, FormValidatorEntry } from '../contracts/forms'
import type { LabelDictionary } from '../contracts/labels'
import type { RawSchema } from '../contracts/schema'
import type { FormRendererKey } from '../renderers/formContracts'

export type FormFieldRenderers<TFields extends object> = {
  readonly [TKey in keyof TFields]: Exclude<TFields[TKey], undefined> extends (...args: never[]) => unknown
    ? ReturnType<Exclude<TFields[TKey], undefined>> extends { renderer: infer TRenderer extends FormRendererKey } ? TRenderer : never
    : Exclude<TFields[TKey], undefined> extends { renderer: infer TRenderer extends FormRendererKey } ? TRenderer : never
}

export type CompactFormFields<TInput extends object, TFields extends object> = {
  readonly [TKey in keyof FormFieldRenderers<TFields>]: Exclude<TFields[TKey], undefined> extends (...args: never[]) => unknown
    ? TFields[TKey]
    : TFields[TKey] extends { binding: unknown }
    ? TFields[TKey]
    : TKey extends Extract<keyof TInput, string>
      ? FormFieldRenderers<TFields>[TKey] extends infer TRenderer extends FormRendererKey
        ? FormInput<TInput, TInput[TKey], TRenderer>
        : never
      : never
}

export type CompactFormDefinition<
  TInput extends object,
  TOutput extends object,
  TFields extends object,
  TContext extends object = Readonly<Record<string, unknown>>,
> = {
  readonly schema: RawSchema<TInput, TOutput>
  readonly fields: CompactFormFields<TInput, TFields>
  readonly labels?: LabelDictionary
  readonly validators?: readonly FormValidatorEntry<TInput, TOutput, TContext>[]
}

export type RuntimeFormField<
  TInput extends object,
  TKeys extends string = Extract<keyof TInput, string>,
> = Omit<FormInput<TInput>, 'label' | 'props' | 'visible'>
  & Pick<FormInputSlotField<TInput, TKeys>, 'key' | 'label' | 'props' | 'required'>
  & { readonly visible: boolean }

export type { FormFieldsContext } from '../contracts/forms'

declare const formDefinitionError: unique symbol

export type FormDefinitionError = { readonly [formDefinitionError]: true }
