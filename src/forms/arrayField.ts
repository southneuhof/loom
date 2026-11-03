import type { ComputedRef, InjectionKey } from 'vue'
import type { SchemaIssue } from '../contracts/schema'

export interface FormArrayContext {
  readonly disabled: ComputedRef<boolean>
  id: (path: readonly (string | number)[]) => string
  issue: (path: readonly (string | number)[]) => string | undefined
  touch: (path: readonly (string | number)[]) => void
  setError: (path: readonly (string | number)[], message: string | undefined) => void
  update: (field: string, rows: readonly object[], previousIndices: readonly (number | null)[], changed?: readonly [number, string]) => void
}

export const formArrayContextKey: InjectionKey<FormArrayContext> = Symbol('Form array fields')

export function remapArrayPath(path: SchemaIssue['path'], field: string, previousIndices: readonly (number | null)[]): SchemaIssue['path'] | undefined {
  if (path[0] !== field || path.length < 2) return path
  const previous = Number(path[1])
  if (!Number.isInteger(previous)) return path
  const index = previousIndices.indexOf(previous)
  return index < 0 ? undefined : [field, index, ...path.slice(2)]
}
