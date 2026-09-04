import { computed, onBeforeUnmount, ref } from 'vue'
import type { SubmitError, UploadOperation, UploadProgress } from '../../contracts'
import { useFrameworkAdapters } from '../../adapters/projectAdapters'

export function useUploadMutation<TResult>(operation: () => UploadOperation<TResult> | undefined) {
  const adapters = useFrameworkAdapters()
  const pendingCount = ref(0)
  const progress = ref<UploadProgress>()
  const error = ref<SubmitError>()
  const controllers = new Set<AbortController>()

  async function execute(
    file: Blob,
    destination?: string,
    onProgress?: (value: UploadProgress) => void,
  ): Promise<TResult> {
    const upload = operation()
    if (!upload) throw new Error('[loom] Upload operation is not configured.')
    const controller = new AbortController()
    controllers.add(controller)
    pendingCount.value += 1
    error.value = undefined
    try {
      return await upload(file, {
        destination,
        signal: controller.signal,
        onProgress: (value) => {
          progress.value = value
          onProgress?.(value)
        },
      })
    } catch (reason) {
      error.value = adapters.data.normalizeError(reason)
      throw reason
    } finally {
      controllers.delete(controller)
      pendingCount.value -= 1
      if (pendingCount.value === 0) progress.value = undefined
    }
  }

  function cancel() {
    for (const controller of controllers) controller.abort()
    controllers.clear()
  }

  onBeforeUnmount(cancel)
  return { execute, cancel, pending: computed(() => pendingCount.value > 0), pendingCount, progress, error }
}
