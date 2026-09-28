import type { AssetValue } from '../../../assets/contracts'
import type { AssetInputModelValue } from '../assetInput.types'
import type { TextareaInputModelValue } from '../textareaInput.types'

type Equal<TLeft, TRight> = (<T>() => T extends TLeft ? 1 : 2) extends (<T>() => T extends TRight ? 1 : 2)
  ? (<T>() => T extends TRight ? 1 : 2) extends (<T>() => T extends TLeft ? 1 : 2) ? true : false
  : false
type Assert<T extends true> = T

type TextareaNumberMode = Assert<Equal<TextareaInputModelValue<readonly ['number']>, number | undefined>>
type TextareaTextMode = Assert<Equal<TextareaInputModelValue<readonly ['text']>, string | undefined>>
type TextareaMixedFixedMode = Assert<Equal<TextareaInputModelValue<readonly ['number', 'text']>, string | undefined>>
type TextareaKnownTextPrefix = Assert<Equal<TextareaInputModelValue<readonly ['text', ...('number')[]]>, string | undefined>>
type TextareaDefaultMode = Assert<Equal<TextareaInputModelValue<undefined>, string | undefined>>
type TextareaDefaultConstraint = Assert<Equal<TextareaInputModelValue, string | undefined>>
type TextareaWidenedMode = Assert<Equal<TextareaInputModelValue<readonly ('number' | 'text')[]>, string | number | undefined>>
type TextareaUnionMode = Assert<Equal<TextareaInputModelValue<readonly ['number'] | readonly ['text']>, string | number | undefined>>
type TextareaOptionalNumberMode = Assert<Equal<TextareaInputModelValue<readonly ['number'] | undefined>, string | number | undefined>>

type AssetSingleMode = Assert<Equal<AssetInputModelValue<false>, AssetValue | null>>
type AssetOmittedMode = Assert<Equal<AssetInputModelValue<undefined>, AssetValue | null>>
type AssetMultiMode = Assert<Equal<AssetInputModelValue<true>, AssetValue[] | null>>
type AssetWidenedMode = Assert<Equal<AssetInputModelValue<boolean>, AssetValue | AssetValue[] | null>>
type AssetUnionMode = Assert<Equal<AssetInputModelValue<true | false>, AssetValue | AssetValue[] | null>>
