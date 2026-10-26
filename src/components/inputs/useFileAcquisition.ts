import { ref } from 'vue'
import { useDropZone } from '@vueuse/core'

export function useFileAcquisition(options: {
  disabled: () => boolean
  acceptFiles: (files: readonly File[]) => void
}) {
  const input = ref<HTMLInputElement>()
  const dropZone = ref<HTMLElement>()
  const { isOverDropZone } = useDropZone(dropZone, (files) => {
    if (!options.disabled() && files?.length) options.acceptFiles(files)
  })

  function handleInputChange(event: Event): void {
    if (!(event.currentTarget instanceof HTMLInputElement)) return
    const target = event.currentTarget
    if (!options.disabled()) options.acceptFiles(Array.from(target.files ?? []))
    target.value = ''
  }

  function handleDrop(event: DragEvent): void {
    event.preventDefault()
    if (options.disabled() || !event.dataTransfer) return
    options.acceptFiles(Array.from(event.dataTransfer.files))
  }

  function openPicker(): void {
    if (!options.disabled()) input.value?.click()
  }

  return { input, dropZone, isOverDropZone, handleInputChange, handleDrop, openPicker }
}
