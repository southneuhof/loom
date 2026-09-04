import { onScopeDispose, watch, type Ref } from 'vue'

export type PageReadinessState = 'loading' | 'ready' | 'error'

type TrackedLoader = {
  generation: number
  loading: Readonly<Ref<boolean>>
  error: Readonly<Ref<unknown>>
}

function errorText(error: unknown) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message
  return undefined
}

const loaders = new Set<TrackedLoader>()
let generation = 0
let navigationSettled = false
let evaluation = 0

function writeState(state: PageReadinessState, error?: unknown) {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.pageState = state
  const message = errorText(error)
  if (message) document.documentElement.dataset.pageError = message
  else if (state !== 'error') delete document.documentElement.dataset.pageError
}

function afterPaint(callback: () => void) {
  if (typeof window === 'undefined') {
    setTimeout(callback, 0)
    return
  }
  window.requestAnimationFrame(() => window.requestAnimationFrame(callback))
}

function scheduleEvaluation() {
  const currentEvaluation = ++evaluation
  const currentGeneration = generation
  queueMicrotask(() => {
    if (currentEvaluation !== evaluation || !navigationSettled) return

    const currentLoaders = [...loaders].filter((loader) => loader.generation === currentGeneration)
    const loaderError = currentLoaders.find((loader) => loader.error.value)?.error.value
    if (loaderError) {
      writeState('error', loaderError)
      return
    }
    if (currentLoaders.some((loader) => loader.loading.value)) {
      writeState('loading')
      return
    }

    afterPaint(() => {
      if (currentEvaluation !== evaluation || currentGeneration !== generation || !navigationSettled) return
      const latestLoaders = [...loaders].filter((loader) => loader.generation === currentGeneration)
      const latestLoaderError = latestLoaders.find((loader) => loader.error.value)?.error.value
      if (latestLoaderError) writeState('error', latestLoaderError)
      else if (latestLoaders.some((loader) => loader.loading.value)) writeState('loading')
      else writeState('ready')
    })
  })
}

export function beginPageReadiness() {
  generation += 1
  navigationSettled = false
  evaluation += 1
  writeState('loading')
}

export function markPageNavigationSettled() {
  navigationSettled = true
  scheduleEvaluation()
}

export function setPageReadinessError(error?: unknown) {
  evaluation += 1
  navigationSettled = true
  writeState('error', error)
}

export function registerPageLoader(
  loading: Readonly<Ref<boolean>>,
  error: Readonly<Ref<unknown>>,
) {
  const trackedLoader = { generation, loading, error }
  loaders.add(trackedLoader)
  const stop = watch([loading, error], scheduleEvaluation, { immediate: true })

  onScopeDispose(() => {
    stop()
    loaders.delete(trackedLoader)
    scheduleEvaluation()
  })
}
