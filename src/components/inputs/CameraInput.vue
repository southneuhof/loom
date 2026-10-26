<script setup lang="ts" generic="TMode extends FileInputMode = 'asset'">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { CameraInputProps, FileInputMode, FileInputModelValue } from './fileInput.types'
import { useFileInputController } from './useFileInputController'
import { useFileObjectUrls } from './useFileObjectUrls'
import Dialog from '../base/Dialog.vue'
import Button from '@southneuhof/loom/components/base/Button.vue'
import Icon from '@southneuhof/loom/components/base/Icon.vue'
import Spinner from '@southneuhof/loom/components/base/Spinner.vue'
import BaseInput from './BaseInput.vue'

const props = defineProps<CameraInputProps<TMode>>()
const modelValue = defineModel<FileInputModelValue<TMode, false>>()
const emit = defineEmits<{
  (event: 'validation:touch'): void
  (event: 'validation:error', message: string | undefined): void
}>()
const mode = computed<FileInputMode>(() => props.mode ?? 'asset')
const controller = useFileInputController({
  mode: () => mode.value,
  multi: () => false,
  accept: () => ['image/*'],
  maxSize: () => props.maxSize ?? 10,
  limit: () => 1,
  disabled: () => props.disabled ?? false,
  imageOnly: true,
  destination: () => props.destination,
  transform: () => props.transform,
  upload: () => props.upload,
  modelValue: () => modelValue.value,
  setModelValue: (value) => { modelValue.value = value as FileInputModelValue<TMode, false> },
  error: () => props.error,
  validationError: (message) => emit('validation:error', message),
  validationTouch: () => emit('validation:touch'),
})

const isCameraOpen = ref(false)
const isPhotoTaken = ref(false)
const cameraLoading = ref(false)
const camera = ref<HTMLVideoElement>()
const canvas = ref<HTMLCanvasElement>()
const canvasSize = ref({ width: 450, height: 338 })
const localFiles = computed(() => controller.values.value.flatMap((value) => value.kind === 'file' ? [value.file] : []))
const objectUrl = useFileObjectUrls(() => localFiles.value)
const pending = controller.pending
const pendingRows = computed(() => controller.rows.value.filter((row) => row.kind === 'pending'))
const invalidModel = controller.invalidModel
const inputError = controller.inputError
const image = computed(() => {
  const value = controller.values.value[0]
  if (!value) return undefined
  if (value.kind === 'file') return objectUrl(value.file)
  return controller.assetPreview(value.asset)?.imageURL
})
let disposed = false
let cameraGeneration = 0
let activeStream: MediaStream | undefined
let activeVideo: HTMLVideoElement | undefined

function stopStream(): void {
  const stream = activeStream
  const video = activeVideo
  activeStream = undefined
  activeVideo = undefined
  stream?.getTracks().forEach((track) => track.stop())
  if (video && video.srcObject === stream) video.srcObject = null
}

function closeCamera(): void {
  cameraGeneration += 1
  isCameraOpen.value = false
  cameraLoading.value = false
  isPhotoTaken.value = false
  stopStream()
}

async function openCamera(): Promise<void> {
  if (props.disabled || controller.invalidModel.value || controller.pending.value) return
  isCameraOpen.value = true
  cameraGeneration += 1
  const generation = cameraGeneration
  cameraLoading.value = true
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
    const video = camera.value
    if (disposed || props.disabled || generation !== cameraGeneration || !isCameraOpen.value || !video) {
      stream.getTracks().forEach((track) => track.stop())
      return
    }
    activeStream = stream
    activeVideo = video
    video.srcObject = stream
    const settings = stream.getVideoTracks()[0]?.getSettings()
    canvasSize.value = { width: settings?.width || 450, height: settings?.height || 338 }
    cameraLoading.value = false
  } catch (reason) {
    if (disposed || generation !== cameraGeneration) return
    cameraLoading.value = false
    controller.reportError(reason)
  }
}

function takePhoto(): void {
  if (props.disabled || controller.invalidModel.value || controller.pending.value) return
  const target = canvas.value
  const source = camera.value
  const context = target?.getContext('2d')
  if (!target || !source || !context) {
    controller.reportError('The camera image could not be captured.')
    return
  }
  context.drawImage(source, 0, 0, canvasSize.value.width, canvasSize.value.height)
  isPhotoTaken.value = true
}

function retakePhoto(): void {
  if (props.disabled || controller.pending.value) return
  closeCamera()
  void openCamera()
}

function toCaptureFile(target: HTMLCanvasElement): Promise<File> {
  return new Promise((resolve, reject) => {
    target.toBlob((blob) => {
      if (!blob) {
        reject(new Error('The camera image could not be exported.'))
        return
      }
      resolve(new File([blob], 'capture.png', { type: 'image/png' }))
    }, 'image/png')
  })
}

async function commitPhoto(): Promise<void> {
  if (props.disabled || controller.invalidModel.value || controller.pending.value) return
  const target = canvas.value
  if (!target) {
    controller.reportError('The camera image could not be captured.')
    return
  }
  const completion = controller.acquireFile(() => toCaptureFile(target))
  closeCamera()
  await completion
}

function clearValue(): void {
  if (props.disabled) return
  closeCamera()
  controller.clear()
}

watch(modelValue, closeCamera, { flush: 'sync' })
watch(mode, closeCamera, { flush: 'sync' })
watch(() => props.disabled, (disabled) => {
  if (disabled) closeCamera()
}, { flush: 'sync' })

onBeforeUnmount(() => {
  disposed = true
  closeCamera()
})
</script>

<template>
  <BaseInput
    :field="props.field"
    :label="props.label"
    :helper-message="props.helperMessage"
    :error="props.error || inputError || ''"
    :disabled="props.disabled"
    :required="props.required"
    v-slot="{ controlBindings }"
  >
    <div class="flex flex-row gap-4">
      <img v-if="image" :src="image" class="h-36 w-36 rounded-xl bg-surface-container-highest object-scale-down" />
      <div class="flex flex-col items-center justify-center gap-2">
        <Dialog v-model="isCameraOpen" @close="closeCamera">
          <template #title>Camera</template>
          <template #trigger>
            <Button v-bind="controlBindings" type="button" :disabled="props.disabled || invalidModel || pending" @click="openCamera">
              {{ image ? 'Ambil Ulang Foto' : 'Buka Kamera' }} <Icon :name="image ? 'refresh' : 'camera'" />
            </Button>
          </template>
          <template #content="{ setOpen }">
            <div class="flex h-full w-full flex-col items-center gap-4">
              <div v-if="cameraLoading || pending" class="flex items-center justify-center" :style="{ width: `${canvasSize.width}px`, height: `${canvasSize.height}px` }">
                <Spinner />
              </div>
              <video v-show="!isPhotoTaken" ref="camera" class="max-w-full" :width="canvasSize.width" :height="canvasSize.height" autoplay />
              <canvas v-show="isPhotoTaken" ref="canvas" class="max-w-full" :width="canvasSize.width" :height="canvasSize.height" />
              <div class="flex w-full flex-row justify-center gap-2">
                <Button v-if="!isPhotoTaken" type="button" kind="icon" ariaLabel="Take photo" :disabled="props.disabled || pending" @click="takePhoto" variant="tonal" class="aspect-square h-12 w-12"><Icon name="camera" /></Button>
                <Button v-else type="button" kind="icon" ariaLabel="Retake photo" :disabled="props.disabled || pending" @click="retakePhoto" variant="tonal" class="aspect-square h-12 w-12"><Icon name="refresh" /></Button>
                <Button v-if="isPhotoTaken" type="button" kind="icon" ariaLabel="Save photo" :disabled="props.disabled || pending" @click=";[commitPhoto(), setOpen(false)]" class="aspect-square h-12 w-12" variant="tonal" color="success"><Icon name="check" /></Button>
              </div>
            </div>
          </template>
        </Dialog>
        <Button v-if="image || inputError || invalidModel" type="button" :disabled="props.disabled" @click="clearValue" class="w-full" variant="tonal">
          Hapus Foto <Icon name="delete-bin" />
        </Button>
      </div>
      <div v-if="pending" class="flex flex-col items-center justify-center gap-2">
        <Spinner />
        <p role="status">Processing photo</p>
        <Button v-for="row in pendingRows" :key="row.id" type="button" variant="text" :disabled="props.disabled" @click="controller.remove(row.id)">Cancel</Button>
      </div>
    </div>
  </BaseInput>
</template>
