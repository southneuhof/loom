import { createApp, defineComponent, h, nextTick, type App } from 'vue'
import { FrameworkPlugin } from '../../adapters/plugin'
import type { FrameworkAdaptersInput } from '../../adapters/projectAdapters'
import type { QueryClient } from '@tanstack/vue-query'

export interface HarnessOptions {
  adapters?: FrameworkAdaptersInput
  queryClient?: QueryClient
}

/** Runs a composable inside a mounted app so injections resolve normally. */
export function withApp<TResult>(setup: () => TResult, options: HarnessOptions = {}): { result: TResult; app: App } {
  let result!: TResult
  const app = createApp(
    defineComponent({
      setup() {
        result = setup()
        return () => h('div')
      },
    }),
  )
  app.use(FrameworkPlugin, { ...options })
  app.mount(document.createElement('div'))
  return { result, app }
}

export async function flush(times = 4) {
  for (let attempt = 0; attempt < times; attempt += 1) {
    await Promise.resolve()
    await nextTick()
  }
}

export function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}
