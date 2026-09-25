import { afterEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'vue-sonner'
import type { AssetAdapter, AssetValue } from '../../../assets/contracts'
import CameraInput from '../CameraInput.vue'
import { deferred, mountInput, testAssetAdapter } from './harness'

const stored: AssetValue = {
  kind: 'file',
  id: 'uploads/current.png',
  url: 'https://files.test/current.png',
  name: 'current.png',
  mimeType: 'image/png',
}
const replacement: AssetValue = {
  kind: 'file',
  id: 'uploads/replacement.png',
  url: 'https://files.test/replacement.png',
  name: 'replacement.png',
  mimeType: 'image/png',
}
const cleanup: Array<() => void> = []
const mediaDevicesDescriptor = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices')

function findButton(root: ParentNode, text: string) {
  return [...root.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent?.includes(text))
}

function installCamera(getUserMedia: () => Promise<MediaStream>) {
  const request = vi.fn(getUserMedia)
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: request },
  })
  return request
}

function installCanvas() {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D)
}

function createStream() {
  const stop = vi.fn()
  const stream = {
    getTracks: () => [{ stop }],
    getVideoTracks: () => [{ getSettings: () => ({ width: 640, height: 480 }) }],
  } as unknown as MediaStream
  return { stream, stop }
}

async function startUpload() {
  const request = deferred<AssetValue>()
  const adapter: AssetAdapter = {
    ...testAssetAdapter,
    upload: vi.fn(() => request.promise),
  }
  const stream = {
    getTracks: () => [{ stop: vi.fn() }],
    getVideoTracks: () => [{ getSettings: () => ({ width: 640, height: 480 }) }],
  }
  installCamera(async () => stream as unknown as MediaStream)
  installCanvas()
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,AA==')
  const toastError = vi.spyOn(toast, 'error').mockImplementation(() => '')
  const initial: AssetValue | null = stored
  const mounted = mountInput(CameraInput, { model: initial, adapters: { assets: adapter } })
  cleanup.push(mounted.cleanup)

  findButton(mounted.host, 'Ambil Ulang Foto')?.click()
  await mounted.flush()
  document.querySelector<HTMLButtonElement>('[role="dialog"] button.aspect-square')?.click()
  await mounted.flush()
  document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button.aspect-square').item(1)?.click()
  await vi.waitFor(() => expect(adapter.upload).toHaveBeenCalled())

  return { mounted, request, toastError }
}

afterEach(() => {
  cleanup.splice(0).forEach((dispose) => dispose())
  vi.restoreAllMocks()
  if (mediaDevicesDescriptor) Object.defineProperty(navigator, 'mediaDevices', mediaDevicesDescriptor)
  else Reflect.deleteProperty(navigator, 'mediaDevices')
  document.body.innerHTML = ''
})

describe('CameraInput async ownership', () => {
  it('stops and detaches the current stream before reacquiring on retake', async () => {
    const current = createStream()
    const next = createStream()
    const pending = deferred<MediaStream>()
    const getUserMedia = installCamera(vi.fn()
      .mockResolvedValueOnce(current.stream)
      .mockImplementationOnce(() => pending.promise))
    installCanvas()
    const mounted = mountInput(CameraInput, { model: stored })
    cleanup.push(mounted.cleanup)

    findButton(mounted.host, 'Ambil Ulang Foto')?.click()
    await mounted.flush()
    const video = document.querySelector<HTMLVideoElement>('[role="dialog"] video')
    expect(video?.srcObject).toBe(current.stream)

    document.querySelector<HTMLButtonElement>('[role="dialog"] button.aspect-square')?.click()
    await mounted.flush()
    document.querySelector<HTMLButtonElement>('[role="dialog"] button.aspect-square')?.click()
    await mounted.flush()

    expect(getUserMedia).toHaveBeenCalledTimes(2)
    expect(current.stop).toHaveBeenCalledOnce()
    expect(video?.srcObject).toBeNull()

    pending.resolve(next.stream)
    await mounted.flush()

    expect(video?.srcObject).toBe(next.stream)
  })

  it('stops a stale stream that resolves after retake starts a newer request', async () => {
    const stale = createStream()
    const current = createStream()
    const first = deferred<MediaStream>()
    const second = deferred<MediaStream>()
    const getUserMedia = installCamera(vi.fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise))
    installCanvas()
    const mounted = mountInput(CameraInput, { model: stored })
    cleanup.push(mounted.cleanup)

    findButton(mounted.host, 'Ambil Ulang Foto')?.click()
    await mounted.flush()
    document.querySelector<HTMLButtonElement>('[role="dialog"] button.aspect-square')?.click()
    await mounted.flush()
    document.querySelector<HTMLButtonElement>('[role="dialog"] button.aspect-square')?.click()
    await mounted.flush()

    expect(getUserMedia).toHaveBeenCalledTimes(2)
    first.resolve(stale.stream)
    await mounted.flush()

    const video = document.querySelector<HTMLVideoElement>('[role="dialog"] video')
    expect(stale.stop).toHaveBeenCalledOnce()
    expect(video?.srcObject).toBeFalsy()

    second.resolve(current.stream)
    await mounted.flush()

    expect(video?.srcObject).toBe(current.stream)
  })

  it('stops and clears the active stream when the dialog closes', async () => {
    const current = createStream()
    installCamera(async () => current.stream)
    const mounted = mountInput(CameraInput, { model: stored })
    cleanup.push(mounted.cleanup)

    findButton(mounted.host, 'Ambil Ulang Foto')?.click()
    await mounted.flush()
    const video = document.querySelector<HTMLVideoElement>('[role="dialog"] video')
    expect(video?.srcObject).toBe(current.stream)

    findButton(document.querySelector('[role="dialog"]')!, 'Close')?.click()
    await mounted.flush()

    expect(current.stop).toHaveBeenCalledOnce()
    expect(video?.srcObject).toBeNull()
  })

  it('stops and clears the active stream when the component unmounts', async () => {
    const current = createStream()
    installCamera(async () => current.stream)
    const mounted = mountInput(CameraInput, { model: stored })
    const disposeIndex = cleanup.push(mounted.cleanup) - 1

    findButton(mounted.host, 'Ambil Ulang Foto')?.click()
    await mounted.flush()
    const video = document.querySelector<HTMLVideoElement>('[role="dialog"] video')
    expect(video?.srcObject).toBe(current.stream)

    cleanup.splice(disposeIndex, 1)
    mounted.cleanup()

    expect(current.stop).toHaveBeenCalledOnce()
    expect(video?.srcObject).toBeNull()
  })

  it.each(['disable', 'disable and re-enable', 'reset', 'replacement'])('does not report a camera failure after %s', async (change) => {
    const request = deferred<MediaStream>()
    const getUserMedia = installCamera(() => request.promise)
    const toastError = vi.spyOn(toast, 'error').mockImplementation(() => '')
    const initial: AssetValue | null = stored
    const mounted = mountInput(CameraInput, { model: initial })
    cleanup.push(mounted.cleanup)

    findButton(mounted.host, 'Ambil Ulang Foto')?.click()
    await mounted.flush()
    expect(getUserMedia).toHaveBeenCalledOnce()
    if (change.startsWith('disable')) {
      mounted.setProps({ disabled: true })
      await mounted.flush()
      if (change === 'disable and re-enable') {
        mounted.setProps({ disabled: false })
      }
    }
    if (change === 'reset') findButton(mounted.host, 'Hapus Foto')?.click()
    if (change === 'replacement') mounted.model.value = replacement
    await mounted.flush()
    request.reject(new Error('Camera permission was denied.'))
    await mounted.flush()

    expect(toastError).not.toHaveBeenCalled()
  })

  it.each(['disable', 'disable and re-enable', 'reset', 'replacement'])('does not report an upload failure after %s', async (change) => {
    const { mounted, request, toastError } = await startUpload()
    if (change.startsWith('disable')) {
      mounted.setProps({ disabled: true })
      await mounted.flush()
      if (change === 'disable and re-enable') {
        mounted.setProps({ disabled: false })
      }
    }
    if (change === 'reset') findButton(mounted.host, 'Hapus Foto')?.click()
    if (change === 'replacement') mounted.model.value = replacement
    await mounted.flush()
    request.reject(new Error('Upload was rejected.'))
    await mounted.flush()

    if (change.startsWith('disable')) expect(mounted.model.value).toEqual(stored)
    if (change === 'reset') expect(mounted.model.value).toBeNull()
    if (change === 'replacement') expect(mounted.model.value).toEqual(replacement)
    expect(toastError).not.toHaveBeenCalled()
  })
})
