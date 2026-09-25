<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { toast } from 'vue-sonner'
import type { AssetValue } from '../../assets/contracts'
import { useAssetAdapter } from '../../assets/provider'
import { useUploadMutation } from './useUploadMutation'
import { useFormInputPending } from '../core/useFormInputState'
import Dialog from '../base/Dialog.vue'
import Button from '@southneuhof/loom/components/base/Button.vue'
import Icon from '@southneuhof/loom/components/base/Icon.vue'
import Spinner from '@southneuhof/loom/components/base/Spinner.vue'

const props = defineProps({
  disabled: { type: Boolean, default: false },
  uploadPath: { type: String, default: '' },
})
const assets = useAssetAdapter()
const modelValue = defineModel<AssetValue | null>()
const mutation = useUploadMutation(() => assets.upload)
const inputPending = useFormInputPending()

const isCameraOpen = ref(false)
const isPhotoTaken = ref(false)
const isShotPhoto = ref(false)
const cameraLoading = ref(false)
const camera = ref<HTMLVideoElement>()
const canvas = ref<HTMLCanvasElement>()
const canvasProperties = ref({
  width: 450,
  height: 338,
})
const invalidAsset = ref(false)
const image = computed(() => {
  if (modelValue.value === undefined || modelValue.value === null) return undefined
  const asset = assets.read(modelValue.value)
  return asset ? assets.preview(asset).imageURL : undefined
})
const emit = defineEmits<{
  (event: 'validation:error', message: string | undefined): void
  (event: 'validation:touch'): void
}>()
let disposed = false
let valueGeneration = 0
let cameraGeneration = 0
let disabledGeneration = 0
let modelInitialized = false
let pendingOperation: { release: () => void; released: () => boolean } | undefined
let activeCameraStream: MediaStream | undefined
let activeCameraElement: HTMLVideoElement | undefined

const createCameraElement = async () => {
  if (props.disabled || invalidAsset.value) return
  cameraGeneration += 1
  const generation = cameraGeneration
  cameraLoading.value = true
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
    const element = camera.value
    if (disposed || props.disabled || generation !== cameraGeneration || !isCameraOpen.value || !element) {
      stream.getTracks().forEach((track) => track.stop())
      return
    }
    activeCameraStream = stream
    activeCameraElement = element
    element.srcObject = stream
    canvasProperties.value = {
      width: stream.getVideoTracks()[0].getSettings().width || 450,
      height: stream.getVideoTracks()[0].getSettings().height || 338,
    }
    cameraLoading.value = false
  } catch (error) {
    if (disposed || generation !== cameraGeneration) return
    cameraLoading.value = false
    if (props.disabled || !isCameraOpen.value) return
    toast.error(error instanceof Error ? error.message : String(error))
  }
}

const stopCameraStream = () => {
  const stream = activeCameraStream
  const element = activeCameraElement
  activeCameraStream = undefined
  activeCameraElement = undefined
  stream?.getTracks().forEach((track) => track.stop())
  if (element && element.srcObject === stream) element.srcObject = null
}

const activateCamera = () => {
  if (props.disabled || invalidAsset.value || mutation.pending.value) return
  isCameraOpen.value = true
  void createCameraElement()
}

const deactivateCamera = () => {
  cameraGeneration += 1
  isCameraOpen.value = false
  cameraLoading.value = false
  isPhotoTaken.value = false
  isShotPhoto.value = false
  stopCameraStream()
}

watch(modelValue, (value) => {
  valueGeneration += 1
  if (modelInitialized) {
    deactivateCamera()
    pendingOperation?.release()
    pendingOperation = undefined
  }
  modelInitialized = true
  const invalid = value !== undefined && value !== null && assets.read(value) === null
  invalidAsset.value = invalid
  emit('validation:error', invalid ? 'Invalid asset value.' : undefined)
}, { immediate: true, flush: 'sync' })

const takePhoto = () => {
  if (props.disabled || invalidAsset.value || mutation.pending.value) return
  if (!isPhotoTaken.value) {
    isShotPhoto.value = true
    const FLASH_TIMEOUT = 50
    setTimeout(() => {
      isShotPhoto.value = false
    }, FLASH_TIMEOUT)
  }
  isPhotoTaken.value = !isPhotoTaken.value
  const context = canvas.value?.getContext('2d')
  const video = camera.value
  if (!context || !video) return
  context.drawImage(video, 0, 0, canvasProperties.value.width, canvasProperties.value.height)
}

const resetCameraState = () => {
  if (props.disabled) return
  cameraGeneration += 1
  stopCameraStream()
  isPhotoTaken.value = false
  isShotPhoto.value = false
  if (isCameraOpen.value) void createCameraElement()
}

const resetComponentState = () => {
  if (props.disabled) return
  deactivateCamera()
  valueGeneration += 1
  invalidAsset.value = false
  modelValue.value = null
  emit('validation:error', undefined)
  emit('validation:touch')
}

const handleFileUpload = async (file: File) => {
  if (props.disabled || invalidAsset.value || mutation.pending.value) return
  const disabledAtStart = disabledGeneration
  valueGeneration += 1
  const generation = valueGeneration
  const operation = inputPending.begin()
  pendingOperation = operation
  try {
    const result = await mutation.execute(file, props.uploadPath)
    if (disposed || operation.released() || generation !== valueGeneration) return
    const asset = assets.read(result)
    if (!asset || (asset.mimeType && !asset.mimeType.startsWith('image/'))) throw new Error('Upload returned an invalid image asset.')
    modelValue.value = asset
    valueGeneration += 1
    emit('validation:error', undefined)
    emit('validation:touch')
  } catch (error) {
    if (disposed || operation.released() || props.disabled || disabledAtStart !== disabledGeneration || generation !== valueGeneration) return
    toast.error(mutation.error.value?.message ?? (error instanceof Error ? error.message : String(error)))
  } finally {
    operation.release()
    if (pendingOperation === operation) pendingOperation = undefined
  }
}

const dataURItoFile = (dataURI: string) => {
  const [header, body] = dataURI.split(',')
  if (!header || !body) throw new Error('Invalid data URI')

  const byteString = atob(body)
  const mimeString = header.split(':')[1]?.split(';')[0] || 'image/png'
  const ab = new ArrayBuffer(byteString.length)
  const ia = new Uint8Array(ab)
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i)
  }
  return new File([ab], `camera-${Date.now()}.png`, { type: mimeString })
}

const commitPhoto = () => {
  if (props.disabled || invalidAsset.value || mutation.pending.value) return
  const canvasElement = canvas.value
  if (!canvasElement) return
  const imageData = canvasElement.toDataURL('image/png')
  if (imageData) handleFileUpload(dataURItoFile(imageData))
  else toast.error('Gagal menyimpan foto')
}

watch(() => props.disabled, (disabled) => {
  disabledGeneration += 1
  if (disabled) deactivateCamera()
}, { flush: 'sync' })
onBeforeUnmount(() => {
  disposed = true
  valueGeneration += 1
  cameraGeneration += 1
  pendingOperation?.release()
  stopCameraStream()
})
</script>

<template>
  <div class="flex flex-row gap-4">
    <img v-if="image" :src="image" class="h-36 w-36 rounded-xl bg-surface-container-highest object-scale-down" />
    <p v-if="invalidAsset" role="alert" class="text-error">Invalid asset value.</p>
    <div class="flex flex-col items-center justify-center gap-2">
      <Dialog @close="deactivateCamera">
        <template #title>Kamera</template>
        <template #trigger>
          <Button v-if="!image" :disabled="props.disabled || invalidAsset || mutation.pending.value" @click="activateCamera()">Buka Kamera <Icon name="camera" /></Button>
          <Button v-else :disabled="props.disabled || invalidAsset || mutation.pending.value" @click="activateCamera()">Ambil Ulang Foto <Icon class="h-5 w-5" name="refresh" /></Button>
        </template>
        <template #content="{ setOpen }">
          <div class="flex h-full w-full flex-col items-center gap-4">
            <div v-if="cameraLoading || mutation.pending.value" class="flex items-center justify-center" :style="{ width: canvasProperties.width, height: canvasProperties.height }">
              <Spinner />
            </div>
            <video v-show="!isPhotoTaken" ref="camera" class="max-w-full" :width="canvasProperties.width" :height="canvasProperties.height" autoplay></video>
            <canvas v-show="isPhotoTaken" ref="canvas" class="max-w-full" :width="canvasProperties.width" :height="canvasProperties.height"></canvas>
            <div class="flex w-full flex-row justify-center gap-2">
              <Button v-if="!isPhotoTaken" :disabled="props.disabled || mutation.pending.value" @click="takePhoto()" variant="tonal" class="aspect-square h-12 w-12"><Icon name="camera" /></Button>
              <Button v-else :disabled="props.disabled || mutation.pending.value" @click="resetCameraState()" variant="tonal" class="aspect-square h-12 w-12"><Icon class="h-5 w-5" name="refresh" /></Button>
              <Button v-if="isPhotoTaken" :disabled="props.disabled || mutation.pending.value" @click=";[commitPhoto(), setOpen(false)]" class="aspect-square h-12 w-12" variant="tonal" color="success"><Icon name="check" /></Button>
            </div>
          </div>
        </template>
      </Dialog>
      <Button v-if="image || invalidAsset" :disabled="props.disabled" @click="resetComponentState()" class="w-full" variant="tonal">Hapus Foto <Icon name="delete-bin" /></Button>
    </div>
  </div>
</template>
