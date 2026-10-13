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
} from '../contracts'
import type { SchemaIssue } from '../contracts/schema'
import type { AssetAdapter } from '../assets/contracts'

export interface DataAdapter {
  /** Normalizes any backend collection envelope into rows plus metadata. */
  normalizeCollection: <TRecord extends object>(payload: unknown) => CollectionResult<TRecord>
  /** Normalizes any backend record envelope into one record. */
  normalizeRecord: <TRecord extends object>(payload: unknown) => RecordResult<TRecord>
  /** Normalizes a rejected request into a message plus field issues. */
  normalizeError: (error: unknown) => SubmitError
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
  /** UI access policy. Backend authorization stays authoritative. */
  access?: AccessAdapter
  queryDefaults?: QueryRuntimeDefaults
  /** UI environment signals; defaults to a static light scheme. */
  ui?: UiAdapter
  assets?: AssetAdapter
}

export interface ResolvedFrameworkAdapters {
  data: DataAdapter
  query: QueryLocationAdapter
  access: AccessAdapter
  queryDefaults: Required<QueryRuntimeDefaults>
  ui: UiAdapter
  assets?: AssetAdapter
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

function isSchemaIssue(value: unknown): value is SchemaIssue {
  if (!isRecord(value) || !Array.isArray(value.path) || typeof value.message !== 'string') return false
  return value.path.every((part) => typeof part === 'string' || typeof part === 'number')
    && (value.kind === undefined || value.kind === 'operational')
}

function readSchemaIssues(value: unknown): SchemaIssue[] | undefined {
  if (!Array.isArray(value)) return undefined
  const issues = value.filter(isSchemaIssue)
  return issues.length > 0 ? issues : undefined
}

function isRefreshCallback(value: unknown): value is () => Promise<void> {
  return typeof value === 'function'
}

function submitErrorMetadata(error: unknown): Pick<SubmitError, 'code' | 'operation' | 'retryable' | 'postWrite' | 'writeOutcome' | 'result' | 'refresh'> {
  if (!isRecord(error)) return {}
  const refresh = error.refresh
  return {
    ...(typeof error.code === 'string' ? { code: error.code } : {}),
    ...(typeof error.operation === 'string' ? { operation: error.operation } : {}),
    ...(typeof error.retryable === 'boolean' ? { retryable: error.retryable } : {}),
    ...(typeof error.postWrite === 'boolean' ? { postWrite: error.postWrite } : {}),
    ...(error.writeOutcome === 'uncertain' || error.writeOutcome === 'confirmed' ? { writeOutcome: error.writeOutcome } : {}),
    ...(Object.hasOwn(error, 'result') ? { result: error.result } : {}),
    ...(isRefreshCallback(refresh) ? { refresh } : {}),
  }
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
    if (error instanceof Error) {
      const issues = isRecord(error) ? readSchemaIssues(error.issues) : undefined
      return { message: error.message, ...submitErrorMetadata(error), ...(issues ? { issues } : {}) }
    }
    if (isRecord(error) && typeof error.message === 'string') {
      const issues = readSchemaIssues(error.issues)
      return { message: error.message, ...submitErrorMetadata(error), ...(issues ? { issues } : {}) }
    }
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
  if (input.assets !== undefined && (
    !input.assets
    || typeof input.assets.read !== 'function'
    || typeof input.assets.preview !== 'function'
    || typeof input.assets.upload !== 'function'
  )) {
    throw new Error('[loom] Asset adapter must provide read, preview, and upload functions.')
  }
  return {
    data: { ...defaultDataAdapter, ...input.data },
    query: input.query ?? createMemoryQueryLocationAdapter(),
    access: input.access ?? defaultAccessAdapter,
    queryDefaults: { ...defaultQueryRuntimeDefaults, ...input.queryDefaults },
    ui: input.ui ?? defaultUiAdapter,
    ...(input.assets ? { assets: input.assets } : {}),
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
