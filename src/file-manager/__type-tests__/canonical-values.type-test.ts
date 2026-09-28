import type { AssetValue } from '@southneuhof/loom/assets'
import type { FileManagerPluginOptions, FileManagerValueAdapter, ManagedAsset } from '@southneuhof/loom/file-manager'

const persisted: AssetValue = {
  kind: 'file',
  id: 'uploads/report.pdf',
  url: 'https://files.test/report.pdf',
  name: 'report.pdf',
}

const managed: ManagedAsset = {
  kind: 'file',
  id: persisted.id,
  name: persisted.name,
  previewUrl: persisted.url,
}

const syncValues: FileManagerValueAdapter = {
  fromModel: (value) => {
    const canonical: AssetValue = value
    void canonical
    return managed
  },
  toModel: (asset) => {
    const entry: ManagedAsset = asset
    void entry
    return persisted
  },
}

const asyncValues: FileManagerValueAdapter = {
  fromModel: async (value) => {
    const canonical: AssetValue = value
    void canonical
    return managed
  },
  toModel: async (asset) => {
    const entry: ManagedAsset = asset
    void entry
    return persisted
  },
}

const syncOptions: FileManagerPluginOptions = {
  root: 'uploads/',
  operations: { list: () => ({ data: [managed] }) },
  values: syncValues,
}

const asyncOptions: FileManagerPluginOptions = {
  root: 'uploads/',
  operations: { list: async () => ({ data: [managed] }) },
  values: asyncValues,
}

void [syncOptions, asyncOptions]
