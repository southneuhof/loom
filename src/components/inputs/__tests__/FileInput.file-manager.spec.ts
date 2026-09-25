import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref, type App } from 'vue'
import type { AssetAdapter, AssetValue } from '../../../assets/contracts'
import { FrameworkPlugin } from '../../../adapters/plugin'
import { createFrameworkQueryClient } from '../../../query'
import FileManagerInput from '../../composites/form-inputs/FileManager/FileManagerInput.vue'
import { FileManagerPlugin, type FileManagerPluginOptions, type ManagedAsset } from '../../../file-manager'
import FileInput from '../FileInput.vue'
import ImageInput from '../ImageInput.vue'

const stored: AssetValue = {
  kind: 'file',
  id: 'uploads/report.pdf',
  url: 'https://files.test/report.pdf',
  name: 'report.pdf',
  mimeType: 'application/pdf',
}
const managed: ManagedAsset = {
  kind: 'file',
  id: stored.id,
  name: stored.name,
  mimeType: stored.mimeType,
  previewUrl: stored.url,
}
const secondStored: AssetValue = {
  kind: 'file',
  id: 'uploads/photo.png',
  url: 'https://files.test/photo.png',
  name: 'photo.png',
  mimeType: 'image/png',
}
const secondManaged: ManagedAsset = {
  kind: 'file',
  id: secondStored.id,
  name: secondStored.name,
  mimeType: secondStored.mimeType,
  previewUrl: secondStored.url,
}
const thirdStored: AssetValue = {
  kind: 'file',
  id: 'uploads/avatar.png',
  url: 'https://files.test/avatar.png',
  name: 'avatar.png',
  mimeType: 'image/png',
}
const thirdManaged: ManagedAsset = {
  kind: 'file',
  id: thirdStored.id,
  name: thirdStored.name,
  mimeType: thirdStored.mimeType,
  previewUrl: thirdStored.url,
}
const apps: App[] = []

function assetAdapter(read: AssetAdapter['read']): AssetAdapter {
  return {
    read,
    preview: (asset) => ({ imageURL: asset.url, thumbnailURL: asset.url }),
    upload: async () => stored,
  }
}

function readFixture(value: unknown): AssetValue | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const id = Reflect.get(value, 'id')
  return [stored, secondStored, thirdStored].find((item) => item.id === id) ?? null
}

function fileManagerOptions(toModel: FileManagerPluginOptions<AssetValue>['values']['toModel']): FileManagerPluginOptions<AssetValue> {
  return {
    root: 'uploads/',
    operations: { list: async () => ({ data: [managed, secondManaged, thirdManaged] }) },
    values: { fromModel: () => managed, toModel },
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise })
  return { promise, resolve }
}

async function flush() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await Promise.resolve()
    await nextTick()
  }
}

function findButton(label: string) {
  return [...document.body.querySelectorAll<HTMLButtonElement>('button')]
    .find((button) => button.textContent?.includes(label))
}

afterEach(() => {
  apps.splice(0).forEach((app) => app.unmount())
  document.body.innerHTML = ''
})

describe('FileManager asset selection', () => {
  it('reads selected stored assets through the app service before updating FileInput', async () => {
    const read = vi.fn((value: unknown): AssetValue | null => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return null
      const item = value as Record<string, unknown>
      return item.kind === 'file' && typeof item.id === 'string' && typeof item.url === 'string' && typeof item.name === 'string'
        ? value as AssetValue
        : null
    })
    const model = ref<AssetValue | null>(null)
    const host = document.createElement('div')
    document.body.append(host)
    const app = createApp(defineComponent({
      setup: () => () => h(FileInput, {
        modelValue: model.value,
        'onUpdate:modelValue': (value: AssetValue | null) => { model.value = value },
      }),
    }))
    app.use(FrameworkPlugin, {
      adapters: { assets: assetAdapter(read) },
      queryClient: createFrameworkQueryClient({ retry: 0, staleTime: 0 }),
    })
    app.use(FileManagerPlugin, fileManagerOptions(async () => stored))
    app.mount(host)
    apps.push(app)
    await flush()

    const sourceButton = findButton('Pilih sumber file')
    expect(sourceButton).toBeDefined()
    sourceButton?.click()
    await flush()
    const pickerButton = findButton('Choose from file manager')
    expect(pickerButton).toBeDefined()
    pickerButton?.click()
    await vi.waitFor(() => expect(findButton(stored.name), document.body.textContent).toBeDefined())
    await flush()
    const assetButton = findButton(stored.name)
    expect(assetButton, document.body.textContent).toBeDefined()
    assetButton?.click()
    await flush()

    expect(model.value).toEqual(stored)
    expect(read).toHaveBeenCalledWith(stored)
    expect(host.textContent).toContain(stored.name)
  })

  it('keeps FileManagerInput models canonical through selection and reload', async () => {
    const read = vi.fn((value: unknown): AssetValue | null => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return null
      const item = value as Record<string, unknown>
      return item.kind === 'file' && typeof item.id === 'string' && typeof item.url === 'string' && typeof item.name === 'string'
        ? value as AssetValue
        : null
    })
    const model = ref<AssetValue | null>(null)
    const host = document.createElement('div')
    document.body.append(host)
    const app = createApp(defineComponent({
      setup: () => () => h(FileManagerInput, {
        modelValue: model.value,
        'onUpdate:modelValue': (value: AssetValue | null) => { model.value = value },
      }),
    }))
    app.use(FrameworkPlugin, {
      adapters: { assets: assetAdapter(read) },
      queryClient: createFrameworkQueryClient({ retry: 0, staleTime: 0 }),
    })
    app.use(FileManagerPlugin, fileManagerOptions(async () => stored))
    app.mount(host)
    apps.push(app)
    await flush()

    const trigger = findButton('Pilih berkas')
    expect(trigger).toBeDefined()
    trigger?.click()
    await vi.waitFor(() => expect(findButton(stored.name)).toBeDefined())
    findButton(stored.name)?.click()
    await flush()

    expect(model.value).toEqual(stored)
    expect(read).toHaveBeenCalledWith(stored)
    expect(host.textContent).toContain(stored.name)
  })

  it('does not commit a pending FileManager selection after disable', async () => {
    let resolveModel!: (value: AssetValue) => void
    const model = ref<AssetValue | null>(null)
    const disabled = ref(false)
    const host = document.createElement('div')
    document.body.append(host)
    const app = createApp(defineComponent({
      setup: () => () => h(FileManagerInput, {
        modelValue: model.value,
        disabled: disabled.value,
        'onUpdate:modelValue': (value: AssetValue | null) => { model.value = value },
      }),
    }))
    app.use(FrameworkPlugin, {
      adapters: { assets: assetAdapter((value) => value === stored ? stored : null) },
      queryClient: createFrameworkQueryClient({ retry: 0, staleTime: 0 }),
    })
    app.use(FileManagerPlugin, fileManagerOptions(() => new Promise((resolve) => { resolveModel = resolve })))
    app.mount(host)
    apps.push(app)
    await flush()

    const trigger = findButton('Pilih berkas')
    expect(trigger).toBeDefined()
    trigger?.click()
    await vi.waitFor(() => expect(findButton(stored.name)).toBeDefined())
    const assetButton = findButton(stored.name)
    expect(assetButton).toBeDefined()
    assetButton?.click()
    await flush()
    expect(resolveModel).toBeTypeOf('function')
    disabled.value = true
    await flush()
    resolveModel(stored)
    await flush()

    expect(model.value).toBeNull()
  })

  it('does not commit a pending FileInput asset-picker selection after disable', async () => {
    let resolveModel!: (value: AssetValue) => void
    const model = ref<AssetValue | null>(null)
    const disabled = ref(false)
    const host = document.createElement('div')
    document.body.append(host)
    const app = createApp(defineComponent({
      setup: () => () => h(FileInput, {
        modelValue: model.value,
        disabled: disabled.value,
        'onUpdate:modelValue': (value: AssetValue | null) => { model.value = value },
      }),
    }))
    app.use(FrameworkPlugin, {
      adapters: { assets: assetAdapter((value) => value === stored ? stored : null) },
      queryClient: createFrameworkQueryClient({ retry: 0, staleTime: 0 }),
    })
    app.use(FileManagerPlugin, fileManagerOptions(() => new Promise((resolve) => { resolveModel = resolve })))
    app.mount(host)
    apps.push(app)
    await flush()

    const sourceButton = findButton('Pilih sumber file')
    expect(sourceButton).toBeDefined()
    sourceButton?.click()
    await flush()
    const pickerButton = findButton('Choose from file manager')
    expect(pickerButton).toBeDefined()
    pickerButton?.click()
    await vi.waitFor(() => expect(findButton(stored.name)).toBeDefined())
    const assetButton = findButton(stored.name)
    expect(assetButton).toBeDefined()
    assetButton?.click()
    await flush()
    expect(resolveModel).toBeTypeOf('function')

    disabled.value = true
    await flush()
    resolveModel(stored)
    await flush()

    expect(model.value).toBeNull()
  })

  it('preserves an external FileInput model replacement while a selection is pending', async () => {
    const pending = new Map<string, ReturnType<typeof deferred<AssetValue>>>()
    const model = ref<AssetValue[]>([])
    const updates: Array<AssetValue | AssetValue[] | null> = []
    const host = document.createElement('div')
    document.body.append(host)
    const app = createApp(defineComponent({
      setup: () => () => h(FileInput, {
        multi: true,
        modelValue: model.value,
        'onUpdate:modelValue': (value: AssetValue | AssetValue[] | null) => { updates.push(value); if (Array.isArray(value)) model.value = value },
      }),
    }))
    app.use(FrameworkPlugin, {
      adapters: { assets: assetAdapter(readFixture) },
      queryClient: createFrameworkQueryClient({ retry: 0, staleTime: 0 }),
    })
    app.use(FileManagerPlugin, fileManagerOptions((asset) => {
      const request = deferred<AssetValue>()
      pending.set(asset.id, request)
      return request.promise
    }))
    app.mount(host)
    apps.push(app)
    await flush()

    findButton('Pilih sumber file')?.click()
    await flush()
    findButton('Choose from file manager')?.click()
    await vi.waitFor(() => expect(findButton(stored.name), document.body.textContent).toBeDefined())
    findButton(stored.name)?.click()
    expect([...pending.keys()]).toEqual([stored.id])

    model.value = [secondStored]
    await flush()
    pending.get(stored.id)?.resolve(stored)
    await flush()

    expect(model.value).toEqual([secondStored])
    expect(updates).toEqual([])
  })

  it('preserves an external ImageInput model replacement while a selection is pending', async () => {
    const pending = new Map<string, ReturnType<typeof deferred<AssetValue>>>()
    const imageModel = ref<AssetValue[]>([])
    const updates: Array<AssetValue | AssetValue[] | null> = []
    const host = document.createElement('div')
    document.body.append(host)
    const app = createApp(defineComponent({
      setup: () => () => h(ImageInput, {
        multi: true,
        modelValue: imageModel.value,
        'onUpdate:modelValue': (value: AssetValue | AssetValue[] | null) => { updates.push(value); if (Array.isArray(value)) imageModel.value = value },
      }),
    }))
    app.use(FrameworkPlugin, {
      adapters: { assets: assetAdapter(readFixture) },
      queryClient: createFrameworkQueryClient({ retry: 0, staleTime: 0 }),
    })
    app.use(FileManagerPlugin, fileManagerOptions((asset) => {
      const request = deferred<AssetValue>()
      pending.set(asset.id, request)
      return request.promise
    }))
    app.mount(host)
    apps.push(app)
    await flush()

    const source = [...host.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.querySelector('.ri-image-add'))
    expect(source, host.textContent).toBeDefined()
    source?.click()
    await flush()
    expect(findButton('Choose from file manager')).toBeDefined()
    findButton('Choose from file manager')?.click()
    await vi.waitFor(() => expect(findButton(secondStored.name)).toBeDefined())
    findButton(secondStored.name)?.click()
    expect([...pending.keys()]).toEqual([secondStored.id])

    imageModel.value = [thirdStored]
    await flush()
    pending.get(secondStored.id)?.resolve(secondStored)
    await flush()
    expect(imageModel.value).toEqual([thirdStored])
    expect(updates).toEqual([])
  })

  it('preserves an external FileManagerInput model replacement while a selection is pending', async () => {
    const pending = new Map<string, ReturnType<typeof deferred<AssetValue>>>()
    const model = ref<AssetValue[]>([])
    const host = document.createElement('div')
    document.body.append(host)
    const app = createApp(defineComponent({
      setup: () => () => h(FileManagerInput, {
        multi: true,
        modelValue: model.value,
        'onUpdate:modelValue': (value: AssetValue | AssetValue[] | null) => { if (Array.isArray(value)) model.value = value },
      }),
    }))
    app.use(FrameworkPlugin, {
      adapters: { assets: assetAdapter(readFixture) },
      queryClient: createFrameworkQueryClient({ retry: 0, staleTime: 0 }),
    })
    app.use(FileManagerPlugin, fileManagerOptions((asset) => {
      const request = deferred<AssetValue>()
      pending.set(asset.id, request)
      return request.promise
    }))
    app.mount(host)
    apps.push(app)
    await flush()

    findButton('Pilih berkas')?.click()
    await vi.waitFor(() => expect(findButton(stored.name)).toBeDefined())
    findButton(stored.name)?.click()
    expect([...pending.keys()]).toEqual([stored.id])

    model.value = [secondStored]
    await flush()
    pending.get(stored.id)?.resolve(stored)
    await flush()

    expect(model.value).toEqual([secondStored])
  })
})
