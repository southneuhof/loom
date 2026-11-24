import type { SubmitError } from '../contracts/results'

export type ConfirmedWriteRefreshError<TResult = unknown> = Readonly<SubmitError> & {
  code: 'RESOURCE_POST_WRITE_INVALIDATION_FAILED'
  postWrite: true
  writeOutcome: 'confirmed'
  result: TResult
  refresh: () => Promise<void>
}

const confirmedErrors = new WeakSet<object>()

function hasConfirmedOutcome(error: object): boolean {
  return Reflect.get(error, 'code') === 'RESOURCE_POST_WRITE_INVALIDATION_FAILED'
    && Reflect.get(error, 'postWrite') === true
    && Reflect.get(error, 'writeOutcome') === 'confirmed'
    && Object.hasOwn(error, 'result')
    && typeof Reflect.get(error, 'refresh') === 'function'
}

export function markConfirmedWriteRefreshError<TError extends SubmitError>(error: TError): TError {
  if (hasConfirmedOutcome(error)) confirmedErrors.add(error)
  return error
}

export function isConfirmedWriteRefreshError<TResult = unknown>(error: unknown): error is ConfirmedWriteRefreshError<TResult> {
  return typeof error === 'object'
    && error !== null
    && confirmedErrors.has(error)
    && hasConfirmedOutcome(error)
}

export function normalizeWriteError(
  error: unknown,
  normalize: (value: unknown) => SubmitError,
): SubmitError {
  const confirmed = isConfirmedWriteRefreshError(error) ? error : undefined
  const normalized = normalize(error)
  if (!confirmed) return normalized
  const trusted: SubmitError = {
    ...normalized,
    code: confirmed.code,
    operation: confirmed.operation,
    retryable: false,
    postWrite: true,
    writeOutcome: 'confirmed',
    result: confirmed.result,
    refresh: confirmed.refresh,
  }
  confirmedErrors.add(trusted)
  return trusted
}
