/**
 * Project adapter boundary.
 *
 * Backend response shapes, error envelopes, and URL query encoding are
 * project-specific and must not live in reusable components. The framework owns
 * the interfaces and conservative defaults; applications supply implementations
 * at bootstrap through `FrameworkPlugin`.
 */
import { inject, type InjectionKey } from 'vue'
import type {
  AccessAdapter,
  CollectionResult,
  RecordResult,
  QueryLocationAdapter,
  QueryNamespace,
  QueryValues,
  SubmitError,
  ValidationSchema,
} from '../contracts'

export interface DataAdapter {
  /** Normalizes any backend collection envelope into rows plus metadata. */
  normalizeCollection: <TRecord extends object>(payload: unknown) => CollectionResult<TRecord>
  /** Normalizes any backend record envelope into one record. */
  normalizeRecord: <TRecord extends object>(payload: unknown) => RecordResult<TRecord>
  /** Normalizes a rejected request into a message plus field issues. */
  normalizeError: (error: unknown) => SubmitError
}

export interface SchemaAdapter {
  /** Looks up schemas an RPC route exposes; returns undefined when unavailable. */
  find: (resource: string, operation: 'record' | 'query' | 'create' | 'update') => ValidationSchema | undefined
}

/** Project-owned UI environment signals (theme, …). */
export interface UiAdapter {
  /** Current color scheme preference; `'dark'` switches date pickers to dark. */
  colorPreference(): { value: 'light' | 'dark' }
}

export interface QueryRuntimeDefaults {
  staleTime?: number
  retry?: number
  refetchOnWindowFocus?: boolean
}

export interface FrameworkAdaptersInput {
  data?: Partial<DataAdapter>
  query?: QueryLocationAdapter
  schemas?: SchemaAdapter
  /** UI access policy. Backend authorization stays authoritative. */
  access?: AccessAdapter
  queryDefaults?: QueryRuntimeDefaults
  /** UI environment signals; defaults to a static light scheme. */
  ui?: UiAdapter
}

export interface ResolvedFrameworkAdapters {
  data: DataAdapter
  query: QueryLocationAdapter
  schemas?: SchemaAdapter
  access: AccessAdapter
  queryDefaults: Required<QueryRuntimeDefaults>
  ui: UiAdapter
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readNumber(source: Record<string, unknown>, key: string): number | undefined {
  const value = source[key]
  return typeof value === 'number' ? value : undefined
}

function collectMeta(source: Record<string, unknown>) {
  const total = readNumber(source, 'total')
  const page = readNumber(source, 'page')
  const pageSize = readNumber(source, 'limit') ?? readNumber(source, 'pageSize')
  const declaredTotalPage = readNumber(source, 'totalPage')
  const totalPage = declaredTotalPage ?? (total != null && pageSize ? Math.ceil(total / pageSize) : undefined)
  const meta = { total, page, pageSize, totalPage }
  return Object.values(meta).some((value) => value !== undefined) ? meta : undefined
}

export const defaultDataAdapter: DataAdapter = {
  normalizeCollection: <TRecord extends object>(payload: unknown): CollectionResult<TRecord> => {
    if (Array.isArray(payload)) return { data: payload as TRecord[] }
    if (isRecord(payload) && Array.isArray(payload.data)) {
      const nestedMeta = isRecord(payload.meta) ? payload.meta : undefined
      const source = nestedMeta ? { ...payload, ...nestedMeta } : payload
      const meta = collectMeta(source)
      return meta ? { data: payload.data as TRecord[], meta } : { data: payload.data as TRecord[] }
    }
    return { data: [] }
  },
  normalizeRecord: <TRecord extends object>(payload: unknown): RecordResult<TRecord> => {
    if (!isRecord(payload)) return undefined
    if (isRecord(payload.data)) return payload.data as TRecord
    return payload as TRecord
  },
  normalizeError: (error: unknown): SubmitError => {
    if (error instanceof Error) return { message: error.message }
    if (isRecord(error) && typeof error.message === 'string') return { message: error.message }
    return { message: 'Request failed.' }
  },
}

/**
 * Default query location: in-memory. Core components never import the router;
 * the application supplies a router-backed adapter.
 */
export function createMemoryQueryLocationAdapter(): QueryLocationAdapter {
  const values = new Map<QueryNamespace, QueryValues>()
  const listeners = new Map<QueryNamespace, Set<(values: QueryValues) => void>>()

  return {
    read: (namespace) => ({ ...(values.get(namespace) ?? {}) }),
    write: (namespace, next) => {
      values.set(namespace, { ...next })
      listeners.get(namespace)?.forEach((listener) => listener({ ...next }))
    },
    watch: (namespace, onChange) => {
      const registered = listeners.get(namespace) ?? new Set()
      registered.add(onChange)
      listeners.set(namespace, registered)
      return () => registered.delete(onChange)
    },
  }
}

export const defaultQueryRuntimeDefaults: Required<QueryRuntimeDefaults> = {
  staleTime: 30_000,
  retry: 1,
  refetchOnWindowFocus: false,
}

/** Permissive by default: the backend, not the UI, is the security boundary. */
export const defaultAccessAdapter: AccessAdapter = { allows: () => true }

export const defaultUiAdapter: UiAdapter = {
  colorPreference: () => ({ value: 'light' }),
}

export function resolveFrameworkAdapters(input: FrameworkAdaptersInput = {}): ResolvedFrameworkAdapters {
  return {
    data: { ...defaultDataAdapter, ...input.data },
    query: input.query ?? createMemoryQueryLocationAdapter(),
    schemas: input.schemas,
    access: input.access ?? defaultAccessAdapter,
    queryDefaults: { ...defaultQueryRuntimeDefaults, ...input.queryDefaults },
    ui: input.ui ?? defaultUiAdapter,
  }
}

export const frameworkAdaptersKey: InjectionKey<ResolvedFrameworkAdapters> = Symbol.for('loom-adapters')

export function useFrameworkAdapters(): ResolvedFrameworkAdapters {
  const adapters = inject(frameworkAdaptersKey)
  if (!adapters) throw new Error('[loom] FrameworkPlugin is not installed.')
  return adapters
}

/**
 * UI signals degrade to defaults outside plugin install; they are cosmetic,
 * never behavioral, so missing injection must not break rendering.
 */
export function useFrameworkUi(): UiAdapter {
  return inject(frameworkAdaptersKey)?.ui ?? defaultUiAdapter
}
