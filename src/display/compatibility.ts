import type { Label } from '../contracts/labels'
import type { DisplayRendererKey, DisplayRendererProps, DisplayRendererValue, DisplayRendererHasValue } from '../renderers/displayContracts'

type DisplayValue<TRecord extends object, TKey extends string, TField> = TField extends { read: (record: TRecord) => infer TValue } ? TValue : TKey extends keyof TRecord ? TRecord[TKey] : never

type EveryTrue<TValue> = [TValue] extends [true] ? unknown : never
type AllTrue<TValue> = [TValue] extends [true] ? true : false

type RendererValueMember<TRecord extends object, TKey extends string, TField, TRenderer> = TRenderer extends DisplayRendererKey
  ? DisplayRendererHasValue<TRenderer> extends true
    ? [Exclude<DisplayValue<TRecord, TKey, TField>, null | undefined>] extends [DisplayRendererValue<TRenderer>]
      ? true
      : false
    : true
  : false

type RendererValueMemberValid<TRecord extends object, TKey extends string, TField> = TField extends unknown
  ? TField extends { renderer: infer TRenderer }
    ? AllTrue<TRenderer extends DisplayRendererKey ? RendererValueMember<TRecord, TKey, TField, TRenderer> : false>
    : true
  : never

type RendererValueMemberGuard<TRecord extends object, TKey extends string, TField> = EveryTrue<RendererValueMemberValid<TRecord, TKey, TField>>

type RendererPropsForKey<TRenderer, TProps> = TRenderer extends DisplayRendererKey ? ([TProps] extends [DisplayRendererProps<TRenderer>] ? true : false) : false

type DefinedProps<TProps> = [NonNullable<TProps>] extends [never] ? {} : NonNullable<TProps>

type RendererPropsMemberValid<TField> = TField extends unknown
  ? TField extends { renderer: infer TRenderer }
    ? 'props' extends keyof TField
      ? TField extends { props?: infer TProps }
        ? AllTrue<RendererPropsForKey<TRenderer, DefinedProps<TProps>>>
        : false
      : AllTrue<RendererPropsForKey<TRenderer, {}>>
    : 'props' extends keyof TField
      ? false
      : true
  : never

type RendererPropsMemberGuard<TField> = EveryTrue<RendererPropsMemberValid<TField>>

type DisplayRecordMemberValid<TRecord extends object, TKey extends string, TField> =
  TKey extends Extract<keyof TRecord, string> ? true : [TField] extends [{ read: (record: TRecord) => unknown }] ? true : false

type DisplayMemberGuard<TRecord extends object, TKey extends string, TField> = EveryTrue<DisplayRecordMemberValid<TRecord, TKey, TField>> &
  RendererValueMemberGuard<TRecord, TKey, TField> &
  RendererPropsMemberGuard<TField>

export type DisplayFieldGuard<TRecord extends object, TKey extends string, TField> = DisplayMemberGuard<TRecord, TKey, TField>

export type DisplayFieldValue<TRecord extends object, TKey extends string, TField> = DisplayValue<TRecord, TKey, TField>

type CompactRendererConfiguration<TField> = TField extends { renderer: infer TRenderer extends DisplayRendererKey }
  ? {} extends DisplayRendererProps<TRenderer>
    ? { readonly renderer: TRenderer; readonly props?: DisplayRendererProps<TRenderer> }
    : { readonly renderer: TRenderer; readonly props: DisplayRendererProps<TRenderer> }
  : { readonly renderer?: never; readonly props?: never }

export type CompactDisplayField<TRecord extends object, TValue, TField> = TField extends unknown
  ? {
      readonly label?: Label
      readonly format?: string
    } & CompactRendererConfiguration<TField> &
      (TField extends { read: (record: TRecord) => unknown } ? { readonly read: (record: TRecord) => TValue } : {})
  : never
