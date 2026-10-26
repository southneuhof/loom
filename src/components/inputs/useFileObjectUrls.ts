import { onBeforeUnmount, shallowRef, watch } from 'vue'

export function useFileObjectUrls(files: () => readonly File[]) {
  const urls = shallowRef(new Map<File, string>())

  function sync(nextFiles: readonly File[]): void {
    const next = new Set(nextFiles)
    const current = new Map(urls.value)
    for (const [file, url] of current) {
      if (next.has(file)) continue
      URL.revokeObjectURL(url)
      current.delete(file)
    }
    for (const file of next) {
      if (current.has(file)) continue
      try {
        current.set(file, URL.createObjectURL(file))
      } catch {
        continue
      }
    }
    urls.value = current
  }

  watch(files, sync, { immediate: true, flush: 'sync' })
  onBeforeUnmount(() => {
    for (const url of urls.value.values()) URL.revokeObjectURL(url)
    urls.value.clear()
  })

  return (file: File): string | undefined => urls.value.get(file)
}
