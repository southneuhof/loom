import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { withApp } from '../../../query/__tests__/harness'
import { useUploadMutation } from '../useUploadMutation'
import { deferred } from './harness'

describe('upload operation boundary', () => {
  it.each(['FileInput.vue', 'ImageInput.vue', 'CameraInput.vue', 'DrawingCanvas.vue'])('%s avoids wired upload runtime', (name) => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/inputs', name), 'utf8')
    expect(source).not.toMatch(/useFrameworkRuntime|missingRuntimeCapability|runtime\.upload/)
  })

  it('forwards upload context and reports deterministic progress', async () => {
    const upload = vi.fn(async (_blob: Blob, context: any) => {
      context.onProgress({ loaded: 5, total: 10 })
      return 'done'
    })
    const mounted = withApp(() => useUploadMutation(() => upload))
    const blob = new Blob(['x'])
    await expect(mounted.result.execute(blob, '/target')).resolves.toBe('done')
    expect(upload).toHaveBeenCalledTimes(1)
    expect(upload.mock.calls[0][0]).toBe(blob)
    expect(upload.mock.calls[0][1].destination).toBe('/target')
    expect(upload.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal)
    expect(mounted.result.pending.value).toBe(false)
    expect(mounted.result.progress.value).toBeUndefined()
    mounted.app.unmount()
  })

  it('keeps pending true until concurrent operations settle and cancels all signals', async () => {
    const first = deferred<string>()
    const second = deferred<string>()
    const signals: AbortSignal[] = []
    let call = 0
    const upload = vi.fn((_blob: Blob, context: any) => {
      signals.push(context.signal)
      return call++ === 0 ? first.promise : second.promise
    })
    const mounted = withApp(() => useUploadMutation(() => upload))
    const one = mounted.result.execute(new Blob())
    const two = mounted.result.execute(new Blob())
    expect(mounted.result.pendingCount.value).toBe(2)
    first.resolve('one')
    await one
    expect(mounted.result.pending.value).toBe(true)
    mounted.result.cancel()
    expect(signals[0].aborted).toBe(false)
    expect(signals[1].aborted).toBe(true)
    second.resolve('two')
    await two
    expect(mounted.result.pending.value).toBe(false)
    mounted.app.unmount()
  })

  it('forwards each operation progress to its own observer', async () => {
    const first = deferred<string>()
    const second = deferred<string>()
    const report: Array<(value: { loaded: number; total?: number }) => void> = []
    let call = 0
    const upload = vi.fn((_blob: Blob, context: any) => {
      report.push(context.onProgress)
      return call++ === 0 ? first.promise : second.promise
    })
    const mounted = withApp(() => useUploadMutation(() => upload))
    const firstProgress: Array<{ loaded: number; total?: number }> = []
    const secondProgress: Array<{ loaded: number; total?: number }> = []
    const one = mounted.result.execute(new Blob(), undefined, (value) => firstProgress.push(value))
    const two = mounted.result.execute(new Blob(), undefined, (value) => secondProgress.push(value))

    report[0]({ loaded: 10, total: 100 })
    report[1]({ loaded: 80, total: 100 })
    expect(firstProgress).toEqual([{ loaded: 10, total: 100 }])
    expect(secondProgress).toEqual([{ loaded: 80, total: 100 }])
    expect(mounted.result.pending.value).toBe(true)

    second.resolve('second')
    await two
    expect(mounted.result.pending.value).toBe(true)
    first.resolve('first')
    await one
    expect(mounted.result.pending.value).toBe(false)
    mounted.app.unmount()
  })

  it('normalizes error state while rethrowing original rejection', async () => {
    const reason = new Error('broken')
    const mounted = withApp(() => useUploadMutation(() => async () => { throw reason }))
    await expect(mounted.result.execute(new Blob())).rejects.toBe(reason)
    expect(mounted.result.error.value?.message).toContain('broken')
    mounted.app.unmount()
  })
})
