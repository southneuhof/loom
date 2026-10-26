import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref, type Component } from 'vue'
import DrawingCanvas from '../DrawingCanvas.vue'
import { deferred, mountInput } from './harness'

const mounted: Array<() => void> = []

function pointerEvent(type: string, x: number, y: number): PointerEvent {
  const event = new Event(type, { bubbles: true }) as PointerEvent
  Object.defineProperties(event, {
    pointerId: { value: 1 },
    offsetX: { value: x },
    offsetY: { value: y },
  })
  return event
}

afterEach(() => {
  mounted.splice(0).forEach((cleanup) => cleanup())
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('DrawingCanvas file mode', () => {
  it('keeps canvas controls from submitting their parent form', async () => {
    const model = ref<File | null>(null)
    const submit = vi.fn()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      clearRect: vi.fn(),
      globalCompositeOperation: 'source-over',
      lineCap: 'butt',
      strokeStyle: '',
      lineWidth: 1,
    } as unknown as CanvasRenderingContext2D)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(null))
    const host = document.createElement('div')
    const app = createApp(defineComponent({
      setup: () => () => h('form', {
        onSubmit: (event: Event) => {
          event.preventDefault()
          submit()
        },
      }, [h(DrawingCanvas as Component, {
        mode: 'file',
        modelValue: model.value,
        'onUpdate:modelValue': (value: File | null) => { model.value = value },
      })]),
    }))
    app.mount(host)
    await nextTick()
    await nextTick()

    for (const button of host.querySelectorAll<HTMLButtonElement>('button')) button.click()
    await nextTick()

    expect(submit).not.toHaveBeenCalled()
    app.unmount()
    host.remove()
  })

  it('cancels stale image restores and revokes their object URL', async () => {
    const source = new File(['source'], 'signature.png', { type: 'image/png' })
    const drawingContext = {
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray([0, 0, 0, 255]) })),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      closePath: vi.fn(),
      globalCompositeOperation: 'source-over',
      lineCap: 'butt',
      strokeStyle: '',
      lineWidth: 1,
    }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(drawingContext as unknown as CanvasRenderingContext2D)
    const revokeUrl = vi.spyOn(URL, 'revokeObjectURL')
    class PendingImage {
      crossOrigin: string | null = null
      onload: ((event: Event) => unknown) | null = null
      onerror: ((event: Event) => unknown) | null = null
      sources: string[] = []

      set src(value: string) {
        this.sources.push(value)
      }
    }
    const images: PendingImage[] = []
    const ImageConstructor = class extends PendingImage {
      constructor() {
        super()
        images.push(this)
      }
    }
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:stale')
    vi.stubGlobal('Image', ImageConstructor)
    const view = mountInput<File | null>(DrawingCanvas, {
      model: source,
      props: { mode: 'file' },
      framework: false,
    })
    mounted.push(view.cleanup)
    await view.flush()

    expect(images).toHaveLength(1)
    expect(images[0]?.sources).toEqual(['blob:stale'])
    view.model.value = null
    await view.flush()

    expect(images[0]?.sources).toEqual(['blob:stale', ''])
    expect(images[0]?.onload).toBeNull()
    expect(images[0]?.onerror).toBeNull()
    expect(revokeUrl).toHaveBeenCalledWith('blob:stale')
    expect(drawingContext.drawImage).not.toHaveBeenCalled()
  })

  it('cancels a pending local drawing operation and ignores its late result', async () => {
    const output = deferred<File>()
    let signal: AbortSignal | undefined
    const transform = vi.fn((_file: File, context: { signal: AbortSignal }) => {
      signal = context.signal
      return output.promise
    })
    const drawingContext = {
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray([0, 0, 0, 255]) })),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      closePath: vi.fn(),
      globalCompositeOperation: 'source-over',
      lineCap: 'butt',
      strokeStyle: '',
      lineWidth: 1,
    }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(drawingContext as unknown as CanvasRenderingContext2D)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(new Blob(['drawing bytes'], { type: 'image/png' })))
    const view = mountInput<File | null>(DrawingCanvas, {
      model: null,
      props: { mode: 'file', transform },
      framework: false,
    })
    mounted.push(view.cleanup)
    await view.flush()

    const canvas = view.host.querySelector<HTMLCanvasElement>('canvas')!
    Object.defineProperty(canvas, 'setPointerCapture', { value: vi.fn() })
    canvas.dispatchEvent(pointerEvent('pointerdown', 10, 20))
    canvas.dispatchEvent(pointerEvent('pointerup', 10, 20))
    view.host.querySelector<HTMLButtonElement>('[aria-label="Save drawing"]')!.click()
    await view.flush()
    expect(view.host.querySelector('[role="status"]')?.textContent).toContain('Processing drawing')
    expect(signal?.aborted).toBe(false)

    view.host.querySelector<HTMLButtonElement>('[aria-label="Cancel pending drawing"]')!.click()
    await view.flush()
    expect(signal?.aborted).toBe(true)
    output.resolve(new File(['late'], 'drawing.png', { type: 'image/png' }))
    await view.flush()

    expect(view.model.value).toBeNull()
    expect(view.host.querySelector('[role="status"]')).toBeNull()
  })

  it('restores local images, exports a drawing File, and clears the model', async () => {
    const source = new File(['source'], 'signature.png', { type: 'image/png' })
    const drawingContext = {
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray([0, 0, 0, 255]) })),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      closePath: vi.fn(),
      globalCompositeOperation: 'source-over',
      lineCap: 'butt',
      strokeStyle: '',
      lineWidth: 1,
    }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(drawingContext as unknown as CanvasRenderingContext2D)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(new Blob(['drawing bytes'], { type: 'image/png' })))
    const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValueOnce('blob:source').mockReturnValueOnce('blob:drawing')
    const revokeUrl = vi.spyOn(URL, 'revokeObjectURL')
    class LoadedImage {
      crossOrigin: string | null = null
      onload: ((event: Event) => unknown) | null = null
      onerror: ((event: Event) => unknown) | null = null

      set src(_value: string) {
        queueMicrotask(() => this.onload?.(new Event('load')))
      }
    }
    vi.stubGlobal('Image', LoadedImage)
    const view = mountInput<File | null>(DrawingCanvas, {
      model: source,
      props: { mode: 'file' },
      framework: false,
    })
    mounted.push(view.cleanup)
    await view.flush()

    expect(createUrl).toHaveBeenCalledWith(source)
    expect(revokeUrl).toHaveBeenCalledWith('blob:source')
    expect(drawingContext.drawImage).toHaveBeenCalled()

    const canvas = view.host.querySelector<HTMLCanvasElement>('canvas')!
    Object.defineProperty(canvas, 'setPointerCapture', { value: vi.fn() })
    canvas.dispatchEvent(pointerEvent('pointerdown', 10, 20))
    canvas.dispatchEvent(pointerEvent('pointermove', 30, 40))
    canvas.dispatchEvent(pointerEvent('pointerup', 30, 40))
    expect(drawingContext.stroke).toHaveBeenCalled()

    view.host.querySelector<HTMLButtonElement>('[aria-label="Save drawing"]')!.click()
    await view.flush()
    expect(view.model.value).toBeInstanceOf(File)
    expect((view.model.value as File).name).toBe('drawing.png')
    expect((view.model.value as File).type).toBe('image/png')
    expect((view.model.value as File).size).toBe(13)
    expect(revokeUrl).toHaveBeenCalledWith('blob:drawing')

    view.host.querySelector<HTMLButtonElement>('[aria-label="Clear drawing"]')!.click()
    await view.flush()
    expect(view.model.value).toBeNull()
    expect(drawingContext.clearRect).toHaveBeenCalled()
  })
})
