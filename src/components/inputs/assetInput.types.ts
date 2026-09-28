import type { AssetValue } from '../../assets/contracts'

export type AssetInputModelValue<TMulti extends boolean | undefined> = TMulti extends true
  ? AssetValue[] | null
  : TMulti extends false | undefined
    ? AssetValue | null
    : AssetValue | AssetValue[] | null
