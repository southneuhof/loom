import { onBeforeUnmount, ref } from 'vue'
import type { FileManagerOperations, ManagedAsset } from './contracts'

export function useDirectoryList(operations: FileManagerOperations) {
  const assets = ref<ManagedAsset[]>([])
  const loading = ref(false)
  const error = ref<string>()
  let active: AbortController | undefined

  async function load(parentId: string | null): Promise<boolean> {
    active?.abort()
    const controller = new AbortController()
    active = controller
    const { signal } = controller
    loading.value = true
    error.value = undefined
    try {
      const result = await operations.list({ parentId, signal })
      if (signal.aborted) return false
      assets.value = result.data
      return true
    } catch (cause) {
      if (!signal.aborted) error.value = cause instanceof Error ? cause.message : String(cause)
      return false
    } finally {
      if (!signal.aborted) loading.value = false
    }
  }

  onBeforeUnmount(() => active?.abort())
  return { assets, loading, error, load }
}
