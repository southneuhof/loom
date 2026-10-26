<script setup lang="ts" generic="TMode extends FileInputMode = 'asset', TMulti extends boolean = false">
import { computed, defineAsyncComponent, ref, useAttrs } from 'vue'
import { MIME_TYPE_NAMES } from '@southneuhof/utilities/object'
import FileComponent from '@southneuhof/loom/components/utils/FileComponent.vue'
import Icon from '@southneuhof/loom/components/base/Icon.vue'
import Tooltip from '@southneuhof/loom/components/base/Tooltip.vue'
import Button from '@southneuhof/loom/components/base/Button.vue'
import Popover from '@southneuhof/loom/components/base/Popover.vue'
import { Dialog, DialogContent } from '@southneuhof/loom/components/base/Dialog/index'
import BaseInput from './BaseInput.vue'
import { useOptionalFileManager } from '../../file-manager/provider'
import type { ManagedAsset } from '../../file-manager/contracts'
import type { FileInputMode, FileInputModelValue, FileInputProps } from './fileInput.types'
import type { FileInputRow } from './useFileInputController'
import { useFileAcquisition } from './useFileAcquisition'
import { useFileInputController } from './useFileInputController'

defineOptions({ inheritAttrs: false })

const props = defineProps<FileInputProps<TMode, TMulti>>()
const modelValue = defineModel<FileInputModelValue<TMode, TMulti>>()
const emit = defineEmits<{
  (event: 'validation:touch'): void
  (event: 'validation:error', message: string | undefined): void
}>()
const attrs = useAttrs()
const fileManager = useOptionalFileManager()
const AssetPicker = defineAsyncComponent(() => import('../../file-manager/AssetPicker.vue'))
const sourcePopoverOpen = ref(false)
const fileManagerOpen = ref(false)
const fileInputMode = computed<FileInputMode>(() => props.mode ?? 'asset')
const multi = computed(() => props.multi ?? false)
const acceptTypes = computed(() => props.accept ?? [])
const maxFileSize = computed(() => props.maxSize ?? 10)
const acceptTypesPretty = computed(() => acceptTypes.value.map((type) => MIME_TYPE_NAMES[type] ?? type))
const wrapperAttrs = computed(() => Object.fromEntries(Object.entries(attrs).filter(([key]) => key === 'class' || key === 'style')))
const controlAttrs = computed(() => Object.fromEntries(Object.entries(attrs).filter(([key]) => key === 'id' || key.startsWith('aria-'))))

const controller = useFileInputController({
  mode: () => fileInputMode.value,
  multi: () => multi.value,
  accept: () => acceptTypes.value,
  maxSize: () => maxFileSize.value,
  limit: () => props.limit,
  disabled: () => props.disabled ?? false,
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
const rows = controller.rows
const inputError = controller.inputError
const invalidModel = controller.invalidModel

const isAssetMode = computed(() => fileInputMode.value === 'asset')
const canAddFile = computed(() => {
  if (controller.invalidModel.value) return false
  if (!multi.value) return !controller.pending.value && (props.limit === undefined || props.limit > 0)
  return props.limit === undefined || controller.values.value.length + controller.pendingCount.value < props.limit
})

function progressPercentage(progress?: { loaded: number; total?: number }): number | undefined {
  if (!progress?.total || progress.total <= 0) return undefined
  return Math.min(100, Math.max(0, Math.round((progress.loaded / progress.total) * 100)))
}

function rowName(row: Extract<FileInputRow, { kind: 'pending' }>): string {
  return row.file?.name ?? (row.stage === 'reading' ? 'Preparing file' : 'Selected file')
}

function stageLabel(stage: 'reading' | 'preparing' | 'transforming' | 'uploading'): string {
  if (stage === 'uploading') return 'Mengunggah'
  if (stage === 'reading') return 'Preparing'
  if (stage === 'transforming' || stage === 'preparing') return 'Processing'
  return 'Processing'
}

function openDevicePicker(): void {
  if (props.disabled || controller.invalidModel.value || !canAddFile.value) return
  sourcePopoverOpen.value = false
  acquisition.openPicker()
}

function openFileManager(): void {
  if (props.disabled || controller.invalidModel.value || !fileManager || !isAssetMode.value || !canAddFile.value) return
  sourcePopoverOpen.value = false
  fileManagerOpen.value = true
}

async function selectFileManagerAsset(payload: ManagedAsset): Promise<void> {
  if (props.disabled || controller.invalidModel.value || payload.kind === 'folder' || !fileManager || !isAssetMode.value) return
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
    <input
      v-bind="{ ...controlAttrs, ...controlBindings, required: false }"
      ref="fileInput"
      type="file"
      hidden
      :disabled="props.disabled || invalidModel || !canAddFile"
      :multiple="multi"
      :accept="acceptTypes.join(',') || undefined"
      class="rounded-md p-2"
      @change="handleInputChange"
    />
    <div class="flex flex-col gap-4">
      <div v-if="rows.length > 0" class="flex flex-row flex-wrap items-center gap-4">
        <template v-for="row in rows" :key="row.id">
          <FileComponent
            v-if="row.kind === 'value' && row.value.kind === 'asset'"
            :asset="row.value.asset"
            :action="props.disabled ? undefined : { label: 'Hapus', action: () => controller.remove(row.id) }"
          />
          <FileComponent
            v-else-if="row.kind === 'value' && row.value.kind === 'file'"
            :filename="row.value.file.name"
            :action="props.disabled ? undefined : { label: 'Hapus', action: () => controller.remove(row.id) }"
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
                <div class="text-sm">{{ rowName(row) }}</div>
                <p role="status" aria-live="polite" class="text-sm text-on-surface-variant">
                  {{ stageLabel(row.stage) }}<span v-if="progressPercentage(row.progress) != null"> {{ progressPercentage(row.progress) }}%</span>
                </p>
              </div>
              <Button type="button" kind="icon" color="error" ariaLabel="Remove pending upload" :disabled="props.disabled" @click="controller.remove(row.id)">
                <template #icon><Icon name="delete-bin" /></template>
              </Button>
            </div>
          </div>
          <div v-else class="flex items-center gap-3 rounded-md bg-error-container p-3 text-on-error-container">
            <Button type="button" variant="text" :disabled="props.disabled" @click="controller.clearInvalid">Remove invalid value</Button>
          </div>
        </template>
      </div>
      <Button v-if="inputError || invalidModel" type="button" variant="text" :disabled="props.disabled" @click="controller.clear">
        Clear file selection
      </Button>
      <div v-if="canAddFile" class="flex flex-col gap-2">
        <div
          ref="dropZone"
          class="overlay flex w-full flex-col items-center justify-center gap-4 rounded-md py-8 outline-dashed outline-2 outline-outline-variant after:bg-on-surface-hover focus-visible:after:bg-on-surface-active active:after:bg-on-surface-active"
          :class="{ 'after:bg-primary-drag after:opacity-100 outline-primary/[33%]': isOverDropZone }"
        >
          <div v-if="!isOverDropZone" class="flex flex-row items-center gap-4">
            <div class="text-black-light font-bold">Letakkan file anda di sini</div>
            <div class="text-black-light">/</div>
            <Popover v-model="sourcePopoverOpen" contentClass="p-0">
              <template #trigger>
                <Button type="button" :disabled="props.disabled || !canAddFile">
                  <template #icon><Icon name="add-circle" /></template>
                  <div>Pilih sumber file</div>
                </Button>
              </template>
              <template #content>
                <div class="flex flex-col">
                  <button type="button" :disabled="props.disabled || !canAddFile" class="overlay flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm after:bg-on-surface-hover focus-visible:after:bg-on-surface-active active:after:bg-on-surface-active" @click="openDevicePicker">
                    <Icon name="upload-cloud" size="sm" />
                    <span>Upload from device</span>
                  </button>
                  <button v-if="fileManager && isAssetMode" type="button" :disabled="props.disabled || !canAddFile" class="overlay flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm after:bg-on-surface-hover focus-visible:after:bg-on-surface-active active:after:bg-on-surface-active" @click="openFileManager">
                    <Icon name="folder-2" size="sm" />
                    <span>Choose from file manager</span>
                  </button>
                </div>
              </template>
            </Popover>
          </div>
          <div v-else class="flex flex-col items-center justify-center gap-4">
            <div><Icon name="upload-cloud" /></div>
            <div class="text-black-light font-bold">Lepaskan kursor untuk mengunggah</div>
          </div>
        </div>
        <div v-if="acceptTypes.length > 0 || maxFileSize" class="flex flex-row gap-4">
          <Tooltip>
            <template #trigger>
              <div class="flex flex-row items-center gap-1 text-muted">
                <Icon name="information" size="xs" :fill="true" />
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
  </BaseInput>
  <Dialog v-if="fileManager && isAssetMode" v-model:open="fileManagerOpen">
    <DialogContent class="flex h-[60vh] max-w-[60vw] flex-col">
      <AssetPicker @select="selectFileManagerAsset" @cancel="fileManagerOpen = false" />
    </DialogContent>
  </Dialog>
</template>
