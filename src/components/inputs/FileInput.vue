<script setup lang="ts">
import { defineAsyncComponent, ref, watch, computed, onBeforeUnmount, useAttrs } from 'vue'
import type { UploadProgress } from '../../contracts'
import type { AssetValue } from '../../assets/contracts'
import { useAssetAdapter } from '../../assets/provider'
import { useFormInputPending } from '../core/useFormInputState'
import FileComponent from '@southneuhof/loom/components/utils/FileComponent.vue'
import { toast } from 'vue-sonner'
import BaseInput from './BaseInput.vue'
import { commonProps } from './commonprops'
import { MIME_TYPE_NAMES } from '@southneuhof/utilities/object'
import Icon from '@southneuhof/loom/components/base/Icon.vue'
import Tooltip from '@southneuhof/loom/components/base/Tooltip.vue'
import Button from '@southneuhof/loom/components/base/Button.vue'
import Popover from '@southneuhof/loom/components/base/Popover.vue'
import { Dialog, DialogContent } from '@southneuhof/loom/components/base/Dialog/index'
import { useDropZone } from '@vueuse/core'
import type { ManagedAsset } from '../../file-manager/contracts'
import { useOptionalFileManager } from '../../file-manager/provider'
import { useUploadMutation } from './useUploadMutation'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  accept: {
    type: Array<string>,
    required: false,
    default: undefined,
  },
  maxSize: {
    type: Number,
    required: false,
    default: undefined,
  },
  multi: {
    type: Boolean,
    required: false,
    default: false,
  },
  uploadPath: {
    type: String,
    default: '',
  },
  ...commonProps,
})
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
const pendingOperations = new Map<string, { release: () => void; released: () => boolean }>()
function releaseOperation(id: string) {
  const operation = pendingOperations.get(id)
  if (!operation) return
  operation.release()
  pendingOperations.delete(id)
}
onBeforeUnmount(() => {
  disposed = true
  for (const id of pendingOperations.keys()) releaseOperation(id)
})
const emit = defineEmits<{
  (event: 'validation:touch'): void
  (event: 'validation:error', message: string | undefined): void
}>()

const acceptTypes = computed(() => props.accept ?? [])
const maxFileSize = computed(() => props.maxSize ?? 10)
const acceptTypesPretty = computed(() => acceptTypes.value.map((type: string) => MIME_TYPE_NAMES[type] ?? type))

type PersistedFileRow = {
  id: string
  kind: 'persisted'
  item: AssetValue
}

type InvalidFileRow = {
  id: string
  kind: 'invalid'
}

type PendingFileRow = {
  id: string
  kind: 'pending'
  file: File
  progress?: UploadProgress
}

type FileRow = PersistedFileRow | InvalidFileRow | PendingFileRow

const rows = ref<FileRow[]>([])
const invalidAsset = ref(false)
let targetGeneration = 0
let selectionGeneration = 0
let rowSequence = 0
const sourcePopoverOpen = ref(false)
const fileManagerOpen = ref(false)
const fileInput = ref<HTMLInputElement>()
const dropZoneRef = ref<HTMLDivElement>()

const modelValue = defineModel<AssetValue | AssetValue[] | null>()

function nextRowID() {
  rowSequence += 1
  return `file-upload-${rowSequence}`
}

function persistedRow(item: AssetValue): PersistedFileRow {
  return { id: nextRowID(), kind: 'persisted', item }
}

function invalidRow(): InvalidFileRow {
  return { id: nextRowID(), kind: 'invalid' }
}

function persistedItems() {
  return rows.value.flatMap((row) => row.kind === 'persisted' ? [row.item] : [])
}

function cancelPendingRows() {
  for (const id of pendingOperations.keys()) releaseOperation(id)
}

function emitChanges() {
  if (invalidAsset.value) return
  const items = persistedItems()
  if (props.multi) modelValue.value = items
  else modelValue.value = items[0] || null
  emit('validation:error', undefined)
}

function progressPercentage(progress?: UploadProgress) {
  if (!progress?.total || progress.total <= 0) return undefined
  return Math.min(100, Math.max(0, Math.round((progress.loaded / progress.total) * 100)))
}

function sameAsset(left: AssetValue, right: AssetValue) {
  return left.id === right.id
    && left.kind === right.kind
    && left.url === right.url
    && left.name === right.name
    && left.size === right.size
    && left.mimeType === right.mimeType
    && left.updatedAt === right.updatedAt
    && JSON.stringify(left.metadata ?? null) === JSON.stringify(right.metadata ?? null)
}

function syncPersistedRows(value: unknown) {
  if (value === undefined || value === null) {
    const current = persistedItems()
    if (current.length === 0 && !invalidAsset.value) return
    cancelPendingRows()
    rows.value = []
    targetGeneration += 1
    invalidAsset.value = false
    emit('validation:error', undefined)
    return
  }
  const values = Array.isArray(value) ? value : [value]
  const resolved = values.map((item) => assets.read(item))
  const normalized = resolved.filter((item): item is AssetValue => item !== null)
  const hasInvalidAsset = resolved.some((item) => item === null)
  const current = persistedItems()
  const sameValues = current.length === normalized.length && current.every((item, index) => sameAsset(item, normalized[index]))
  if (sameValues && invalidAsset.value === hasInvalidAsset) return
  if (!sameValues || hasInvalidAsset !== invalidAsset.value) cancelPendingRows()

  rows.value = [...normalized.map((item) => persistedRow(item)), ...(hasInvalidAsset ? [invalidRow()] : [])]
  targetGeneration += 1
  invalidAsset.value = hasInvalidAsset
  emit('validation:error', hasInvalidAsset ? 'Invalid asset value.' : undefined)
}

function startFileUpload(file: File) {
  if (props.disabled || invalidAsset.value) return
  const row: PendingFileRow = { id: nextRowID(), kind: 'pending', file }
  rows.value.push(row)
  targetGeneration += 1
  const operation = inputPending.begin()
  pendingOperations.set(row.id, operation)

  void (async () => {
    try {
      const uploaded = await mutation.execute(file, props.uploadPath, (progress) => {
        const current = rows.value.find(
          (candidate): candidate is PendingFileRow => candidate.id === row.id && candidate.kind === 'pending',
        )
        if (current) current.progress = progress
      })
      if (disposed || operation.released()) return
      const normalized = assets.read(uploaded)
      if (!normalized) throw new Error('Upload returned an invalid asset.')
      const index = rows.value.findIndex((candidate) => candidate.id === row.id && candidate.kind === 'pending')
      if (index === -1) return
      rows.value.splice(index, 1, { id: row.id, kind: 'persisted', item: normalized })
      emitChanges()
      emit('validation:touch')
    } catch (err) {
      if (disposed || operation.released()) return
      const index = rows.value.findIndex((candidate) => candidate.id === row.id && candidate.kind === 'pending')
      if (index !== -1) rows.value.splice(index, 1)
      toast.error(`Gagal mengunggah berkas: ${mutation.error.value?.message ?? String(err)}`)
    } finally {
      releaseOperation(row.id)
    }
  })()
}

const handleFileUpload = (files: File | File[]) => {
  if (props.disabled || invalidAsset.value) return
  const incomingFiles = Array.isArray(files) ? files : [files]
  const fileArray = props.multi ? incomingFiles : incomingFiles.slice(0, 1)

  fileArray.forEach((file) => {
    if (!props.multi && rows.value.length > 0) return
    if (!validateFileLike(file.type, file.size)) return
    startFileUpload(file)
  })
}

function handleInputChange(event: Event) {
  const target = event.target as HTMLInputElement
  if (props.disabled) {
    target.value = ''
    return
  }
  handleFileUpload(Array.from(target.files ?? []))
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

function validateFileLike(contentType?: string, size?: number): boolean {
  if (acceptTypes.value.length > 0 && contentType && !acceptTypes.value.includes(contentType)) {
    toast.error(`Tipe berkas tidak didukung. Tipe berkas yang diterima adalah ${acceptTypes.value.join(', ')}`)
    return false
  }
  if (typeof size === 'number' && size > maxFileSize.value * 1024 * 1024) {
    toast.error(`Ukuran berkas terlalu besar. Maksimal ${maxFileSize.value}MB`)
    return false
  }
  return true
}

async function selectFileManagerAsset(payload: ManagedAsset) {
  if (props.disabled || disposed || invalidAsset.value || !fileManager || payload.kind === 'folder') return
  const selection = ++selectionGeneration
  const target = targetGeneration
  const model = await fileManager.values.toModel(payload)
  if (props.disabled || disposed || selection !== selectionGeneration || target !== targetGeneration) return
  const normalized = assets.read(model)
  if (!normalized) {
    toast.error('Invalid asset value.')
    return
  }
  if (!validateFileLike(normalized.mimeType, normalized.size)) return

  if (props.multi) rows.value.push(persistedRow(normalized))
  else rows.value = [persistedRow(normalized)]
  targetGeneration += 1

  emitChanges()
  emit('validation:touch')
  fileManagerOpen.value = false
}

function handleFileDelete(id: string) {
  if (props.disabled) return
  const index = rows.value.findIndex((row) => row.id === id)
  if (index === -1) return
  const row = rows.value[index]
  if (invalidAsset.value && row.kind !== 'invalid') return
  if (row.kind === 'pending') releaseOperation(id)
  rows.value.splice(index, 1)
  if (row.kind === 'invalid') {
    invalidAsset.value = false
    emit('validation:error', undefined)
  }
  targetGeneration += 1
  emitChanges()
  emit('validation:touch')
}

watch(modelValue, syncPersistedRows, { immediate: true, flush: 'sync' })
watch(() => props.disabled, (disabled) => {
  if (disabled) selectionGeneration += 1
}, { flush: 'sync' })

function onDrop(files?: File[] | null) {
  if (!props.disabled && files?.length) handleFileUpload(files)
}

const { isOverDropZone } = useDropZone(dropZoneRef, onDrop)
const canAddFile = computed(() => !invalidAsset.value && (props.multi || rows.value.length === 0))
</script>

<template>
  <BaseInput v-bind="{ ...props, ...wrapperAttrs }">
    <input
      v-bind="controlAttrs"
      ref="fileInput"
      type="file"
      hidden
      :disabled="props.disabled || (!props.multi && rows.length > 0)"
      :multiple="props.multi"
      :accept="acceptTypes.join(',') || undefined"
      class="rounded-md p-2"
      @change="handleInputChange"
    />
    <div class="flex flex-col gap-4">
      <div v-if="rows.length > 0" class="flex flex-row flex-wrap items-center gap-4">
        <template v-for="row in rows" :key="row.id">
          <FileComponent
            v-if="row.kind === 'persisted'"
            :asset="row.item"
            :action="props.disabled ? undefined : {
              label: 'Hapus',
              action: () => handleFileDelete(row.id),
            }"
          />
          <div
            v-else-if="row.kind === 'pending'"
            v-bind="{ 'data-upload-id': row.id, 'data-testid': 'file-upload-progress' }"
            class="relative flex max-w-max overflow-hidden rounded-md bg-surface-container p-4"
          >
            <div
              class="absolute inset-y-0 left-0 bg-surface-container-high transition-[width] duration-200"
              :class="progressPercentage(row.progress) == null ? 'w-2/5 animate-pulse' : ''"
              :style="progressPercentage(row.progress) == null ? undefined : { width: `${progressPercentage(row.progress)}%` }"
            />
            <div class="relative flex items-center gap-4">
              <Icon name="file" />
              <div class="flex flex-col gap-1">
                <div class="text-sm">{{ row.file.name }}</div>
                <p role="status" aria-live="polite" class="text-sm text-on-surface-variant">
                  Mengunggah<span v-if="progressPercentage(row.progress) != null"> {{ progressPercentage(row.progress) }}%</span>
                </p>
              </div>
              <Button type="button" kind="icon" color="error" ariaLabel="Remove pending upload" :disabled="props.disabled" @click="handleFileDelete(row.id)">
                <template #icon><Icon name="delete-bin" /></template>
              </Button>
            </div>
          </div>
          <div v-else role="alert" class="flex items-center gap-3 rounded-md bg-error-container p-3 text-on-error-container">
            <span>Invalid asset value.</span>
            <Button type="button" variant="text" :disabled="props.disabled" @click="handleFileDelete(row.id)">Remove invalid value</Button>
          </div>
        </template>
      </div>
      <div v-if="canAddFile" class="flex flex-col gap-2">
        <div ref="dropZoneRef" class="overlay flex w-full flex-col items-center justify-center gap-4 rounded-md py-8 outline-dashed outline-2 outline-outline-variant after:bg-on-surface-hover focus-visible:after:bg-on-surface-active active:after:bg-on-surface-active" :class="{ 'after:bg-primary-drag after:opacity-100 outline-primary/[33%]': isOverDropZone }">
          <div v-if="!isOverDropZone" class="flex flex-row items-center gap-4">
            <div class="text-black-light font-bold">Letakkan file anda di sini</div>
            <div class="text-black-light">/</div>
            <Popover v-model="sourcePopoverOpen" contentClass="p-0">
              <template #trigger>
                <Button type="button" :disabled="props.disabled">
                  <template #icon>
                    <Icon name="add-circle"></Icon>
                  </template>
                  <div>Pilih sumber file</div>
                </Button>
              </template>
              <template #content>
                <div class="flex flex-col">
                  <button type="button" :disabled="props.disabled" class="overlay flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm after:bg-on-surface-hover focus-visible:after:bg-on-surface-active active:after:bg-on-surface-active" @click="openDevicePicker">
                    <Icon name="upload-cloud" size="sm" />
                    <span>Upload from device</span>
                  </button>
                  <button v-if="fileManager" type="button" :disabled="props.disabled" class="overlay flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm after:bg-on-surface-hover focus-visible:after:bg-on-surface-active active:after:bg-on-surface-active" @click="openFileManager">
                    <Icon name="folder-2" size="sm" />
                    <span>Choose from file manager</span>
                  </button>
                </div>
              </template>
            </Popover>
          </div>
          <div v-else>
            <div class="flex flex-col items-center justify-center gap-4">
              <div><Icon name="upload-cloud"></Icon></div>
              <div class="text-black-light font-bold">Lepaskan kursor untuk mengunggah</div>
            </div>
          </div>
        </div>
        <div v-if="acceptTypes.length > 0 || maxSize" class="flex flex-row gap-4">
          <div class="flex flex-row items-center gap-2">
            <Tooltip v-if="acceptTypes.length > 0 || maxSize">
              <template #trigger>
                <div class="flex flex-row items-center gap-1 text-muted">
                  <Icon name="information" size="xs" :fill="true"></Icon>
                  <p class="text-sm">File yang diterima</p>
                </div>
              </template>
              <template #content>
                <div class="flex flex-col gap-2">
                  <div v-if="acceptTypes.length > 0" class="flex flex-col">
                    <p class="text-sm uppercase text-white/[67%]">Tipe File</p>
                    <p class="text-sm">{{ acceptTypesPretty.join(', ') }}</p>
                  </div>
                  <div v-if="maxFileSize" class="flex flex-col">
                    <p class="text-sm uppercase text-white/[67%]">Maksimal Ukuran File</p>
                    <p class="text-sm">{{ maxFileSize }}MB</p>
                  </div>
                </div>
              </template>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  </BaseInput>
  <Dialog v-model:open="fileManagerOpen">
    <DialogContent class="flex h-[60vh] max-w-[60vw] flex-col">
      <AssetPicker @select="selectFileManagerAsset" @cancel="fileManagerOpen = false" />
    </DialogContent>
  </Dialog>
</template>
