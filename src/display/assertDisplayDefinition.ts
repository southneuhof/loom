type DisplaySurface = 'table' | 'detail'

type InvalidDisplayOption = (surface: DisplaySurface, key: string, member: string, expected: string) => never

const tableMembers = new Set(['label', 'read', 'renderer', 'props', 'format', 'sortable', 'sortKey', 'align', 'class', 'headerClass'])
const detailMembers = new Set(['label', 'read', 'renderer', 'props', 'format', 'emphasis', 'span'])
const reservedProps = new Set([
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

export function assertSafeDisplayKey(
  key: PropertyKey,
  invalidOption: (key: PropertyKey, expected: string) => never,
): asserts key is string {
  if (typeof key !== 'string' || key === '__proto__' || key === 'prototype' || key === 'constructor' || /^\d+$/.test(key)) {
    invalidOption(key, 'a safe named key')
  }
}

export function assertDisplayEntry(
  surface: DisplaySurface,
  key: string,
  entry: unknown,
  invalidOption: InvalidDisplayOption,
): asserts entry is Record<string, unknown> {
  const owner = surface === 'table' ? 'TableColumn' : 'DetailField'
  if (!isRecord(entry)) invalidOption(surface, key, 'definition', `a ${owner} object`)

  const allowed = surface === 'table' ? tableMembers : detailMembers

  for (const member of Reflect.ownKeys(entry)) {
    if (typeof member !== 'string' || !allowed.has(member)) {
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
    for (const member of reservedProps) {
      if (Object.hasOwn(entry.props, member)) {
        invalidOption(surface, key, `props.${member}`, 'supplied by the display surface')
      }
    }
  }
  if ('format' in entry && typeof entry.format !== 'string') invalidOption(surface, key, 'format', 'a format key')

  if (surface === 'table') {
    if ('sortable' in entry && typeof entry.sortable !== 'boolean') invalidOption(surface, key, 'sortable', 'a boolean')
    if ('sortKey' in entry && typeof entry.sortKey !== 'string') invalidOption(surface, key, 'sortKey', 'a record key')
    if (entry.sortable === true && typeof entry.read === 'function' && (!Object.hasOwn(entry, 'sortKey') || !entry.sortKey)) {
      invalidOption(surface, key, 'sortKey', 'present for a sortable accessor')
    }
    if ('align' in entry && !['start', 'center', 'end'].includes(String(entry.align))) {
      invalidOption(surface, key, 'align', 'start, center, or end')
    }
    if ('class' in entry && typeof entry.class !== 'string') invalidOption(surface, key, 'class', 'a string')
    if ('headerClass' in entry && typeof entry.headerClass !== 'string') invalidOption(surface, key, 'headerClass', 'a string')
  } else {
    if ('emphasis' in entry && !['strong', 'muted'].includes(String(entry.emphasis))) {
      invalidOption(surface, key, 'emphasis', 'strong or muted')
    }
    if ('span' in entry && (typeof entry.span !== 'number' || !Number.isInteger(entry.span) || entry.span < 1)) {
      invalidOption(surface, key, 'span', 'a positive integer')
    }
  }
}
