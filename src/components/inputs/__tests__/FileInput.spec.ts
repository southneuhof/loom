import { defineComponent, h, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import FileInput from '../FileInput.vue'
import { deferred, mountInput } from './harness'
import Form from '../../core/Form.vue'
import { flush, mountCore } from '../../core/__tests__/harness'

type Asset = {
  kind: 'file'
  id: string
  url: string
  name: string
}

function asset(name: string): Asset {
  return {
    kind: 'file',
    id: `/uploads/${name}`,
    url: `https://files.test/${name}`,
    name,
  }
}

function selectFiles(input: HTMLInputElement, files: File[]) {
  Object.defineProperty(input, 'files', { configurable: true, value: files })
  input.dispatchEvent(new Event('change'))
}

function uploadCards(host: HTMLElement) {
  return [...host.querySelectorAll<HTMLElement>('[data-testid="file-upload-progress"]')]
}

describe('FileInput upload surface', () => {
  it('renders its drop zone through the form renderer without an upload operation', async () => {
    const view = mountCore(Form, {
      fields: { file: { label: 'File', form: { renderer: 'file' } } },
      initialData: {},
      submit: async () => undefined,
    })

    await flush()

    expect(view.text()).toContain('Letakkan file anda di sini')
    expect(view.text()).toContain('Pilih sumber file')
    view.unmount()
  })

  it('keeps the uploaded row in the live draft when the form writer stores its identity', async () => {
    const upload = vi.fn(async () => asset('first.pdf'))
    const model = ref<Record<string, unknown>>({ file: null })
    const host = defineComponent({
      setup: () => () => h(Form, {
        fields: {
          file: {
            label: 'File',
            form: { renderer: 'file', props: { upload }, write: (value: unknown) => {
              const file = value as { id?: unknown }
              return typeof file?.id === 'string' ? file.id : value
            } },
          },
        },
        modelValue: model.value,
        'onUpdate:modelValue': (value: Record<string, unknown>) => { model.value = value },
      }),
    })
    const view = mountCore(host, {})
    await flush()

    const input = view.find<HTMLInputElement>('input[type="file"]')!
    selectFiles(input, [new File(['first'], 'first.pdf', { type: 'application/pdf' })])
    await flush()

    expect(model.value.file).toMatchObject(asset('first.pdf'))
    expect(view.text()).toContain('first.pdf')
    view.unmount()
  })

  it('shows a dropped file immediately, updates its own fill, then replaces it after upload', async () => {
    const result = deferred<Asset>()
    let reportProgress: ((value: { loaded: number; total?: number }) => void) | undefined
    const upload = vi.fn((_file: Blob, context: { onProgress?: (value: { loaded: number; total?: number }) => void }) => {
      reportProgress = context.onProgress
      return result.promise
    })
    const view = mountInput<Asset | null>(FileInput, { model: null, props: { upload } })
    const input = view.host.querySelector<HTMLInputElement>('input[type="file"]')!

    selectFiles(input, [new File(['first'], 'first.pdf', { type: 'application/pdf' })])
    selectFiles(input, [new File(['second'], 'second.pdf', { type: 'application/pdf' })])
    await view.flush()

    expect(upload).toHaveBeenCalledTimes(1)
    expect(uploadCards(view.host)).toHaveLength(1)
    expect(uploadCards(view.host)[0].textContent).toContain('first.pdf')
    expect(uploadCards(view.host)[0].firstElementChild?.className).toContain('animate-pulse')
    expect(uploadCards(view.host)[0].querySelector('[role="status"]')?.textContent).toContain('Mengunggah')
    expect(view.model.value).toBeNull()
    expect(view.host.querySelector('input[type="file"]')).toBeNull()

    reportProgress?.({ loaded: 25, total: 100 })
    await view.flush()
    const fill = uploadCards(view.host)[0].firstElementChild as HTMLElement
    expect(fill.style.width).toBe('25%')
    expect(uploadCards(view.host)[0].textContent).toContain('25%')

    result.resolve(asset('first.pdf'))
    await view.flush()

    expect(uploadCards(view.host)).toHaveLength(0)
    expect(view.host.textContent).toContain('first.pdf')
    expect(view.host.textContent).toContain('Download')
    expect(view.model.value).toEqual(asset('first.pdf'))
    view.cleanup()
  })

  it('keeps multi-file progress and visual order isolated when uploads finish out of order', async () => {
    const first = deferred<Asset>()
    const second = deferred<Asset>()
    const progress: Array<(value: { loaded: number; total?: number }) => void> = []
    let call = 0
    const upload = vi.fn((_file: Blob, context: { onProgress?: (value: { loaded: number; total?: number }) => void }) => {
      progress.push(context.onProgress!)
      return call++ === 0 ? first.promise : second.promise
    })
    const view = mountInput<Asset[]>(FileInput, { model: [], props: { multi: true, upload } })
    const input = view.host.querySelector<HTMLInputElement>('input[type="file"]')!

    selectFiles(input, [
      new File(['first'], 'first.pdf', { type: 'application/pdf' }),
      new File(['second'], 'second.pdf', { type: 'application/pdf' }),
    ])
    await view.flush()
    progress[0]({ loaded: 10, total: 100 })
    progress[1]({ loaded: 80, total: 100 })
    await view.flush()

    expect(uploadCards(view.host).map((card) => card.textContent)).toEqual([
      expect.stringContaining('first.pdf'),
      expect.stringContaining('second.pdf'),
    ])
    expect((uploadCards(view.host)[0].firstElementChild as HTMLElement).style.width).toBe('10%')
    expect((uploadCards(view.host)[1].firstElementChild as HTMLElement).style.width).toBe('80%')

    second.resolve(asset('second.pdf'))
    await view.flush()
    expect(view.host.textContent).toContain('first.pdf')
    expect(view.host.textContent).toContain('second.pdf')
    expect(view.model.value).toEqual([asset('second.pdf')])

    first.resolve(asset('first.pdf'))
    await view.flush()
    expect(view.model.value).toEqual([asset('first.pdf'), asset('second.pdf')])
    view.cleanup()
  })

  it('removes only a failed pending row without updating the controlled model', async () => {
    const result = deferred<Asset>()
    const upload = vi.fn(() => result.promise)
    const view = mountInput<Asset[]>(FileInput, { model: [], props: { multi: true, upload } })
    const input = view.host.querySelector<HTMLInputElement>('input[type="file"]')!

    selectFiles(input, [new File(['bad'], 'bad.pdf', { type: 'application/pdf' })])
    await view.flush()
    result.reject(new Error('upload failed'))
    await view.flush()

    expect(uploadCards(view.host)).toHaveLength(0)
    expect(view.model.value).toEqual([])
    view.cleanup()
  })
})
