import type { DisplayRendererKey, DisplayRendererProps } from '../renderers/displayContracts'
import type { Label } from './labels'

export type ReadonlySurfaceConfiguration<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly unknown[]
    ? { readonly [TKey in keyof T]: ReadonlySurfaceConfiguration<T[TKey]> }
    : T extends object
      ? { readonly [TKey in keyof T]: ReadonlySurfaceConfiguration<T[TKey]> }
      : T

export interface DisplayField<
  TRecord extends object = Record<string, unknown>,
  TValue = unknown,
  TRenderer extends DisplayRendererKey = DisplayRendererKey,
> {
  readonly label?: Label
  readonly read?: (record: TRecord) => TValue
  readonly renderer?: TRenderer
  readonly props?: DisplayRendererProps<TRenderer>
  readonly format?: string
}
