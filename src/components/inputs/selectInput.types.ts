export type SelectOption = Record<string, unknown>
export type SelectModelValue = SelectOption[] | SelectOption | string | number | null

type OptionFromResult<TResult> = TResult extends unknown
  ? Awaited<TResult> extends readonly (infer TOption)[]
    ? TOption
    : Awaited<TResult> extends { data: readonly (infer TOption)[] }
      ? TOption
      : never
  : never

export type OptionFromData<TProps> = TProps extends { data: readonly (infer TOption)[] } ? TOption : never
export type OptionFromLoad<TProps> = TProps extends { load: (...args: infer _TArgs) => infer TResult }
  ? OptionFromResult<TResult>
  : never
export type OptionFromProps<TProps> = [OptionFromData<TProps>] extends [never]
  ? OptionFromLoad<TProps>
  : OptionFromData<TProps>

export type SelectedKey<TProps, TOption> = TProps extends { pick: infer TKey }
  ? TKey extends keyof TOption ? TKey : never
  : 'id' extends keyof TOption ? 'id' : never

export type SelectedValue<TProps, TOption> = SelectedKey<TProps, TOption> extends keyof TOption
  ? TOption[SelectedKey<TProps, TOption>] extends string | number ? TOption[SelectedKey<TProps, TOption>] : string | number
  : string | number

export type RadioInputModelValue<TProps> = [OptionFromProps<TProps>] extends [never]
  ? string | number
  : OptionFromProps<TProps> extends infer TOption
    ? TOption extends object ? SelectedValue<TProps, TOption> : string | number
    : string | number

type UniqueIDOption<TProps, TOption> = TProps extends { uniqueIDAs: infer TKey extends string }
  ? Omit<TOption, SelectedKey<TProps, TOption>> & Record<TKey, SelectedValue<TProps, TOption>>
  : TOption

export type CheckboxGroupInputModelValue<TProps> = [OptionFromProps<TProps>] extends [never]
  ? Array<string | number | Record<string, unknown>>
  : OptionFromProps<TProps> extends infer TOption
    ? TOption extends object ? Array<UniqueIDOption<TProps, TOption>> : Array<string | number | Record<string, unknown>>
    : Array<string | number | Record<string, unknown>>

export type SelectInputModelValue<TProps> = [OptionFromProps<TProps>] extends [never]
  ? SelectModelValue
  : OptionFromProps<TProps> extends infer TOption
    ? TOption extends object
      ? TProps extends { multi: true }
        ? TOption[]
        : TProps extends { asWhole: true }
          ? TOption
          : SelectedValue<TProps, TOption>
      : SelectModelValue
    : SelectModelValue
