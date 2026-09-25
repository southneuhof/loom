import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, type PropType } from 'vue'
import { z } from 'zod'
import { defineResource, resetResourceRuntimeForTests } from '../../../resources'
import Table from '../Table.vue'
import TreeTable from '../TreeTable.vue'
import Detail from '../Detail.vue'
import { FrameworkPlugin } from '../../../adapters/plugin'
import { createFrameworkQueryClient } from '../../../query'
import ImagePreview from '../../base/ImagePreview.vue'
import type { AssetAdapter, AssetValue } from '../../../assets/contracts'
import './browser.css'

type UserReadModel = {
  id: string
  roleIds: readonly string[]
  roles: readonly { id: string; name: string }[]
  status: string
  createdAt: Date
  asset: AssetValue
  children: readonly UserReadModel[]
}

const StatusBadge = defineComponent({
  props: { value: { type: String, required: true } },
  setup: (props) => () => h('span', { class: 'status-badge' }, props.value),
})
const AssetPreview = defineComponent({
  props: { value: { type: Object as PropType<AssetValue>, required: true } },
  setup: (props) => () => h('div', { class: 'asset-preview' }, [h(ImagePreview, { asset: props.value })]),
})
const RoleNames = defineComponent({
  props: {
    value: { type: String, required: true },
    record: { type: Object as PropType<UserReadModel>, required: true },
  },
  setup: (props) => () => h('span', { class: 'role-names', 'data-record-id': props.record.id }, props.value),
})

declare module '../../../renderers/displayContracts' {
  interface DisplayRendererComponents {
    status: typeof StatusBadge
    assetPreview: typeof AssetPreview
    roleNames: typeof RoleNames
  }
}

const apps: ReturnType<typeof createApp>[] = []
const roleChoice = { identity: 'id', view: 'name' } as const
const schema = z.object({
  id: z.string(),
  roleIds: z.array(z.string()),
  roles: z.array(z.object({ id: z.string(), name: z.string() })),
  status: z.string(),
  createdAt: z.date(),
  asset: z.object({ kind: z.literal('file'), id: z.string(), url: z.string(), name: z.string(), mimeType: z.string() }),
  children: z.array(z.unknown()),
})
const record: UserReadModel = Object.freeze({
  id: 'user-1',
  roleIds: Object.freeze(['role-1', 'role-2']),
  roles: Object.freeze([
    Object.freeze({ id: 'role-1', name: 'Admin' }),
    Object.freeze({ id: 'role-2', name: 'Editor' }),
  ]),
  status: 'active',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  asset: Object.freeze({ kind: 'file', id: 'uploads/profile.png', url: '/assets/profile.png', name: 'Profile image', mimeType: 'image/png' }),
  children: Object.freeze([]),
})
const readRoleNames = vi.fn((value: UserReadModel) => value.roles.map((role) => role[roleChoice.view]).join(', '))
const roleDisplay = { read: readRoleNames }
const statusDisplay = { renderer: 'status' }
const dateDisplay = { format: 'date' }
const assetDisplay = { renderer: 'assetPreview' }
const columns = {
  roleIds: { ...roleDisplay, label: 'Roles' },
  status: { ...statusDisplay, label: 'Status' },
  createdAt: { ...dateDisplay, label: 'Created' },
  asset: { ...assetDisplay, label: 'Asset' },
}
const treeColumns = {
  ...columns,
  roleIds: {
    ...roleDisplay,
    label: 'Roles',
    renderer: 'roleNames',
  },
}
const fields = {
  roleIds: { ...roleDisplay, label: 'Roles' },
  status: { ...statusDisplay, label: 'Status' },
  createdAt: { ...dateDisplay, label: 'Created' },
  asset: { ...assetDisplay, label: 'Asset' },
}

function createAssetAdapter(preview: AssetAdapter['preview']): AssetAdapter {
  return {
    read(value) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return null
      const asset = value as Record<string, unknown>
      if (asset.kind !== 'file' || typeof asset.id !== 'string' || typeof asset.url !== 'string'
        || typeof asset.name !== 'string' || typeof asset.mimeType !== 'string') return null
      return {
        kind: 'file',
        id: asset.id,
        url: asset.url,
        name: asset.name,
        mimeType: asset.mimeType,
      }
    },
    preview,
    upload: async (file) => ({ kind: 'file', id: file.name, url: `/assets/${file.name}`, name: file.name }),
  }
}

afterEach(() => {
  apps.splice(0).forEach((app) => app.unmount())
  resetResourceRuntimeForTests()
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

describe('display surface parity', () => {
  it('reuses joined-role, status, and date fragments on primitive and extracted surfaces', async () => {
    readRoleNames.mockClear()
    const previewAsset = vi.fn((value: AssetValue) => ({
      imageURL: `data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=#full-${encodeURIComponent(value.id)}`,
      thumbnailURL: `data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=#thumb-${encodeURIComponent(value.id)}`,
    }))
    const fetchRequest = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response())
    const loadRows = vi.fn(async () => ({ data: [record] }))
    const loadRecord = vi.fn(async () => record)
    const resource = defineResource({
      key: 'display-parity',
      identity: (value: UserReadModel) => value.id,
      list: { permission: null, table: { schema, columns, load: loadRows, pagination: false } },
      detail: { permission: null, detail: () => ({ schema, fields, load: loadRecord }) },
    })
    const host = document.createElement('div')
    document.body.append(host)
    const app = createApp({
      render: () => h('main', [
        h(Table, { schema, columns, data: [record], pagination: false, namespace: 'display-table' }),
        h(TreeTable, {
          schema,
          columns: treeColumns,
          data: [record],
          children: (value: UserReadModel) => value.children,
          treeColumn: 'roleIds',
          pagination: false,
          namespace: 'display-tree',
        }),
        h(TreeTable, {
          schema,
          columns,
          data: [record],
          children: (value: UserReadModel) => value.children,
          treeColumn: 'asset',
          pagination: false,
          namespace: 'display-asset-tree',
        }),
        h(Detail, { schema, fields, data: record }),
        h(Table, resource.list.table),
        h(Detail, resource.detail({ id: record.id, record }).detail),
      ]),
    })
    app.use(FrameworkPlugin, {
      queryClient: createFrameworkQueryClient({ retry: 0, staleTime: 0 }),
      adapters: { assets: createAssetAdapter(previewAsset) },
      renderers: { display: { status: StatusBadge, assetPreview: AssetPreview, roleNames: RoleNames } },
    })
    app.mount(host)
    apps.push(app)
    await vi.waitFor(() => {
      const surfaces = [...host.querySelectorAll<HTMLElement>('.is-table, .is-detail')]
      expect(surfaces).toHaveLength(6)
      expect(surfaces.every((surface) => surface.textContent?.includes('Admin, Editor'))).toBe(true)
    })

    const tables = [...host.querySelectorAll<HTMLElement>('.is-table')]
    const details = [...host.querySelectorAll<HTMLElement>('.is-detail')]
    expect(loadRows).toHaveBeenCalledTimes(1)
    expect(loadRecord).toHaveBeenCalledTimes(1)
    expect(readRoleNames.mock.calls.length).toBeGreaterThanOrEqual(6)
    expect(readRoleNames.mock.calls.every(([value]) => value === record)).toBe(true)
    const treeCellRenderer = host.querySelector<HTMLElement>('.is-tree-table-label .role-names')
    expect(treeCellRenderer?.textContent).toBe('Admin, Editor')
    expect(treeCellRenderer?.dataset.recordId).toBe(record.id)
    const treeAssetImage = host.querySelector<HTMLImageElement>('.is-tree-table-label .asset-preview img')
    const thumbnail = `data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=#thumb-${encodeURIComponent(record.asset.id)}`
    expect(treeAssetImage?.getAttribute('src')).toBe(thumbnail)
    expect(previewAsset).toHaveBeenCalledWith(record.asset)
    const formattedDate = new Intl.DateTimeFormat('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }).format(record.createdAt)
    for (const surface of [...tables, ...details]) {
      expect(surface.textContent).toContain('Roles')
      expect(surface.textContent).toContain('Status')
      expect(surface.textContent).toContain('Created')
      expect(surface.textContent).toContain('Admin, Editor')
      expect(surface.querySelector('.status-badge')?.textContent).toBe('active')
      expect(surface.textContent).toContain(formattedDate)
      expect(surface.querySelector('.asset-preview img')?.getAttribute('src')).toBe(thumbnail)
    }
    expect(fetchRequest).not.toHaveBeenCalled()
    expect(record).toEqual({
      id: 'user-1',
      roleIds: ['role-1', 'role-2'],
      roles: [{ id: 'role-1', name: 'Admin' }, { id: 'role-2', name: 'Editor' }],
      status: 'active',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      asset: { kind: 'file', id: 'uploads/profile.png', url: '/assets/profile.png', name: 'Profile image', mimeType: 'image/png' },
      children: [],
    })
  })
})
