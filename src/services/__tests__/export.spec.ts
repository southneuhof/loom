import { afterEach, describe, expect, it, vi } from 'vitest'
import * as XLSX from 'xlsx'
import { configureParser, resetParserConfigForTests } from '@southneuhof/utilities/parse'
import { resolveDisplayFields, resolveDisplayValue } from '../../display/resolveDisplay'
import { createWorkbook } from '../excel'
import { exportTableRows } from '../export'

const download = vi.hoisted(() => ({ workbook: undefined as unknown, filename: '' }))

vi.mock('../excel', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../excel')>()
  return {
    ...actual,
    downloadWorkbook: (workbook: unknown, filename: string) => {
      download.workbook = workbook
      download.filename = filename
    },
  }
})

afterEach(() => {
  resetParserConfigForTests()
  download.workbook = undefined
  download.filename = ''
  vi.restoreAllMocks()
})

describe('display export', () => {
  it('exports selected columns through accessors and preserves paging, mapping, search, and filename', async () => {
    type RoleRecord = { id: number; roleId: number; internalNote: string }
    const columns = resolveDisplayFields<RoleRecord>({
      surface: 'table',
      entries: {
        roleId: { label: 'Role', read: (record) => record.roleId },
        id: { label: 'Identifier' },
      },
    })
    const load = vi.fn(async ({ query }: { query: Record<string, unknown> }) => {
      const page = Number(query.page)
      const data = page === 1
        ? [{ id: 1, roleId: 7, internalNote: 'one' }, { id: 2, roleId: 9, internalNote: 'two' }]
        : [{ id: 3, roleId: 7, internalNote: 'three' }]
      return { data, meta: { total: 3, pageSize: 2, totalPage: 2 } }
    })
    await exportTableRows({
      activeQuery: { status: 'active' },
      searchParameters: { section: 'north' },
      load,
      columns,
      options: {
        pageSize: 2,
        filename: 'roles',
        mapValue: ({ value }) => value === 7 ? 'Admin' : value === 9 ? 'Editor' : value,
      },
    })

    expect(load.mock.calls.map(([context]) => context.query)).toEqual([
      { status: 'active', page: 1, limit: 2 },
      { status: 'active', page: 2, limit: 2 },
    ])
    expect(load.mock.calls.map(([context]) => context.searchParameters)).toEqual([
      { section: 'north' },
      { section: 'north' },
    ])
    const workbook = download.workbook as XLSX.WorkBook
    expect(download.filename).toBe('roles')
    expect(XLSX.utils.sheet_to_json(workbook.Sheets.Data!, { header: 1 })).toEqual([
      ['Role', 'Identifier'],
      ['Admin', 1],
      ['Editor', 2],
      ['Admin', 3],
    ])
    expect(JSON.stringify(workbook)).not.toContain('internalNote')
  })

  it('writes the same formatted text that the display resolver produces', () => {
    configureParser({ formatters: { uppercase: (value) => String(value).toUpperCase() } })
    const record = { roleName: 'joined role' }
    const columns = resolveDisplayFields({
      surface: 'table',
      entries: { roleName: { format: 'uppercase' } },
      labels: { roleName: 'Role Name' },
    })
    const displayValue = resolveDisplayValue(record, columns[0]!)
    const workbook = createWorkbook([record], columns)
    const values = XLSX.utils.sheet_to_json(workbook.Sheets.Data!, { header: 1 })

    expect(displayValue).toBe('JOINED ROLE')
    expect(values).toEqual([['Role Name'], ['JOINED ROLE']])
  })
})
