import { hasFormatter, parse } from '@southneuhof/utilities/parse'
import type { DetailField } from '../contracts/details'
import type { DisplayField } from '../contracts/display'
import type { LabelDictionary } from '../contracts/labels'
import type { TableColumn } from '../contracts/tables'
import { resolveLabel } from '../labels/resolveLabel'
import { displayValueRequirement } from './requirements'
import { assertDisplayEntry, assertSafeDisplayKey } from './assertDisplayDefinition'

export type DisplaySurface = 'table' | 'detail'

export interface ResolvedDisplayField<TRecord extends object = Record<string, unknown>>
  extends Omit<DisplayField<TRecord, unknown>, 'props'> {
  readonly key: string
  readonly label: string
  readonly props: Readonly<Record<string, unknown>>
  readonly surface: DisplaySurface
  readonly sortable?: boolean
  readonly sortKey?: string
  readonly align?: 'start' | 'center' | 'end'
  readonly class?: string
  readonly headerClass?: string
  readonly emphasis?: 'strong' | 'muted'
  readonly span?: number
}

type DisplayEntry<TRecord extends object> = TableColumn<TRecord> | DetailField<TRecord>

interface ResolveDisplayOptions<TRecord extends object, TEntry extends DisplayEntry<TRecord>> {
  surface: DisplaySurface
  entries: Readonly<Record<string, TEntry>>
  labels?: LabelDictionary
  recordKeys?: readonly string[]
  queryKeys?: readonly string[]
  querySortKeys?: readonly string[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function invalidOption(surface: DisplaySurface, key: string, member: string, expected: string): never {
  const owner = surface === 'table' ? 'Table column' : 'Detail field'
  throw new Error(`[loom][SURFACE_OPTION_INVALID] ${owner} "${key}" member "${member}" must be ${expected}.`)
}

function validateEntry<TRecord extends object>(
  surface: DisplaySurface,
  key: string,
  entry: unknown,
  recordKeys: readonly string[] | undefined,
  queryKeys?: readonly string[],
  querySortKeys?: readonly string[],
): asserts entry is DisplayEntry<TRecord> {
  assertDisplayEntry(surface, key, entry, invalidOption)

  if (surface === 'table') {
    if (typeof entry.sortKey === 'string' && recordKeys && !recordKeys.includes(entry.sortKey)) {
      invalidOption(surface, key, 'sortKey', 'a key in the record schema')
    }
    const sortKey = typeof entry.sortKey === 'string' ? entry.sortKey : key
    if (entry.sortable === true && queryKeys && !queryKeys.includes('sort_by')) {
      invalidOption(surface, key, 'sortKey', 'a bound query schema with a sort_by key')
    }
    if (entry.sortable === true && querySortKeys && !querySortKeys.includes(sortKey)) {
      invalidOption(surface, key, 'sortKey', 'a key in the bound query schema')
    }
  }

  if (recordKeys && !recordKeys.includes(key) && typeof entry.read !== 'function') {
    invalidOption(surface, key, 'read', 'present for a key outside the record schema')
  }
  if (typeof entry.format === 'string' && !hasFormatter(entry.format)) {
    invalidOption(surface, key, 'format', `a configured formatter; received "${entry.format}"`)
  }
}

export function resolveDisplayFields<TRecord extends object>(
  options: ResolveDisplayOptions<TRecord, TableColumn<TRecord>> & { surface: 'table' },
): ResolvedDisplayField<TRecord>[]
export function resolveDisplayFields<TRecord extends object>(
  options: ResolveDisplayOptions<TRecord, DetailField<TRecord>> & { surface: 'detail' },
): ResolvedDisplayField<TRecord>[]
export function resolveDisplayFields<TRecord extends object>(
  options: ResolveDisplayOptions<TRecord, DisplayEntry<TRecord>>,
): ResolvedDisplayField<TRecord>[] {
  const { surface, entries, labels, recordKeys, queryKeys, querySortKeys } = options
  if (!isRecord(entries)) {
    const owner = surface === 'table' ? 'Table' : 'Detail'
    throw new Error(`[loom][SURFACE_OPTION_INVALID] ${owner} entries must be an ordered map.`)
  }
  if (labels !== undefined && !isRecord(labels)) {
    const owner = surface === 'table' ? 'Table' : 'Detail'
    throw new Error(`[loom][SURFACE_OPTION_INVALID] ${owner} labels must be a label dictionary.`)
  }

  return Reflect.ownKeys(entries).map((key) => {
    assertSafeDisplayKey(key, (invalidKey, expected) => {
      const owner = surface === 'table' ? 'Table' : 'Detail'
      throw new Error(`[loom][SURFACE_OPTION_INVALID] ${owner} entry key "${String(invalidKey)}" must be ${expected}.`)
    })
    const entry = entries[key]
    validateEntry<TRecord>(surface, key, entry, recordKeys, queryKeys, querySortKeys)
    const props: unknown = Reflect.get(entry, 'props')
    const resolved: ResolvedDisplayField<TRecord> = {
      ...entry,
      key,
      label: resolveLabel(key, entry.label, labels),
      props: isRecord(props) ? { ...props } : {},
      surface,
    }
    return resolved
  })
}

function invalidValue<TRecord extends object>(
  field: ResolvedDisplayField<TRecord>,
  value: unknown,
  requirement: 'date-format' | 'text-or-renderer',
): never {
  const owner = field.surface === 'table' ? 'Table column' : 'Detail field'
  const type = value instanceof Date ? 'a Date' : Array.isArray(value) ? 'an array' : typeof value === 'object' ? 'an object' : typeof value
  const expected = requirement === 'date-format'
    ? 'an explicit date format'
    : 'a renderer or displayable text from the accessor or formatter'
  throw new Error(`[loom][DISPLAY_VALUE_INVALID] ${owner} "${field.key}" produced ${type}; expected ${expected}.`)
}

export function assertDisplayFormatter<TRecord extends object>(field: ResolvedDisplayField<TRecord>): void {
  if (field.format !== undefined && !hasFormatter(field.format)) {
    const owner = field.surface === 'table' ? 'Table column' : 'Detail field'
    throw new Error(`[loom][SURFACE_OPTION_INVALID] ${owner} "${field.key}" format "${field.format}" is not registered.`)
  }
}

export function readDisplayValue<TRecord extends object>(
  record: TRecord,
  field: ResolvedDisplayField<TRecord>,
): unknown {
  return field.read ? field.read(record) : Reflect.get(record, field.key)
}

export function formatDisplayValue<TRecord extends object>(
  rawValue: unknown,
  field: ResolvedDisplayField<TRecord>,
): unknown {
  assertDisplayFormatter(field)
  const value = field.format && rawValue != null ? parse(field.format, rawValue) : rawValue
  const requirement = displayValueRequirement(value, field)
  if (requirement) invalidValue(field, value, requirement)
  return value
}

export function resolveDisplayValue<TRecord extends object>(
  record: TRecord,
  field: ResolvedDisplayField<TRecord>,
): unknown {
  return formatDisplayValue(readDisplayValue(record, field), field)
}
