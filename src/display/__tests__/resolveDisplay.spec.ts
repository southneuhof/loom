import { afterEach, describe, expect, it } from 'vitest'
import { configureParser, resetParserConfigForTests } from '@southneuhof/utilities/parse'
import { resolveDisplayFields, resolveDisplayValue } from '../resolveDisplay'

afterEach(resetParserConfigForTests)

describe('display resolution', () => {
  it('resolves entry and dictionary labels in ordered field maps', () => {
    const fields = resolveDisplayFields({
      surface: 'detail',
      entries: { displayName: { label: 'Preferred name' }, id: {} },
      labels: { displayName: 'Name', id: 'Identifier' },
    })

    expect(fields.map(({ key, label }) => [key, label])).toEqual([
      ['displayName', 'Preferred name'],
      ['id', 'Identifier'],
    ])
  })

  it('reads a joined relation with one pure accessor and leaves the read model unchanged', () => {
    type UserReadModel = {
      id: string
      roleIds: readonly string[]
      roles: readonly { id: string; name: string }[]
    }
    const record: UserReadModel = Object.freeze({
      id: 'user-1',
      roleIds: Object.freeze(['role-1', 'role-2']),
      roles: Object.freeze([
        Object.freeze({ id: 'role-1', name: 'Admin' }),
        Object.freeze({ id: 'role-2', name: 'Editor' }),
      ]),
    })
    const roleChoice = { identity: 'id', view: 'name' } as const
    const roleNames = (value: UserReadModel) => value.roles.map((role) => role[roleChoice.view]).join(', ')
    const columns = resolveDisplayFields<UserReadModel>({
      surface: 'table',
      entries: { roleIds: { read: roleNames } },
    })
    const fields = resolveDisplayFields<UserReadModel>({
      surface: 'detail',
      entries: { roleIds: { read: roleNames } },
    })

    expect(resolveDisplayValue(record, columns[0]!)).toBe('Admin, Editor')
    expect(resolveDisplayValue(record, fields[0]!)).toBe('Admin, Editor')
    expect(record).toEqual({
      id: 'user-1',
      roleIds: ['role-1', 'role-2'],
      roles: [{ id: 'role-1', name: 'Admin' }, { id: 'role-2', name: 'Editor' }],
    })
  })

  it('uses configured app formatters and rejects unknown formatter keys', () => {
    configureParser({ formatters: { statusCaption: (value) => `Status: ${String(value)}` } })
    const fields = resolveDisplayFields({
      surface: 'table',
      entries: { status: { format: 'statusCaption' } },
    })

    expect(resolveDisplayValue({ status: 'active' }, fields[0]!)).toBe('Status: active')
    expect(() => resolveDisplayFields({
      surface: 'detail',
      entries: { status: { format: 'notConfigured' } },
    })).toThrow('[loom][SURFACE_OPTION_INVALID] Detail field "status" member "format" must be a configured formatter; received "notConfigured".')
  })

  it('requires explicit date formatting and rejects structured fallback values', () => {
    const dateRecord = { createdAt: new Date('2026-01-01T00:00:00Z') }
    const dateField = resolveDisplayFields({ surface: 'table', entries: { createdAt: {} } })[0]!
    const objectField = resolveDisplayFields({ surface: 'detail', entries: { asset: {} } })[0]!

    expect(() => resolveDisplayValue(dateRecord, dateField)).toThrow(
      '[loom][DISPLAY_VALUE_INVALID] Table column "createdAt" produced a Date; expected an explicit date format.',
    )
    expect(() => resolveDisplayValue({ asset: { url: '/file.png' } }, objectField)).toThrow(
      '[loom][DISPLAY_VALUE_INVALID] Detail field "asset" produced an object; expected a renderer or displayable text from the accessor or formatter.',
    )
    expect(resolveDisplayValue({ asset: null }, objectField)).toBeNull()
  })

  it('accepts structured values only when formatting produces text or a renderer handles them', () => {
    configureParser({
      formatters: {
        assetText: (value) => JSON.stringify(value),
        assetIdentity: (value) => value,
      },
    })
    const asset = { url: '/file.png' }
    const textField = resolveDisplayFields({ surface: 'detail', entries: { asset: { format: 'assetText' } } })[0]!
    const identityField = resolveDisplayFields({ surface: 'detail', entries: { asset: { format: 'assetIdentity' } } })[0]!
    const rendererField = resolveDisplayFields({ surface: 'detail', entries: { asset: { renderer: 'assetPreview' } } })[0]!

    expect(resolveDisplayValue({ asset }, textField)).toBe('{"url":"/file.png"}')
    expect(() => resolveDisplayValue({ asset }, identityField)).toThrow(
      '[loom][DISPLAY_VALUE_INVALID] Detail field "asset" produced an object; expected a renderer or displayable text from the accessor or formatter.',
    )
    expect(resolveDisplayValue({ asset }, rendererField)).toEqual(asset)
  })

  it('checks sortable keys against the bound query shape and record key', () => {
    expect(() => resolveDisplayFields({
      surface: 'table',
      entries: { displayName: { read: (record: { name: string }) => record.name, sortable: true, sortKey: 'name' } },
      recordKeys: ['name'],
      queryKeys: ['sort_by'],
    })).not.toThrow()

    expect(() => resolveDisplayFields({
      surface: 'table',
      entries: { displayName: { read: (record: { name: string }) => record.name, sortable: true, sortKey: 'name' } },
      recordKeys: ['name'],
      queryKeys: ['sort_by'],
      querySortKeys: ['status'],
    })).toThrow('[loom][SURFACE_OPTION_INVALID] Table column "displayName" member "sortKey" must be a key in the bound query schema.')

    expect(() => resolveDisplayFields({
      surface: 'table',
      entries: { displayName: { read: (record: { name: string }) => record.name, sortable: true, sortKey: 'name' } },
      recordKeys: ['name'],
      queryKeys: ['page'],
    })).toThrow('[loom][SURFACE_OPTION_INVALID] Table column "displayName" member "sortKey" must be a bound query schema with a sort_by key.')
  })
})
