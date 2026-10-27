import type {
  CollectionLoadContext,
  CollectionResult,
  Load,
  QueryNamespace,
  RecordIdentity,
  RecordLoadContext,
  RecordResult,
  TableColumnEntry,
  TableDefinition,
} from '../../../contracts'

export type LookupModelValue<TValue extends object> = string | number | TValue | TValue[] | null

export type LookupTable<TValue extends object, TContext extends object = Readonly<Record<string, unknown>>> = TableDefinition<TValue, Readonly<Record<string, TableColumnEntry<NoInfer<TValue>, TContext>>>, TContext> & {
  data?: never
  load?: never
}

export type LookupInputBaseProps<TValue extends object, TContext extends object = Readonly<Record<string, unknown>>> = {
  table: LookupTable<TValue, TContext>
  context?: TContext
  loadDetail?: Load<RecordLoadContext & { id: RecordIdentity }, RecordResult<TValue>>
  searchParameters?: Record<string, unknown>
  namespace?: QueryNamespace
  view?: string
  multi?: boolean
  pick?: string
  placeholder?: string
  field?: string
  label?: string
  helperMessage?: string
  error?: string
  disabled?: boolean
  required?: boolean
}

export type LookupInputSource<TValue extends object> =
  | { data: readonly TValue[]; load?: never }
  | { data?: never; load: Load<CollectionLoadContext, CollectionResult<TValue>> }

export type LookupInputProps<TValue extends object, TContext extends object = Readonly<Record<string, unknown>>> = LookupInputBaseProps<TValue, TContext> & LookupInputSource<TValue>
