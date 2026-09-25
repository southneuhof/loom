import { afterEach, describe, expect, it } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref, type App } from 'vue'
import { z } from 'zod'
import type { AssetAdapter, AssetValue } from '../contracts'
import { FrameworkPlugin } from '../../adapters/plugin'
import { createFrameworkQueryClient } from '../../query'
import Form from '../../components/core/Form.vue'
import DialogForm from '../../components/composites/DialogForm.vue'
import FileInput from '../../components/inputs/FileInput.vue'
import ImageInput from '../../components/inputs/ImageInput.vue'
import ImagePreview from '../../components/base/ImagePreview.vue'
import ImagePreviewMulti from '../../components/base/ImagePreviewMulti.vue'
import FileComponent from '../../components/utils/FileComponent.vue'
import type { FormFields } from '../../contracts/forms'

type Input = { document: AssetValue | null; photo: AssetValue | null }

const schema = z.object({
  document: z.custom<AssetValue | null>(),
  photo: z.custom<AssetValue | null>(),
})

const fields = {
  document: { label: 'Document', renderer: 'file' },
  photo: { label: 'Photo', renderer: 'image' },
} satisfies FormFields<Input>

function asset(id: string, name: string, mimeType: string): AssetValue {
  return {
    kind: 'file',
    id,
    url: `https://api.test/${id}`,
    name,
    mimeType,
  }
}

const documentAsset = asset('uploads/document.pdf', 'document.pdf', 'application/pdf')
const photoAsset = asset('uploads/profile.png', 'profile.png', 'image/png')
const secondPhoto = asset('uploads/cover.png', 'cover.png', 'image/png')
const apps: App[] = []
const pixel = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='

function previewURL(size: string, id: string, scope?: string) {
  return `${pixel}#${size}-${encodeURIComponent(id)}${scope ? `-${scope}` : ''}`
}

function createAssetAdapter(scope?: string): AssetAdapter {
  return {
    read(value) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return null
      const item = value as Record<string, unknown>
      if (item.kind !== 'file' || typeof item.id !== 'string' || typeof item.url !== 'string' || typeof item.name !== 'string') return null
      return value as AssetValue
    },
    preview(value) {
      return { imageURL: previewURL('full', value.id, scope), thumbnailURL: previewURL('thumb', value.id, scope) }
    },
    async upload(file, { onProgress }) {
      onProgress?.({ loaded: file.size, total: file.size })
      return asset(`uploads/${scope ? `${scope}/` : ''}${file.name}`, file.name, file.type)
    },
  }
}

async function settle() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await Promise.resolve()
    await nextTick()
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  }
}

function selectFile(input: HTMLInputElement, file: File) {
  const transfer = new DataTransfer()
  transfer.items.add(file)
  Object.defineProperty(input, 'files', { configurable: true, value: transfer.files })
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

afterEach(() => {
  apps.splice(0).forEach((app) => app.unmount())
  document.body.innerHTML = ''
})

describe('asset service parity in the browser', () => {
  it('serves direct inputs, managed forms, and previews through one app registration', async () => {
    const directDocument = ref<AssetValue | null>(null)
    const directPhoto = ref<AssetValue | null>(null)
    const formSubmit = async () => undefined
    const Root = defineComponent({
      setup: () => () => h('main', [
        h('section', { id: 'direct-file' }, [h(FileInput, {
          modelValue: directDocument.value,
          'onUpdate:modelValue': (value: AssetValue | null) => { directDocument.value = value },
        })]),
        h('section', { id: 'direct-image' }, [h(ImageInput, {
          modelValue: directPhoto.value,
          'onUpdate:modelValue': (value: AssetValue | null) => { directPhoto.value = value },
        })]),
        h('section', { id: 'managed-form' }, [h(Form, {
          schema,
          fields,
          initialData: { document: documentAsset, photo: photoAsset },
          submit: formSubmit,
        })]),
        h(DialogForm, {
          schema,
          fields,
          initialData: { document: documentAsset, photo: photoAsset },
          submit: formSubmit,
          open: true,
          title: 'Asset edit',
          description: 'Update the stored assets.',
        }),
        h(FileComponent, { asset: documentAsset }),
        h('section', { id: 'url-file-preview' }, [h(FileComponent, { filename: 'manual', url: '/manual', ext: 'pdf' })]),
        h(ImagePreview, { asset: photoAsset }),
        h('section', { id: 'multi-preview' }, [h(ImagePreviewMulti, { assets: [photoAsset, secondPhoto] })]),
      ]),
    })
    const host = document.createElement('div')
    document.body.append(host)
    const app = createApp(Root)
    app.use(FrameworkPlugin, {
      adapters: { assets: createAssetAdapter() },
      queryClient: createFrameworkQueryClient({ retry: 0, staleTime: 0 }),
    })
    app.mount(host)
    apps.push(app)
    await settle()

    const inputs = [...host.querySelectorAll<HTMLInputElement>('input[type="file"]')]
    selectFile(inputs[0], new File(['report'], 'direct.pdf', { type: 'application/pdf' }))
    selectFile(inputs[1], new File(['photo'], 'direct.png', { type: 'image/png' }))
    await settle()

    expect(directDocument.value).toEqual(asset('uploads/direct.pdf', 'direct.pdf', 'application/pdf'))
    expect(directPhoto.value).toEqual(asset('uploads/direct.png', 'direct.png', 'image/png'))
    expect(host.querySelector(`a[href="${previewURL('full', documentAsset.id)}"]`)).toBeTruthy()
    expect(host.querySelector(`a[href="${previewURL('full', 'uploads/direct.pdf')}"]`)).toBeTruthy()
    expect(host.querySelector<HTMLButtonElement>('#url-file-preview button')?.textContent).toContain('Preview')
    expect([...document.querySelectorAll<HTMLImageElement>('img')].map((image) => image.getAttribute('src'))).toContain(previewURL('thumb', photoAsset.id))
    expect([...document.querySelectorAll<HTMLImageElement>('img')].map((image) => image.getAttribute('src'))).toContain(previewURL('thumb', 'uploads/direct.png'))
    expect(host.querySelector<HTMLImageElement>('#multi-preview img')?.getAttribute('src')).toBe(previewURL('thumb', photoAsset.id))
  })

  it('keeps asset services isolated between mounted Vue apps', async () => {
    const firstValue = ref<AssetValue | null>(null)
    const secondValue = ref<AssetValue | null>(null)
    const mountApp = (scope: string, model: typeof firstValue) => {
      const host = document.createElement('div')
      document.body.append(host)
      const app = createApp(defineComponent({
        setup: () => () => h('main', [
          h(FileInput, {
            modelValue: model.value,
            'onUpdate:modelValue': (value: AssetValue | null) => { model.value = value },
          }),
          h(ImagePreview, { asset: photoAsset }),
        ]),
      }))
      app.use(FrameworkPlugin, {
        adapters: { assets: createAssetAdapter(scope) },
        queryClient: createFrameworkQueryClient({ retry: 0, staleTime: 0 }),
      })
      app.mount(host)
      apps.push(app)
      return host
    }
    const firstHost = mountApp('first', firstValue)
    const secondHost = mountApp('second', secondValue)
    await settle()

    selectFile(firstHost.querySelector<HTMLInputElement>('input[type="file"]')!, new File(['one'], 'one.pdf', { type: 'application/pdf' }))
    selectFile(secondHost.querySelector<HTMLInputElement>('input[type="file"]')!, new File(['two'], 'two.pdf', { type: 'application/pdf' }))
    await settle()

    expect(firstValue.value?.id).toBe('uploads/first/one.pdf')
    expect(secondValue.value?.id).toBe('uploads/second/two.pdf')
    expect(firstHost.querySelector<HTMLImageElement>('img')?.getAttribute('src')).toBe(previewURL('thumb', photoAsset.id, 'first'))
    expect(secondHost.querySelector<HTMLImageElement>('img')?.getAttribute('src')).toBe(previewURL('thumb', photoAsset.id, 'second'))
  })

  it('rejects mixed FileComponent asset and URL/file sources', async () => {
    const failures: string[] = []
    const Root = defineComponent({
      setup: () => () => h('main', [
        h(FileComponent, { asset: documentAsset, filename: 'manual.pdf' }),
        h(FileComponent, { asset: documentAsset, ext: 'pdf' }),
        h(FileComponent, { asset: documentAsset, url: '/manual.pdf' }),
      ]),
    })
    const host = document.createElement('div')
    document.body.append(host)
    const app = createApp(Root)
    app.config.errorHandler = (error) => failures.push(error.message)
    app.use(FrameworkPlugin, {
      adapters: { assets: createAssetAdapter() },
      queryClient: createFrameworkQueryClient({ retry: 0, staleTime: 0 }),
    })
    app.mount(host)
    apps.push(app)
    await settle()

    expect(failures).toEqual([
      '[loom] ASSET_PREVIEW_SOURCE_CONFLICT',
      '[loom] ASSET_PREVIEW_SOURCE_CONFLICT',
      '[loom] ASSET_PREVIEW_SOURCE_CONFLICT',
    ])
  })
})
