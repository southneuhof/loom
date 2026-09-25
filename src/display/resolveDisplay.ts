import { hasFormatter, parse } from '@southneuhof/utilities/parse'
import type { DetailField } from '../contracts/details'
import type { DisplayField } from '../contracts/display'
import type { LabelDictionary } from '../contracts/labels'
import type { TableColumn } from '../contracts/tables'
import { resolveLabel } from '../labels/resolveLabel'
import { displayValueRequirement } from './requirements'

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

const runtimeMembers = new Set([
  'value',
  'modelValue',
  'model-value',
  'onUpdate:modelValue',
  'onUpdate:model-value',
  'record',
  'draft',
  'field',
  'key',
  'index',
  'setValue',
  'onValidation:touch',
  'validation:touch',
])

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
  const owner = surface === 'table' ? 'Table column' : 'Detail field'
  if (!isRecord(entry)) invalidOption(surface, key, 'definition', 'an object')

  const allowed = surface === 'table'
    ? ['label', 'read', 'renderer', 'props', 'format', 'sortable', 'sortKey', 'align', 'class', 'headerClass']
    : ['label', 'read', 'renderer', 'props', 'format', 'emphasis', 'span']

  for (const member of Reflect.ownKeys(entry)) {
    if (typeof member !== 'string' || !allowed.includes(member)) {
      invalidOption(surface, key, String(member), `${owner} member`)
    }
  }
  if ('label' in entry && typeof entry.label !== 'string' && typeof entry.label !== 'function') {
    invalidOption(surface, key, 'label', 'a string or a function that returns a string')
  }
  if ('read' in entry && typeof entry.read !== 'function') invalidOption(surface, key, 'read', 'a function')
  if ('renderer' in entry && typeof entry.renderer !== 'string') invalidOption(surface, key, 'renderer', 'a registered display key')
  if ('props' in entry && !isRecord(entry.props)) invalidOption(surface, key, 'props', 'an object')
  if (isRecord(entry.props)) {
    for (const member of runtimeMembers) {
      if (Object.hasOwn(entry.props, member)) invalidOption(surface, key, `props.${member}`, 'supplied by the display surface')
    }
  }
  if ('format' in entry && typeof entry.format !== 'string') invalidOption(surface, key, 'format', 'a configured formatter key')

  if (surface === 'table') {
    if ('sortable' in entry && typeof entry.sortable !== 'boolean') invalidOption(surface, key, 'sortable', 'a boolean')
    if ('align' in entry && !['start', 'center', 'end'].includes(String(entry.align))) invalidOption(surface, key, 'align', 'start, center, or end')
    if ('class' in entry && typeof entry.class !== 'string') invalidOption(surface, key, 'class', 'a string')
    if ('headerClass' in entry && typeof entry.headerClass !== 'string') invalidOption(surface, key, 'headerClass', 'a string')

    if (entry.sortKey !== undefined && typeof entry.sortKey !== 'string') invalidOption(surface, key, 'sortKey', 'a record key')
    if (typeof entry.sortKey === 'string' && recordKeys && !recordKeys.includes(entry.sortKey)) {
      invalidOption(surface, key, 'sortKey', 'a key in the record schema')
    }
    if (entry.sortable === true && typeof entry.read === 'function' && !entry.sortKey) {
      invalidOption(surface, key, 'sortKey', 'present for a sortable accessor')
    }
    const sortKey = typeof entry.sortKey === 'string' ? entry.sortKey : key
    if (entry.sortable === true && queryKeys && !queryKeys.includes('sort_by')) {
      invalidOption(surface, key, 'sortKey', 'a bound query schema with a sort_by key')
    }
    if (entry.sortable === true && querySortKeys && !querySortKeys.includes(sortKey)) {
      invalidOption(surface, key, 'sortKey', 'a key in the bound query schema')
    }
  } else {
    if ('emphasis' in entry && !['strong', 'muted'].includes(String(entry.emphasis))) invalidOption(surface, key, 'emphasis', 'strong or muted')
    if ('span' in entry && (typeof entry.span !== 'number' || !Number.isInteger(entry.span) || entry.span < 1)) {
      invalidOption(surface, key, 'span', 'a positive integer')
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
    if (typeof key !== 'string' || key === '__proto__' || key === 'prototype' || key === 'constructor' || /^\d+$/.test(key)) {
      const owner = surface === 'table' ? 'Table' : 'Detail'
      throw new Error(`[loom][SURFACE_OPTION_INVALID] ${owner} entry key "${String(key)}" must be a safe named key.`)
    }
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
