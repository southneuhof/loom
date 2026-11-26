type DisplaySurface = 'table' | 'detail'

type InvalidDisplayOption = (surface: DisplaySurface, key: string, member: string, expected: string) => never

const tableMembers = new Set(['label', 'read', 'renderer', 'props', 'format', 'cell', 'sortable', 'sortKey', 'align', 'class', 'headerClass'])
const detailMembers = new Set(['label', 'read', 'renderer', 'props', 'format', 'emphasis', 'span'])
export const cellDisplayMembers = new Set(['read', 'renderer', 'props', 'format'])
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

function assertDetailSections(
  sections: unknown,
  entryKeys: ReadonlySet<string>,
  invalidOption: (member: string, expected: string) => never,
): void {
  if (sections === undefined) return
  if (!Array.isArray(sections)) invalidOption('sections', 'an array of section descriptors')
  const seen = new Set<string>()
  for (const [index, section] of sections.entries()) {
    if (!isRecord(section)) invalidOption(`sections[${index}]`, 'a section object')
    for (const member of Object.keys(section)) {
      if (!['title', 'description', 'fields'].includes(member)) {
        invalidOption(`sections[${index}].${member}`, 'a DetailSection member')
      }
    }
    if (typeof section.title !== 'string' || section.title.trim().length === 0) {
      invalidOption(`sections[${index}].title`, 'a nonempty string')
    }
    if (section.description !== undefined && typeof section.description !== 'string') {
      invalidOption(`sections[${index}].description`, 'a string')
    }
    if (!Array.isArray(section.fields)) invalidOption(`sections[${index}].fields`, 'an array of field keys')
    for (const fieldKey of section.fields) {
      if (typeof fieldKey !== 'string' || !entryKeys.has(fieldKey)) {
        invalidOption(`sections[${index}].fields`, `declared detail field keys (unknown key "${String(fieldKey)}")`)
      }
      if (seen.has(fieldKey)) {
        invalidOption(`sections[${index}].fields`, `unique field keys (duplicate key "${fieldKey}")`)
      }
      seen.add(fieldKey)
    }
  }
}

export function assertDisplayDefinition(surface: DisplaySurface, definition: unknown): void {
  const owner = surface === 'table' ? 'Table' : 'Detail'
  const entriesMember = surface === 'table' ? 'columns' : 'fields'
  const allowedMembers = surface === 'detail' ? ['schema', entriesMember, 'sections', 'labels'] : ['schema', entriesMember, 'labels']
  function invalidOption(member: string, expected: string): never {
    throw new Error(`[loom][SURFACE_OPTION_INVALID] ${owner} member "${member}" must be ${expected}.`)
  }
  if (!isRecord(definition)) invalidOption('definition', 'an object')
  for (const member of Object.keys(definition)) {
    if (!allowedMembers.includes(member)) invalidOption(member, `a ${owner}Definition member`)
  }
  if (!isRecord(definition.schema) || typeof definition.schema.parseAsync !== 'function') invalidOption('schema', 'a raw record schema')
  const entries = definition[entriesMember]
  if (!isRecord(entries)) invalidOption(entriesMember, surface === 'table' ? 'an ordered column map' : 'an ordered detail field map')
  const labels = definition.labels
  if (labels !== undefined) {
    if (!isRecord(labels)) invalidOption('labels', 'a label dictionary')
    for (const [key, label] of Object.entries(labels)) {
      if (typeof label !== 'string' && typeof label !== 'function') invalidOption(`labels.${key}`, 'a string or a function that returns a string')
    }
  }
  const entryKeys = new Set<string>()
  for (const key of Reflect.ownKeys(entries)) {
    assertSafeDisplayKey(key, (invalidKey, expected) => invalidOption(`${entriesMember}.${String(invalidKey)}`, expected))
    entryKeys.add(key)
    const entry = entries[key]
    if (typeof entry !== 'function') {
      assertDisplayEntry(surface, `${entriesMember}.${key}`, entry, (_surface, location, member, expected) => {
        invalidOption(member === 'definition' ? location : `${location}.${member}`, expected)
      })
    }
  }
  if (surface === 'detail') assertDetailSections(definition.sections, entryKeys, invalidOption)
}

export function snapshotDisplayEntries<TEntries extends object>(entries: TEntries): TEntries {
  return Object.fromEntries(Object.entries(entries).map(([key, entry]) => {
    if (!isRecord(entry)) return [key, entry]
    return [key, { ...entry, ...(isRecord(entry.props) ? { props: { ...entry.props } } : {}) }]
  })) as TEntries
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
  allowedMembers?: ReadonlySet<string>,
): asserts entry is Record<string, unknown> {
  const owner = surface === 'table' ? 'TableColumn' : 'DetailField'
  if (!isRecord(entry)) invalidOption(surface, key, 'definition', `a ${owner} object`)

  const allowed = allowedMembers ?? (surface === 'table' ? tableMembers : detailMembers)

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
    if ('cell' in entry && entry.cell !== undefined) {
      for (const member of ['read', 'renderer', 'props', 'format']) {
        if (Object.hasOwn(entry, member)) invalidOption(surface, key, member, 'omitted when cell is supplied')
      }
      if (typeof entry.cell !== 'function') assertDisplayEntry(surface, key, entry.cell, invalidOption, cellDisplayMembers)
    }
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
