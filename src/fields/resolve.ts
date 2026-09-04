/**
 * Surface projection and merge semantics.
 *
 * Precedence, lowest to highest:
 *
 *   project-wide defaults < inferred schema metadata < shared field entry
 *   < surface projection < component-instance override
 *
 * `undefined` inherits, `null` clears, arrays replace, functions replace, and
 * `props` objects shallow-merge layer by layer. A surface projection of `false`
 * excludes the field from that surface entirely.
 */
import type {
  FieldBehavior,
  FieldCatalog,
  FieldDefinition,
  FieldRead,
  FieldsInput,
  FieldValidate,
  FieldWrite,
  FieldInitialValue,
  ResolvedField,
} from '../contracts'
import { getSchemaKind, setSchemaKind } from './schemaMetadata'

export type FieldSurface = 'table' | 'detail' | 'form'

/** One merge layer: the shared metadata any surface may carry. */
export interface FieldLayer {
  label?: string | null
  renderer?: string | null
  props?: Record<string, unknown> | null
  source?: unknown | null
  format?: string | null
  sortable?: boolean | null
  align?: 'start' | 'center' | 'end' | null
  class?: string | null
  headerClass?: string | null
  emphasis?: 'strong' | 'muted' | null
  span?: number | null
  behavior?: FieldBehavior | null
  read?: FieldRead<any, unknown>
  validate?: FieldValidate
  write?: FieldWrite
  initialValue?: FieldInitialValue
}

export interface ResolvedSurfaceField<
  TRecord extends object = Record<string, unknown>,
  TDraft extends object = TRecord,
> {
  key: string
  label: string
  renderer?: string
  props: Record<string, unknown>
  source?: unknown
  read?: FieldRead<TRecord, unknown>
  validate?: FieldValidate<unknown>
  write?: FieldWrite<unknown>
  initialValue?: FieldInitialValue<unknown>
  /** Form surface only; table and detail carry no behavior block. */
  behavior?: FieldBehavior<TDraft>
  format?: string
  sortable?: boolean
  align?: 'start' | 'center' | 'end'
  class?: string
  headerClass?: string
  emphasis?: 'strong' | 'muted'
  span?: number
}

export interface FieldResolutionOptions<
  TRecord extends object = Record<string, unknown>,
  TDraft extends object = TRecord,
> {
  fields: FieldsInput<TRecord, TDraft>
  surface: FieldSurface
  /** Field order; defaults to catalog declaration order. */
  keys?: readonly string[]
  /** Project-wide defaults applied to every field. */
  defaults?: FieldLayer
  /** Project defaults selected by normalized field key. */
  defaultFields?: FieldCatalog<TRecord, TDraft>
  /** Metadata inferred from schemas (plan 003), per field key. */
  schema?: Record<string, FieldLayer>
  /** Component-instance overrides, per field key. */
  overrides?: Record<string, FieldLayer>
}

const layerKeys = [
  'label',
  'renderer',
  'format',
  'sortable',
  'align',
  'class',
  'headerClass',
  'emphasis',
  'span',
  'behavior',
  'read',
  'validate',
  'write',
  'initialValue',
] as const

/** Normalizes either accepted `fields` shape into a catalog plus its order. */
export function toCatalog<TRecord extends object, TDraft extends object>(
  fields: FieldsInput<TRecord, TDraft>,
): { catalog: FieldCatalog<TRecord, TDraft>; order: string[] } {
  if (Array.isArray(fields)) {
    const catalog: FieldCatalog<TRecord, TDraft> = {}
    const order: string[] = []
    for (const field of fields as readonly ResolvedField<TRecord, TDraft>[]) {
      const { key, ...definition } = field
      catalog[key] = definition
      order.push(key)
    }
    return { catalog, order }
  }
  const catalog = fields as FieldCatalog<TRecord, TDraft>
  return { catalog, order: Object.keys(catalog) }
}

function surfaceLayer(definition: FieldDefinition, surface: FieldSurface): FieldLayer | false {
  const projection = definition[surface]
  if (projection === false) return false
  const display = surface === 'form' ? undefined : definition.display
  const merged: FieldLayer = { ...(display as FieldLayer | undefined), ...(projection as FieldLayer | undefined) }
  return merged
}

export function mergeFieldLayers(layers: readonly (FieldLayer | undefined)[]): FieldLayer {
  const result: FieldLayer = {}
  let props: Record<string, unknown> | null | undefined
  let source: unknown
  let hasSource = false

  for (const layer of layers) {
    if (!layer) continue
    for (const key of layerKeys) {
      const value = layer[key]
      if (value === undefined) continue
      ;(result as Record<string, unknown>)[key] = value === null ? undefined : value
    }
    if (layer.props === null) props = undefined
    else if (layer.props !== undefined) props = { ...(props ?? {}), ...layer.props }
    if (layer.source !== undefined) {
      hasSource = layer.source !== null
      source = layer.source
    }
    const schemaKind = getSchemaKind(layer)
    if (schemaKind !== undefined) setSchemaKind(result, schemaKind)
  }

  result.props = props ?? {}
  if (hasSource) result.source = source
  return result
}

/** Projects a catalog into one surface, in order, applying every merge layer. */
export function resolveFields<
  TRecord extends object = Record<string, unknown>,
  TDraft extends object = TRecord,
>(options: FieldResolutionOptions<TRecord, TDraft>): ResolvedSurfaceField<TRecord, TDraft>[] {
  const { catalog, order } = toCatalog(options.fields)
  const keys = options.keys ?? order
  const resolved: ResolvedSurfaceField<TRecord, TDraft>[] = []

  for (const key of keys) {
    const definition = catalog[key]
    if (!definition) throw new Error(`[loom] Unknown field "${key}".`)

    const defaultDefinition = options.defaultFields?.[key]
    const defaultProjection = defaultDefinition
      ? surfaceLayer(defaultDefinition as FieldDefinition, options.surface)
      : undefined
    const projection = surfaceLayer(definition as FieldDefinition, options.surface)
    if (projection === false) continue
    if (definition[options.surface] === undefined && defaultProjection === false) continue

    const merged = mergeFieldLayers([
      options.defaults,
      defaultDefinition
        ? { label: defaultDefinition.label, ...(defaultProjection === false ? {} : defaultProjection) }
        : undefined,
      options.schema?.[key],
      { label: definition.label },
      projection,
      options.overrides?.[key],
    ])

    const field: ResolvedSurfaceField<TRecord, TDraft> = {
      key,
      label: merged.label ?? key,
      props: merged.props ?? {},
    }
    if (merged.read !== undefined) field.read = merged.read
    if (options.surface === 'form') {
      if (merged.validate !== undefined) field.validate = merged.validate
      if (merged.write !== undefined) field.write = merged.write
      if (merged.initialValue !== undefined) field.initialValue = merged.initialValue
    }
    if (merged.source !== undefined) field.source = merged.source
    const schemaKind = getSchemaKind(merged)
    if (schemaKind !== undefined) setSchemaKind(field, schemaKind)

    if (merged.renderer != null) field.renderer = merged.renderer
    if (merged.format != null) field.format = merged.format
    if (merged.sortable != null) field.sortable = merged.sortable
    if (merged.align != null) field.align = merged.align
    if (merged.class != null) field.class = merged.class
    if (merged.headerClass != null) field.headerClass = merged.headerClass
    if (merged.emphasis != null) field.emphasis = merged.emphasis
    if (merged.span != null) field.span = merged.span
    if (options.surface === 'form' && merged.behavior != null) field.behavior = merged.behavior as FieldBehavior<TDraft>

    resolved.push(field)
  }

  return resolved
}
