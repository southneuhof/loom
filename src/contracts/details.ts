import type { DisplayField } from './display'
import type { LabelDictionary } from './labels'
import type { RawSchema } from './schema'

export interface DetailField<
  TRecord extends object = Record<string, unknown>,
  TValue = unknown,
> extends DisplayField<TRecord, TValue> {
  readonly emphasis?: 'strong' | 'muted'
  readonly span?: number
}

export interface DetailDefinition<TRecord extends object = Record<string, unknown>> {
  readonly schema: RawSchema<object, TRecord>
  readonly fields: Readonly<Record<string, DetailField<TRecord>>>
  readonly labels?: LabelDictionary
}
