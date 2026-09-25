<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, ref, useAttrs, watch } from 'vue'
import type { AssetValue } from '../../assets/contracts'
import { useAssetAdapter } from '../../assets/provider'
import { useFormInputPending } from '../core/useFormInputState'
import { toast } from 'vue-sonner'
import ImagePreview from '@southneuhof/loom/components/base/ImagePreview.vue'
import Draggable from 'vuedraggable'
import BaseInput from './BaseInput.vue'
import { commonProps } from './commonprops'
import Button from '@southneuhof/loom/components/base/Button.vue'
import Chip from '@southneuhof/loom/components/base/Chip.vue'
import Icon from '@southneuhof/loom/components/base/Icon.vue'
import Spinner from '@southneuhof/loom/components/base/Spinner.vue'
import Popover from '@southneuhof/loom/components/base/Popover.vue'
import { Dialog, DialogContent } from '@southneuhof/loom/components/base/Dialog/index'
import type { ManagedAsset } from '../../file-manager/contracts'
import { useOptionalFileManager } from '../../file-manager/provider'
import { useUploadMutation } from './useUploadMutation'

const props = defineProps({
  modelValue: {
    type: Object,
    required: false,
  },
  maxSize: {
    type: Number,
    required: false,
    default: 5,
  },
  disableInformation: {
    type: Boolean,
    required: false,
    default: false,
  },
  multi: {
    type: Boolean,
    required: false,
    default: false,
  },
  limit: {
    type: Number,
    required: false,
    default: -1,
  },
  additionalInfo: {
    type: String,
    required: false,
    default: '',
  },
  uploadPath: {
    type: String,
    default: '',
  },
  ...commonProps,
})
defineOptions({ inheritAttrs: false })
const attrs = useAttrs()
const controlAttrs = computed(() => Object.fromEntries(
  Object.entries(attrs).filter(([key]) => key === 'id' || key.startsWith('aria-')),
))
const wrapperAttrs = computed(() => Object.fromEntries(
  Object.entries(attrs).filter(([key]) => key === 'class' || key === 'style'),
))
const fileManager = useOptionalFileManager()
const AssetPicker = defineAsyncComponent(() => import('../../file-manager/AssetPicker.vue'))
const assets = useAssetAdapter()
const mutation = useUploadMutation(() => assets.upload)
const inputPending = useFormInputPending()
let disposed = false
const pendingOperations = new Map<number, { release: () => void; released: () => boolean }>()
let operationSequence = 0
function releaseOperation(id: number) {
  const operation = pendingOperations.get(id)
  if (!operation) return
  operation.release()
  pendingOperations.delete(id)
}
onBeforeUnmount(() => {
  disposed = true
  for (const id of pendingOperations.keys()) releaseOperation(id)
})
const modelValue = defineModel<AssetValue | AssetValue[] | null>()
const emit = defineEmits<{
  (event: 'validation:touch'): void
  (event: 'validation:error', message: string | undefined): void
}>()

const uploadPercentage = computed(() => {
  const value = mutation.progress.value
  return value?.total ? Math.round((value.loaded / value.total) * 100) : undefined
})
const images = ref<AssetValue[]>([])
const invalidAsset = ref(false)
const isUploading = mutation.pending
const isDragActive = ref(false)
const isReplaceDragActive = ref(false)
const fileInput = ref<HTMLInputElement>()
const sourcePopoverOpen = ref(false)
const fileManagerOpen = ref(false)

let valueGeneration = 0
let selectionGeneration = 0

const emitData = () => {
  if (invalidAsset.value) return
  modelValue.value = props.multi ? [...images.value] : images.value[0] ?? null
}

const handleUpload = (file?: File, options: { replace?: boolean } = {}) => {
  if (!file || props.disabled || invalidAsset.value || isUploading.value) return
  if (!options.replace && !canAddImage.value) return
  if (file.size > props.maxSize * 1000000) {
    toast.error('Ukuran berkas terlalu besar')
    return
  }
  if (file.type && !file.type.startsWith('image/')) {
    toast.error('Choose an image file.')
    return
  }
  valueGeneration += 1
  const generation = valueGeneration
  const target = options.replace ? images.value[0] : undefined
  operationSequence += 1
  const operationId = operationSequence
  const operation = inputPending.begin()
  pendingOperations.set(operationId, operation)
  void (async () => {
    try {
      const uploaded = await mutation.execute(file, props.uploadPath)
      if (disposed || operation.released()) return
      const normalized = assets.read(uploaded)
      if (!normalized || (normalized.mimeType && !normalized.mimeType.startsWith('image/'))) throw new Error('Upload returned an invalid image asset.')
      if (valueGeneration !== generation) return
      if (options.replace && !props.multi && target && images.value[0] === target) {
        images.value.splice(0, 1, normalized)
      } else {
        if (options.replace) return
        images.value.push(normalized)
      }
      valueGeneration += 1
      emitData()
      emit('validation:touch')
    } catch {
      if (disposed || operation.released()) return
      toast.error(mutation.error.value?.message ?? 'Gagal mengunggah gambar')
    } finally {
      releaseOperation(operationId)
    }
  })()
}

const handleFileUpload = (e: Event) => {
  const target = e.target as HTMLInputElement
  if (props.disabled || invalidAsset.value || !canAddImage.value) {
    target.value = ''
    return
  }
  const file = target.files?.[0]
  handleUpload(file)
  target.value = ''
}

function openDevicePicker() {
  if (props.disabled || invalidAsset.value) return
  sourcePopoverOpen.value = false
  fileInput.value?.click()
}

function openFileManager() {
  if (props.disabled || invalidAsset.value || !fileManager) return
  sourcePopoverOpen.value = false
  fileManagerOpen.value = true
}

const handleDragOver = (event: DragEvent) => {
  event.preventDefault()
  if (props.disabled || invalidAsset.value || isUploading.value) return
  isDragActive.value = true
}

const handleDragLeave = (event: DragEvent) => {
  event.preventDefault()
  if (props.disabled) return
  isDragActive.value = false
}

const handleDrop = (event: DragEvent) => {
  event.preventDefault()
  isDragActive.value = false
  if (props.disabled || invalidAsset.value || isUploading.value) return
  const file = event.dataTransfer?.files?.[0]
  handleUpload(file)
}

const handleReplaceDragOver = (event: DragEvent) => {
  event.preventDefault()
  if (props.disabled || invalidAsset.value || isUploading.value || props.multi || !images.value[0]) return
  isReplaceDragActive.value = true
}

const handleReplaceDragLeave = (event: DragEvent) => {
  event.preventDefault()
  if (props.disabled) return
  isReplaceDragActive.value = false
}

const handleReplaceDrop = (event: DragEvent) => {
  event.preventDefault()
  isReplaceDragActive.value = false
  if (props.disabled || invalidAsset.value || isUploading.value || props.multi || !images.value[0]) return
  const file = event.dataTransfer?.files?.[0]
  handleUpload(file, { replace: true })
}

const removeItem = (index: number) => {
  if (props.disabled || invalidAsset.value) return
  images.value.splice(index, 1)
  valueGeneration += 1
  emitData()
  emit('validation:touch')
}

function sameAsset(left: AssetValue, right: AssetValue) {
  return left.kind === right.kind
    && left.id === right.id
    && left.url === right.url
    && left.name === right.name
    && left.size === right.size
    && left.mimeType === right.mimeType
    && left.updatedAt === right.updatedAt
    && JSON.stringify(left.metadata ?? null) === JSON.stringify(right.metadata ?? null)
}

function syncImages(value: unknown) {
  if (value === undefined || value === null) {
    if (images.value.length === 0 && !invalidAsset.value) return
    valueGeneration += 1
    images.value = []
    invalidAsset.value = false
    emit('validation:error', undefined)
    return
  }
  const values = Array.isArray(value) ? value : [value]
  const resolved = values.map((item) => assets.read(item))
  const normalized = resolved.filter((item): item is AssetValue => item !== null)
  const hasInvalidAsset = resolved.some((item) => item === null)
    || normalized.some((item) => item.mimeType !== undefined && !item.mimeType.startsWith('image/'))
  const sameValues = images.value.length === normalized.length && images.value.every((item, index) => sameAsset(item, normalized[index]))
  if (sameValues && invalidAsset.value === hasInvalidAsset) return
  valueGeneration += 1
  images.value = normalized
  invalidAsset.value = hasInvalidAsset
  emit('validation:error', hasInvalidAsset ? 'Invalid asset value.' : undefined)
}

watch(modelValue, syncImages, { immediate: true, flush: 'sync' })
watch(() => props.multi, () => { valueGeneration += 1 }, { flush: 'sync' })

const canAddImage = computed(() => !invalidAsset.value && (props.multi
  ? props.limit === -1 || images.value.length < props.limit
  : images.value.length === 0))

function clearInvalidAssets() {
  if (props.disabled || !invalidAsset.value) return
  invalidAsset.value = false
  valueGeneration += 1
  emit('validation:error', undefined)
  emitData()
  emit('validation:touch')
}

function handleChange() {
  if (props.disabled) {
    syncImages(modelValue.value)
    return
  }
  if (invalidAsset.value || !props.multi) return
  valueGeneration += 1
  emitData()
}

function allowMove() {
  return !props.disabled && !invalidAsset.value && !isUploading.value
}

function resolveDragKey(item: AssetValue, index: number): string {
  return item?.id || item?.url || `image-${index}`
}

async function selectFileManagerAsset(payload: ManagedAsset) {
  if (props.disabled || disposed || invalidAsset.value || isUploading.value) return
  if (!fileManager || payload.kind !== 'file' || !payload.mimeType?.startsWith('image/')) {
    toast.error('Berkas yang dipilih bukan gambar')
    return
  }

  const selection = ++selectionGeneration
  const generation = valueGeneration
  try {
    const value = await fileManager.values.toModel(payload)
    if (props.disabled || disposed || selection !== selectionGeneration || generation !== valueGeneration) return
    const normalized = assets.read(value)
    if (!normalized || (normalized.mimeType && !normalized.mimeType.startsWith('image/'))) {
      toast.error('Invalid asset value.')
      return
    }

    if (!props.multi) images.value = [normalized]
    else if (props.limit === -1 || images.value.length < props.limit) images.value.push(normalized)
    else return

    valueGeneration += 1
    emitData()
    emit('validation:touch')
    fileManagerOpen.value = false
  } catch (error) {
    if (props.disabled || disposed || selection !== selectionGeneration || generation !== valueGeneration) return
    toast.error(error instanceof Error ? error.message : String(error))
  }
}

watch(() => props.disabled, (disabled) => {
  if (disabled) selectionGeneration += 1
}, { flush: 'sync' })
</script>

<template>
  <BaseInput v-bind="{ ...props, ...wrapperAttrs }">
    <div class="flex flex-col gap-4">
      <div v-if="invalidAsset" role="alert" class="flex items-center gap-3 rounded-md bg-error-container p-3 text-on-error-container">
        <span>Invalid asset value.</span>
        <Button type="button" variant="text" :disabled="props.disabled" @click="clearInvalidAssets">Remove invalid values</Button>
      </div>
      <div class="flex flex-col gap-2">
        <div class="flex flex-col gap-2">
          <div v-if="!props.disableInformation" class="flex flex-col gap-2">
            <div v-if="props.multi || (!props.multi && !images[0])">
              <div class="font-bold text-tertiary">Unggah gambar yang akan digunakan</div>
              <div v-if="props.maxSize != 1000000" class="text-sm text-muted">Ukuran berkas maksimal {{ props.maxSize }} MB</div>
              <div v-if="!(props.limit == 1 || props.limit == -1)" class="text-sm text-muted">Maksimal {{ props.limit }} gambar</div>
              <div v-if="props.additionalInfo" class="mt-2">
                <Chip color="info">{{ props.additionalInfo }}</Chip>
              </div>
            </div>
            <div v-else class="font-semibold text-tertiary">{{ images.length }} gambar diunggah</div>
          </div>
          <div class="flex flex-row items-center gap-4">
            <Draggable v-if="images.length" v-model="images" :move="allowMove" :item-key="resolveDragKey" class="flex flex-row items-center gap-4" @change="handleChange">
              <template #item="{ element, index }">
                <div
                  class="overlay w-fit cursor-move rounded-xl after:bg-on-surface-hover focus-visible:after:bg-on-surface-active active:after:bg-on-surface-active"
                  :class="{ 'after:bg-tertiary-drag after:opacity-100 outline outline-1 outline-primary/[33%]': isReplaceDragActive && !props.multi && index === 0 }"
                  @dragover="handleReplaceDragOver"
                  @dragleave="handleReplaceDragLeave"
                  @drop="handleReplaceDrop"
                >
                  <ImagePreview v-if="element" :asset="element">
                    <template #actions>
                      <Button color="error" kind="icon" ariaLabel="Remove image" :disabled="props.disabled || invalidAsset" @click="removeItem(index)" type="button">
                        <template #icon>
                          <Icon name="delete-bin"></Icon>
                        </template>
                      </Button>
                    </template>
                  </ImagePreview>
                </div>
              </template>
            </Draggable>
            <template v-if="!isUploading">
              <Popover v-if="canAddImage" v-model="sourcePopoverOpen" contentClass="p-0">
                <template #trigger>
                  <button
                    type="button"
                    :disabled="props.disabled || invalidAsset"
                    class="overlay relative flex h-40 w-40 items-center justify-center rounded-xl outline-dashed outline-2 outline-outline-variant after:bg-on-surface-hover focus-visible:after:bg-on-surface-active active:after:bg-on-surface-active"
                    :class="{ 'after:bg-primary-drag after:opacity-100 outline-primary/[33%]': isDragActive }"
                    @dragover="handleDragOver"
                    @dragleave="handleDragLeave"
                    @drop="handleDrop"
                  >
                    <Icon name="image-add" size="2xl" class="text-on-surface"></Icon>
                    <div class="absolute left-0 top-0 h-full w-full">
                      <div v-if="uploadPercentage != 0 && uploadPercentage != 100" class="absolute h-40 w-40 rounded-xl" :style="{ width: uploadPercentage + '%' }"></div>
                    </div>
                  </button>
                </template>
                <template #content>
                  <div class="flex flex-col">
                  <button type="button" :disabled="props.disabled || invalidAsset" class="overlay flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm after:bg-on-surface-hover focus-visible:after:bg-on-surface-active active:after:bg-on-surface-active" @click="openDevicePicker">
                      <Icon name="upload-cloud" size="sm" />
                      <span>Upload from device</span>
                    </button>
                  <button v-if="fileManager" type="button" :disabled="props.disabled || invalidAsset" class="overlay flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm after:bg-on-surface-hover focus-visible:after:bg-on-surface-active active:after:bg-on-surface-active" @click="openFileManager">
                      <Icon name="folder-2" size="sm" />
                      <span>Choose from file manager</span>
                    </button>
                  </div>
                </template>
              </Popover>
              <input v-bind="controlAttrs" ref="fileInput" type="file" hidden :disabled="props.disabled || invalidAsset || !canAddImage" :accept="'image/*'" class="rounded-md p-2" @change="handleFileUpload($event)" />
            </template>
            <div v-else class="relative flex h-40 w-40 flex-col items-center justify-center rounded-xl outline-dashed outline-2 outline-outline">
              <Spinner />
              <p class="text-xs">Uploading...</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </BaseInput>
  <Dialog v-model:open="fileManagerOpen">
    <DialogContent class="flex h-[60vh] max-w-[60vw] flex-col">
      <AssetPicker :accept="(asset) => asset.kind === 'file' && !!asset.mimeType?.startsWith('image/')" @select="selectFileManagerAsset" @cancel="fileManagerOpen = false" />
    </DialogContent>
  </Dialog>
</template>
