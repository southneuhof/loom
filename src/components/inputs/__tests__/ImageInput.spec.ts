import { defineComponent, h, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import ImageInput from '../ImageInput.vue'
import { deferred, flush, mountCore } from '../../core/__tests__/harness'
import type { AssetAdapter } from '../../../assets/contracts'
import { testAssetAdapter } from './harness'

function selectFile(input: HTMLInputElement, file: File) {
  Object.defineProperty(input, 'files', { configurable: true, value: [file] })
  input.dispatchEvent(new Event('change'))
}

describe('ImageInput upload surface', () => {
  it('keeps the uploaded asset object and preview through the control value', async () => {
    const uploaded = {
      kind: 'file' as const,
      id: '/uploads/first.png',
      url: 'https://files.test/first.png',
      name: 'first.png',
    }
    const upload = vi.fn(async () => uploaded)
    const model = ref<unknown[]>([])
    const host = defineComponent({
      setup: () => () => h(ImageInput, {
        modelValue: model.value,
        multi: true,
        limit: 4,
        'onUpdate:modelValue': (value: unknown) => {
          model.value = value as unknown[]
        },
      }),
    })
    const view = mountCore(host, {}, { adapters: { assets: { ...testAssetAdapter, upload: upload as AssetAdapter['upload'] } } })
    await flush()

    selectFile(view.find<HTMLInputElement>('input[type="file"]')!, new File(['first'], 'first.png', { type: 'image/png' }))
    await flush()

    expect(model.value).toEqual([uploaded])
    expect(view.find<HTMLImageElement>('img')?.getAttribute('src')).toBe('https://files.test/first.png')
    view.unmount()
  })

  it('reorders multi-image objects without adding framework properties', async () => {
    const first = { kind: 'file' as const, id: '/uploads/first.png', url: 'https://files.test/first.png', name: 'first.png' }
    const second = { kind: 'file' as const, id: '/uploads/second.png', url: 'https://files.test/second.png', name: 'second.png' }
    const model = ref<unknown[]>([first, second])
    const host = defineComponent({
      setup: () => () => h(ImageInput, {
        modelValue: model.value,
        multi: true,
        'onUpdate:modelValue': (value: unknown) => {
          model.value = value as unknown[]
        },
      }),
    })
    const view = mountCore(host, {})
    await flush()

    model.value = [second, first]
    await flush()

    expect(model.value).toEqual([second, first])
    expect(model.value).not.toContainEqual(expect.objectContaining({ order_number: expect.anything() }))
    view.unmount()
  })

  it('uses the app preview resolver without emitting a model change', async () => {
    const current = { kind: 'file' as const, id: '/uploads/photo.png', url: 'https://files.test/photo.png', name: 'photo.png' }
    const model = ref<unknown>(current)
    const update = vi.fn((value: unknown) => { model.value = value })
    const host = defineComponent({
      setup: () => () => h(ImageInput, { modelValue: model.value, 'onUpdate:modelValue': update }),
    })
    const view = mountCore(host, {}, {
      adapters: {
        assets: {
          ...testAssetAdapter,
          preview: (asset) => ({ imageURL: `/resolved${asset.url}`, thumbnailURL: `/thumb${asset.url}` }),
        },
      },
    })
    await flush()

    expect(view.find<HTMLImageElement>('img')?.getAttribute('src')).toBe(`/thumb${current.url}`)
    expect(model.value).toEqual(current)
    expect(update).not.toHaveBeenCalled()
    view.unmount()
  })

  it('blocks disabled uploads and completes an upload accepted before disable', async () => {
    const upload = vi.fn(async () => ({
      kind: 'file' as const,
      id: '/uploads/ignored.png',
      url: 'https://files.test/ignored.png',
      name: 'ignored.png',
    }))
    const disabledView = mountCore(defineComponent({
      setup: () => () => h(ImageInput, { disabled: true }),
    }), {}, { adapters: { assets: { ...testAssetAdapter, upload } } })
    const disabledInput = disabledView.find<HTMLInputElement>('input[type="file"]')!
    selectFile(disabledInput, new File(['ignored'], 'ignored.png', { type: 'image/png' }))
    await flush()
    expect(upload).not.toHaveBeenCalled()
    disabledView.unmount()

    const result = deferred<{ kind: 'file'; id: string; url: string; name: string }>()
    const acceptedUpload = vi.fn(() => result.promise)
    const model = ref<unknown>(null)
    const disabled = ref(false)
    const host = defineComponent({
      setup: () => () => h(ImageInput, {
        modelValue: model.value,
        disabled: disabled.value,
        'onUpdate:modelValue': (value: unknown) => { model.value = value },
      }),
    })
    const acceptedView = mountCore(host, {}, { adapters: { assets: { ...testAssetAdapter, upload: acceptedUpload } } })
    selectFile(acceptedView.find<HTMLInputElement>('input[type="file"]')!, new File(['photo'], 'photo.png', { type: 'image/png' }))
    await flush()
    disabled.value = true
    await flush()
    result.resolve({ kind: 'file', id: '/uploads/photo.png', url: 'https://files.test/photo.png', name: 'photo.png' })
    await flush()
    expect(model.value).toMatchObject({ id: '/uploads/photo.png' })
    acceptedView.unmount()
  })

  it('keeps an external image replacement when an older replacement upload finishes', async () => {
    const current = { kind: 'file' as const, id: '/uploads/current.png', url: 'https://files.test/current.png', name: 'current.png' }
    const replacement = { kind: 'file' as const, id: '/uploads/newer.png', url: 'https://files.test/newer.png', name: 'newer.png' }
    const result = deferred<typeof current>()
    const upload = vi.fn(() => result.promise)
    const model = ref<unknown>(current)
    const host = defineComponent({
      setup: () => () => h(ImageInput, {
        modelValue: model.value,
        'onUpdate:modelValue': (value: unknown) => { model.value = value },
      }),
    })
    const view = mountCore(host, {}, { adapters: { assets: { ...testAssetAdapter, upload } } })
    await flush()

    const drop = new Event('drop', { bubbles: true, cancelable: true }) as DragEvent
    Object.defineProperty(drop, 'dataTransfer', { value: { files: [new File(['old'], 'old.png', { type: 'image/png' })] } })
    view.host.querySelector<HTMLElement>('.cursor-move')!.dispatchEvent(drop)
    await flush()
    model.value = replacement
    await flush()
    result.resolve({ kind: 'file', id: '/uploads/old.png', url: 'https://files.test/old.png', name: 'old.png' })
    await flush()

    expect(model.value).toEqual(replacement)
    expect(view.find<HTMLImageElement>('img')?.getAttribute('src')).toBe(replacement.url)
    expect(view.find<HTMLImageElement>('img')?.getAttribute('src')).not.toContain('old.png')
    view.unmount()
  })

  it('blocks a disabled image removal handler', async () => {
    const current = { kind: 'file' as const, id: '/uploads/current.png', url: 'https://files.test/current.png', name: 'current.png' }
    const model = ref<unknown>(current)
    const update = vi.fn((value: unknown) => { model.value = value })
    const host = defineComponent({
      setup: () => () => h(ImageInput, {
        modelValue: model.value,
        disabled: true,
        'onUpdate:modelValue': update,
      }),
    })
    const view = mountCore(host, {})
    await flush()

    view.host.querySelector<HTMLButtonElement>('button[aria-label="Remove image"]')!.click()
    await flush()

    expect(model.value).toEqual(current)
    expect(update).not.toHaveBeenCalled()
    view.unmount()
  })
})
