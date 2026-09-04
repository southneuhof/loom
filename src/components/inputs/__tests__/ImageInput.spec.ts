import { defineComponent, h, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import ImageInput from '../ImageInput.vue'
import { flush, mountCore } from '../../core/__tests__/harness'

function selectFile(input: HTMLInputElement, file: File) {
  Object.defineProperty(input, 'files', { configurable: true, value: [file] })
  input.dispatchEvent(new Event('change'))
}

describe('ImageInput upload surface', () => {
  it('keeps the preview when the form writer stores the asset identity', async () => {
    const upload = vi.fn(async () => ({
      kind: 'file' as const,
      id: '/uploads/first.png',
      url: 'https://files.test/first.png',
      name: 'first.png',
    }))
    const model = ref<unknown[]>([])
    const host = defineComponent({
      setup: () => () => h(ImageInput, {
        modelValue: model.value,
        multi: true,
        limit: 4,
        upload,
        'onUpdate:modelValue': (value: unknown) => {
          model.value = (Array.isArray(value) ? value : [])
            .map((item) => (item && typeof item === 'object' && typeof (item as { id?: unknown }).id === 'string' ? (item as { id: string }).id : undefined))
            .filter((item): item is string => Boolean(item))
        },
      }),
    })
    const view = mountCore(host, {})
    await flush()

    selectFile(view.find<HTMLInputElement>('input[type="file"]')!, new File(['first'], 'first.png', { type: 'image/png' }))
    await flush()

    expect(model.value).toEqual(['/uploads/first.png'])
    expect(view.find<HTMLImageElement>('img')?.getAttribute('src')).toBe('https://files.test/first.png')
    view.unmount()
  })
})
