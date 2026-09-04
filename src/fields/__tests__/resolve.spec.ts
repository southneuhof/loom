import { describe, expect, it } from 'vitest'
import { resolveFields, toCatalog } from '../resolve'
import { readField, readFields } from '../access'
import type { FieldDefinition } from '../../contracts'

interface Role extends Record<string, unknown> {
  id: string
  name: string
  rel_section_id: string
  status_code: string
  latitude: number
  longitude: number
}

const roleFields = {
  name: {
    label: 'Nama',
    table: { sortable: true },
    form: { renderer: 'text' },
  },
  section_id: {
    label: 'Ruas',
    display: { read: (record) => record.rel_section_id },
  },
  status_code: {
    label: 'Status',
    display: { renderer: 'chip', props: { options: ['open'] } },
    form: { renderer: 'radio', props: { options: ['open', 'closed'] } },
  },
  secret: {
    label: 'Secret',
    table: false,
    detail: false,
  },
  location: {
    label: 'Lokasi',
    display: { read: (record) => ({ latitude: record.latitude, longitude: record.longitude }) },
    form: { write: (value) => value },
  },
} satisfies Record<string, FieldDefinition<Role>>

describe('field resolution', () => {
  it('keeps the caller order and falls back to the key as a label', () => {
    const resolved = resolveFields({ fields: roleFields, surface: 'table', keys: ['status_code', 'name'] })

    expect(resolved.map((field) => field.key)).toEqual(['status_code', 'name'])
    expect(resolveFields({ fields: { untitled: {} }, surface: 'table' })[0].label).toBe('untitled')
  })

  it('excludes fields whose surface projection is false', () => {
    expect(resolveFields({ fields: roleFields, surface: 'table' }).map((field) => field.key)).not.toContain('secret')
    expect(resolveFields({ fields: roleFields, surface: 'form' }).map((field) => field.key)).toContain('secret')
  })

  it('projects shared display config into table and detail but lets the surface win', () => {
    const [status] = resolveFields({ fields: roleFields, surface: 'table', keys: ['status_code'] })
    const [formStatus] = resolveFields({ fields: roleFields, surface: 'form', keys: ['status_code'] })

    expect(status.renderer).toBe('chip')
    expect(status.props).toEqual({ options: ['open'] })
    expect(formStatus.renderer).toBe('radio')
    expect(formStatus.props).toEqual({ options: ['open', 'closed'] })
  })

  it('applies every precedence layer in order', () => {
    const [field] = resolveFields({
      fields: { name: { label: 'Entry', table: { renderer: 'entry', props: { size: 'md' } } } },
      surface: 'table',
      defaults: { renderer: 'default', props: { size: 'sm', dense: true } },
      schema: { name: { renderer: 'schema' } },
      overrides: { name: { renderer: 'instance', props: { dense: false } } },
    })

    expect(field.renderer).toBe('instance')
    expect(field.props).toEqual({ size: 'md', dense: false })
    expect(field.label).toBe('Entry')
  })

  it('applies keyed project defaults below schema and resource metadata', () => {
    const [field] = resolveFields({
      fields: { statusCode: { table: { renderer: 'resource' } } },
      surface: 'table',
      defaults: { props: { dense: true } },
      defaultFields: {
        statusCode: {
          label: 'Status',
          display: { renderer: 'chip', props: { color: 'neutral' } },
          table: { align: 'center', class: 'whitespace-nowrap' },
        },
      },
      schema: { statusCode: { props: { color: 'warning' } } },
    })

    expect(field).toMatchObject({
      label: 'Status',
      renderer: 'resource',
      align: 'center',
      class: 'whitespace-nowrap',
      props: { dense: true, color: 'warning' },
    })
  })

  it('treats null as an explicit clear and undefined as inherit', () => {
    const [cleared] = resolveFields({
      fields: { name: { table: { renderer: 'entry' } } },
      surface: 'table',
      overrides: { name: { renderer: null, props: null } },
      defaults: { props: { dense: true } },
    })

    expect(cleared.renderer).toBeUndefined()
    expect(cleared.props).toEqual({})
  })

  it('carries form source with precedence and null clearing', () => {
    const [overridden] = resolveFields({
      fields: { name: { form: { source: 'field' } } },
      surface: 'form',
      defaults: { source: 'defaults' },
      overrides: { name: { source: 'override' } },
    })
    const [cleared] = resolveFields({ fields: { name: { form: { source: 'field' } } }, surface: 'form', overrides: { name: { source: null } } })
    expect(overridden.source).toBe('override')
    expect(cleared.source).toBeUndefined()
  })

  it('carries behavior only on the form surface', () => {
    const fields = { name: { form: { behavior: { visible: () => true } } } }

    expect(resolveFields({ fields, surface: 'form' })[0].behavior).toBeDefined()
    expect(resolveFields({ fields, surface: 'table' })[0].behavior).toBeUndefined()
  })

  it('keeps schema renderer metadata separate from field definitions', () => {
    expect(resolveFields({
      fields: { amount: { form: { renderer: 'number' } } },
      surface: 'form',
      schema: { amount: { renderer: 'number' } },
    })[0]).toMatchObject({ renderer: 'number' })
  })

  it('keeps compatible alternate string renderers valid', () => {
    expect(resolveFields({
      fields: { name: { form: { renderer: 'text' } } },
      surface: 'form',
      schema: { name: { renderer: 'text' } },
    })[0]).toMatchObject({ renderer: 'text' })
  })

  it('rejects unknown field keys', () => {
    expect(() => resolveFields({ fields: roleFields, surface: 'table', keys: ['missing'] })).toThrow('Unknown field "missing"')
  })

  it('accepts a resolved field list as well as a catalog', () => {
    const { catalog, order } = toCatalog([{ key: 'name', label: 'Nama' }])

    expect(order).toEqual(['name'])
    expect(catalog.name.label).toBe('Nama')
  })
})

describe('field access', () => {
  const record: Role = {
    id: '1',
    name: 'Admin',
    rel_section_id: 'section-9',
    status_code: 'open',
    latitude: 1,
    longitude: 2,
  }

  it('reads ordinary fields by key and computed fields through display.read', () => {
    expect(readField(record, 'name', roleFields.name)).toBe('Admin')
    expect(readField(record, 'section_id', roleFields.section_id)).toBe('section-9')
    expect(readField(record, 'location', roleFields.location)).toEqual({ latitude: 1, longitude: 2 })
  })

  it('returns undefined for null records', () => {
    expect(readField(null, 'name', roleFields.name)).toBeUndefined()
    expect(readField(undefined, 'section_id', roleFields.section_id)).toBeUndefined()
  })

  it('reads a whole record against a resolved field list', () => {
    const fields = resolveFields({ fields: roleFields, surface: 'detail', keys: ['name', 'section_id'] })

    expect(readFields(record, fields)).toEqual({ name: 'Admin', section_id: 'section-9' })
  })
})
