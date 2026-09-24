import type {
  CollectionLoadContext,
  CollectionResult,
  Load,
  QueryNamespace,
  RecordIdentity,
  RecordLoadContext,
  RecordResult,
  TableDefinition,
} from '../../../contracts'

export type LookupModelValue<TValue extends object> = string | number | TValue | TValue[] | null

export type LookupTable<TValue extends object> = TableDefinition<TValue> & {
  data?: never
  load?: never
}

export type LookupInputBaseProps<TValue extends object> = {
  table: LookupTable<TValue>
  loadDetail?: Load<RecordLoadContext & { id: RecordIdentity }, RecordResult<TValue>>
  searchParameters?: Record<string, unknown>
  namespace?: QueryNamespace
  view?: string
  multi?: boolean
  pick?: string
  placeholder?: string
  field?: string
  label?: string
  enableHelperMessage?: boolean
  helperMessage?: string
  error?: string
  disabled?: boolean
  required?: boolean
}

export type LookupInputSource<TValue extends object> =
  | { data: readonly TValue[]; load?: never }
  | { data?: never; load: Load<CollectionLoadContext, CollectionResult<TValue>> }

export type LookupInputProps<TValue extends object> = LookupInputBaseProps<TValue> & LookupInputSource<TValue>
