<script setup lang="ts" generic="TMode extends FileInputMode = 'asset', TMulti extends boolean = false">
import { computed, defineAsyncComponent, ref, useAttrs } from 'vue'
import type { FileInputMode, FileInputModelValue, ImageInputProps } from './fileInput.types'
import type { FileInputRow } from './useFileInputController'
import { useFileInputController } from './useFileInputController'
import { useFileAcquisition } from './useFileAcquisition'
import { useFileObjectUrls } from './useFileObjectUrls'
import ImagePreview from '@southneuhof/loom/components/base/ImagePreview.vue'
import Draggable from 'vuedraggable'
import BaseInput from './BaseInput.vue'
import Button from '@southneuhof/loom/components/base/Button.vue'
import Chip from '@southneuhof/loom/components/base/Chip.vue'
import Icon from '@southneuhof/loom/components/base/Icon.vue'
import Spinner from '@southneuhof/loom/components/base/Spinner.vue'
import Popover from '@southneuhof/loom/components/base/Popover.vue'
import { Dialog, DialogContent } from '@southneuhof/loom/components/base/Dialog/index'
import type { ManagedAsset } from '../../file-manager/contracts'
import { useOptionalFileManager } from '../../file-manager/provider'

defineOptions({ inheritAttrs: false })

const props = defineProps<ImageInputProps<TMode, TMulti>>()
const modelValue = defineModel<FileInputModelValue<TMode, TMulti>>()
const emit = defineEmits<{
  (event: 'validation:touch'): void
  (event: 'validation:error', message: string | undefined): void
}>()
const attrs = useAttrs()
const fileManager = useOptionalFileManager()
const AssetPicker = defineAsyncComponent(() => import('../../file-manager/AssetPicker.vue'))
const mode = computed<FileInputMode>(() => props.mode ?? 'asset')
const multi = computed(() => props.multi ?? false)
const acceptTypes = computed(() => props.accept ?? ['image/*'])
const maxFileSize = computed(() => props.maxSize ?? 10)
const wrapperAttrs = computed(() => Object.fromEntries(Object.entries(attrs).filter(([key]) => key === 'class' || key === 'style')))
const controlAttrs = computed(() => Object.fromEntries(Object.entries(attrs).filter(([key]) => key === 'id' || key.startsWith('aria-'))))
const controller = useFileInputController({
  mode: () => mode.value,
  multi: () => multi.value,
  accept: () => acceptTypes.value,
  maxSize: () => maxFileSize.value,
  limit: () => props.limit,
  disabled: () => props.disabled ?? false,
  imageOnly: true,
  destination: () => props.destination,
  transform: () => props.transform,
  upload: () => props.upload,
  modelValue: () => modelValue.value,
  setModelValue: (value) => { modelValue.value = value as FileInputModelValue<TMode, TMulti> },
  error: () => props.error,
  validationError: (message) => emit('validation:error', message),
  validationTouch: () => emit('validation:touch'),
})
const acquisition = useFileAcquisition({
  disabled: () => props.disabled || controller.invalidModel.value,
  acceptFiles: controller.acceptFiles,
})
const fileInput = acquisition.input
const dropZone = acquisition.dropZone
const isOverDropZone = acquisition.isOverDropZone
const handleInputChange = acquisition.handleInputChange
const handleDrop = acquisition.handleDrop
const rows = controller.rows
const inputError = controller.inputError
const invalidModel = controller.invalidModel
const pending = controller.pending
const pendingCount = controller.pendingCount
const values = controller.values
const sourcePopoverOpen = ref(false)
const fileManagerOpen = ref(false)
const isAssetMode = computed(() => mode.value === 'asset')
const canAddImage = computed(() => {
  if (invalidModel.value) return false
  if (!multi.value) return !pending.value && (props.limit === undefined || props.limit > 0)
  return props.limit === undefined || values.value.length + pendingCount.value < props.limit
})
const imageRows = computed<Extract<FileInputRow, { kind: 'value' }>[]>({
  get: () => rows.value.filter((row): row is Extract<FileInputRow, { kind: 'value' }> => row.kind === 'value'),
  set: (rows) => controller.reorder(rows.map((row) => row.id)),
})
const localFiles = computed(() => controller.values.value.flatMap((value) => value.kind === 'file' ? [value.file] : []))
const objectUrl = useFileObjectUrls(() => localFiles.value)

function previewUrl(value: Extract<FileInputRow, { kind: 'value' }>['value']): string | undefined {
  if (value.kind === 'file') return objectUrl(value.file)
  return controller.assetPreview(value.asset)?.imageURL
}

function progressPercentage(progress?: { loaded: number; total?: number }): number | undefined {
  if (!progress?.total || progress.total <= 0) return undefined
  return Math.min(100, Math.max(0, Math.round((progress.loaded / progress.total) * 100)))
}

function allowMove(): boolean {
  return !props.disabled && !controller.invalidModel.value && !controller.pending.value && multi.value
}

function handleDragOver(event: DragEvent): void {
  event.preventDefault()
  if (props.disabled || invalidModel.value) return
}

function openDevicePicker(): void {
  if (props.disabled || controller.invalidModel.value || !canAddImage.value) return
  sourcePopoverOpen.value = false
  acquisition.openPicker()
}

function openFileManager(): void {
  if (props.disabled || invalidModel.value || !fileManager || !isAssetMode.value || !canAddImage.value) return
  sourcePopoverOpen.value = false
  fileManagerOpen.value = true
}

async function selectFileManagerAsset(payload: ManagedAsset): Promise<void> {
  if (props.disabled || invalidModel.value || payload.kind !== 'file' || !fileManager || !isAssetMode.value) return
  if (payload.mimeType && !payload.mimeType.startsWith('image/')) {
    controller.reportError('Choose an image file.')
    return
  }
  const accepted = await controller.acquireStoredAsset(() => fileManager.values.toModel(payload))
  if (accepted) fileManagerOpen.value = false
}
</script>

<template>
  <BaseInput
    v-bind="{ ...props, ...wrapperAttrs, ...controlAttrs }"
    :error="props.error || inputError || ''"
    v-slot="{ controlBindings }"
  >
    <div class="flex flex-col gap-4">
      <div v-if="invalidModel" class="flex items-center gap-3 rounded-md bg-error-container p-3 text-on-error-container">
        <Button type="button" variant="text" :disabled="props.disabled" @click="controller.clearInvalid">Remove invalid value</Button>
      </div>
      <Button v-if="inputError && !invalidModel" type="button" variant="text" :disabled="props.disabled" @click="controller.clear">
        Clear image selection
      </Button>
      <div class="flex flex-col gap-2">
        <div v-if="!props.disableInformation" class="flex flex-col gap-2">
          <div v-if="multi || imageRows.length === 0">
            <div class="font-bold text-tertiary">Unggah gambar yang akan digunakan</div>
            <div class="text-sm text-muted">Ukuran berkas maksimal {{ maxFileSize }} MB</div>
            <div v-if="props.limit !== undefined" class="text-sm text-muted">Maksimal {{ props.limit }} gambar</div>
            <div v-if="props.additionalInfo" class="mt-2"><Chip color="info">{{ props.additionalInfo }}</Chip></div>
          </div>
          <div v-else class="font-semibold text-tertiary">{{ imageRows.length }} gambar dipilih</div>
        </div>
        <div class="flex flex-row items-center gap-4">
          <Draggable v-if="imageRows.length" v-model="imageRows" :move="allowMove" item-key="id" class="flex flex-row items-center gap-4">
            <template #item="{ element, index }">
              <div
                class="overlay w-fit cursor-move rounded-xl after:bg-on-surface-hover focus-visible:after:bg-on-surface-active active:after:bg-on-surface-active"
                @dragover="handleDragOver"
                @drop="handleDrop"
              >
                <ImagePreview :image-u-r-l="element.value.kind === 'file' ? previewUrl(element.value) : undefined" :thumbnail-u-r-l="element.value.kind === 'file' ? previewUrl(element.value) : undefined" :asset="element.value.kind === 'asset' ? element.value.asset : undefined" class="h-40 w-40">
                  <template #actions>
                    <Button color="error" kind="icon" ariaLabel="Remove image" :disabled="props.disabled || invalidModel" type="button" @click="controller.remove(element.id)">
                      <template #icon><Icon name="delete-bin" /></template>
                    </Button>
                  </template>
                  <template #image-description>{{ element.value.kind === 'file' ? element.value.file.name : element.value.asset.name }}</template>
                </ImagePreview>
              </div>
            </template>
          </Draggable>
          <div v-for="row in rows.filter((item) => item.kind === 'pending')" :key="row.id" v-bind="{ 'data-testid': 'file-upload-progress' }" class="relative flex h-40 w-40 flex-col items-center justify-center gap-2 rounded-xl outline-dashed outline-2 outline-outline">
            <Spinner />
            <p role="status" aria-live="polite" class="text-xs">{{ row.stage === 'uploading' ? 'Uploading...' : 'Processing...' }}</p>
            <span v-if="progressPercentage(row.progress) != null" class="text-xs">{{ progressPercentage(row.progress) }}%</span>
            <Button type="button" kind="icon" color="error" ariaLabel="Remove pending image" :disabled="props.disabled" @click="controller.remove(row.id)">
              <template #icon><Icon name="delete-bin" /></template>
            </Button>
          </div>
          <Popover v-if="canAddImage && (multi || rows.length === 0)" v-model="sourcePopoverOpen" contentClass="p-0">
            <template #trigger>
              <button
                ref="dropZone"
                type="button"
                :disabled="props.disabled || invalidModel"
                class="overlay relative flex h-40 w-40 items-center justify-center rounded-xl outline-dashed outline-2 outline-outline-variant after:bg-on-surface-hover focus-visible:after:bg-on-surface-active active:after:bg-on-surface-active"
                :class="{ 'after:bg-primary-drag after:opacity-100 outline-primary/[33%]': isOverDropZone }"
                @dragover="handleDragOver"
              >
                <Icon name="image-add" size="2xl" class="text-on-surface" />
                <div class="absolute left-0 top-0 h-full w-full">
                <div v-if="pending" class="absolute h-40 w-40 rounded-xl bg-surface-container-high/50" />
                </div>
              </button>
            </template>
            <template #content>
              <div class="flex flex-col">
                <button type="button" :disabled="props.disabled || !canAddImage" class="overlay flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm after:bg-on-surface-hover focus-visible:after:bg-on-surface-active active:after:bg-on-surface-active" @click="openDevicePicker">
                  <Icon name="upload-cloud" size="sm" />
                  <span>Upload from device</span>
                </button>
                <button v-if="fileManager && isAssetMode" type="button" :disabled="props.disabled || !canAddImage" class="overlay flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm after:bg-on-surface-hover focus-visible:after:bg-on-surface-active active:after:bg-on-surface-active" @click="openFileManager">
                  <Icon name="folder-2" size="sm" />
                  <span>Choose from file manager</span>
                </button>
              </div>
            </template>
          </Popover>
          <input
            v-bind="{ ...controlAttrs, ...controlBindings, required: false }"
            ref="fileInput"
            type="file"
            hidden
            :disabled="props.disabled || invalidModel || !canAddImage"
            :multiple="multi"
            :accept="acceptTypes.join(',') || undefined"
            class="rounded-md p-2"
            @change="handleInputChange"
          />
        </div>
      </div>
    </div>
  </BaseInput>
  <Dialog v-if="fileManager && isAssetMode" v-model:open="fileManagerOpen">
    <DialogContent class="flex h-[60vh] max-w-[60vw] flex-col">
      <AssetPicker :accept="(asset) => asset.kind === 'file' && !!asset.mimeType?.startsWith('image/')" @select="selectFileManagerAsset" @cancel="fileManagerOpen = false" />
    </DialogContent>
  </Dialog>
</template>
