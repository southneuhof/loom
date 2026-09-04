/**
 * Universal load contract.
 *
 * A loader may return local, synchronous, cached, or remote asynchronous data.
 * The source is an implementation detail; components only require a normalized
 * result. `data` and `load` are alternatives — supplying both is a development
 * error reported at runtime by the core components.
 */

export type MaybePromise<T> = T | Promise<T>

/** Cancellation context shared by every loader invocation. */
export interface LoadSignalContext {
  signal?: AbortSignal
}

export type Load<TContext, TResult> = (context: TContext) => MaybePromise<TResult>

export interface OptionLoadContext
  extends CollectionLoadContext<Record<string, never>> {}

export type OptionLoad<TOption extends object> =
  Load<OptionLoadContext, readonly TOption[] | import('./results').CollectionResult<TOption>>

/** Context handed to a collection loader. */
export interface CollectionLoadContext<TQuery = Record<string, unknown>> extends LoadSignalContext {
  query: TQuery
  searchParameters: Record<string, unknown>
}

/** Context handed to a single-record loader. */
export interface RecordLoadContext<TIdentity extends RecordIdentity = RecordIdentity> extends LoadSignalContext {
  id?: TIdentity
  searchParameters: Record<string, unknown>
}

/** One scalar component of a record identity. */
export type RecordIdentityValue = string | number

/**
 * Stable identity of one record: a scalar, or a flat record of scalars for
 * composite keys. `{ id }` extracted from `record.id` is the framework default,
 * not the framework language — a resource declares its own identity shape.
 */
export type RecordIdentity = RecordIdentityValue | Readonly<Record<string, RecordIdentityValue>>
