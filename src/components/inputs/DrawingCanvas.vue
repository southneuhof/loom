<script setup lang="ts" generic="TMode extends FileInputMode = 'asset'">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { DrawingCanvasProps, FileInputMode, FileInputModelValue } from './fileInput.types'
import { useFileInputController } from './useFileInputController'
import BaseInput from './BaseInput.vue'
import Button from '@southneuhof/loom/components/base/Button.vue'
import Card from '@southneuhof/loom/components/base/Card.vue'
import Icon from '@southneuhof/loom/components/base/Icon.vue'
import Tooltip from '@southneuhof/loom/components/base/Tooltip.vue'
import Spinner from '@southneuhof/loom/components/base/Spinner.vue'

const props = defineProps<DrawingCanvasProps<TMode>>()
const modelValue = defineModel<FileInputModelValue<TMode, false>>()
const emit = defineEmits<{
  (event: 'validation:touch'): void
  (event: 'validation:error', message: string | undefined): void
}>()
const mode = computed<FileInputMode>(() => props.mode ?? 'asset')
const controller = useFileInputController({
  mode: () => mode.value,
  multi: () => false,
  accept: () => ['image/png'],
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
const canvas = ref<HTMLCanvasElement>()
const context = ref<CanvasRenderingContext2D>()
const currentDrawingMode = ref<'draw' | 'erase'>('draw')
const isDrawing = ref(false)
const hasUnsavedChanges = ref(false)
const hasSavedValue = computed(() => controller.values.value.length > 0)
const canvasReady = ref(false)
const pending = controller.pending
const pendingRows = computed(() => controller.rows.value.filter((row) => row.kind === 'pending'))
const invalidModel = controller.invalidModel
const inputError = controller.inputError
const width = computed(() => props.width ?? 500)
const height = computed(() => props.height ?? 500)
let restoreGeneration = 0
let restoreController: AbortController | undefined
let restoreObjectUrl: string | undefined

function clearPixels(): void {
  const target = canvas.value
  const drawingContext = context.value
  if (!target || !drawingContext) return
  drawingContext.clearRect(0, 0, target.width, target.height)
}

function setError(message: string): void {
  controller.reportError(message)
}

function cancelRestore(): number {
  restoreGeneration += 1
  restoreController?.abort()
  restoreController = undefined
  if (restoreObjectUrl) {
    URL.revokeObjectURL(restoreObjectUrl)
    restoreObjectUrl = undefined
  }
  return restoreGeneration
}

function loadImage(source: string, signal: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    const cleanup = () => signal.removeEventListener('abort', abort)
    const abort = () => {
      image.onload = null
      image.onerror = null
      image.src = ''
      cleanup()
      reject(new Error('The selected image load was cancelled.'))
    }
    image.onload = () => {
      cleanup()
      resolve(image)
    }
    image.onerror = () => {
      cleanup()
      reject(new Error('The selected image could not be loaded into the canvas.'))
    }
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) {
      abort()
      return
    }
    image.src = source
  })
}

async function restoreValue(): Promise<void> {
  const generation = cancelRestore()
  const value = controller.values.value[0]
  if (!value || controller.invalidModel.value) {
    clearPixels()
    return
  }
  const imageController = new AbortController()
  restoreController = imageController
  let source: string | undefined
  try {
    if (value.kind === 'file') {
      restoreObjectUrl = URL.createObjectURL(value.file)
      source = restoreObjectUrl
    } else {
      source = controller.assetPreview(value.asset)?.imageURL
    }
    if (!source) throw new Error('The asset service did not return an image preview.')
    const image = await loadImage(source, imageController.signal)
    if (generation !== restoreGeneration || imageController.signal.aborted) return
    const target = canvas.value
    const drawingContext = context.value
    if (!target || !drawingContext) return
    const checkCanvas = document.createElement('canvas')
    checkCanvas.width = target.width
    checkCanvas.height = target.height
    const checkContext = checkCanvas.getContext('2d')
    if (!checkContext) throw new Error('The image cannot be exported from this canvas.')
    checkContext.drawImage(image, 0, 0, checkCanvas.width, checkCanvas.height)
    checkContext.getImageData(0, 0, 1, 1)
    clearPixels()
    drawingContext.drawImage(image, 0, 0, target.width, target.height)
    hasUnsavedChanges.value = false
  } catch (reason) {
    if (generation === restoreGeneration) setError(reason instanceof Error ? reason.message : String(reason))
  } finally {
    if (restoreController === imageController) {
      restoreController = undefined
      if (restoreObjectUrl) {
        URL.revokeObjectURL(restoreObjectUrl)
        restoreObjectUrl = undefined
      }
    }
  }
}

function startDrawing(event: PointerEvent): void {
  if (props.disabled || pending.value || !context.value) return
  cancelRestore()
  hasUnsavedChanges.value = true
  const target = canvas.value
  if (!target) return
  target.setPointerCapture(event.pointerId)
  context.value.beginPath()
  context.value.moveTo(event.offsetX, event.offsetY)
  context.value.lineTo(event.offsetX, event.offsetY)
  context.value.stroke()
  isDrawing.value = true
}

function draw(event: PointerEvent): void {
  if (props.disabled || pending.value || !isDrawing.value || !context.value) return
  context.value.lineTo(event.offsetX, event.offsetY)
  context.value.stroke()
}

function stopDrawing(): void {
  if (!context.value) return
  context.value.closePath()
  isDrawing.value = false
}

function setToDraw(): void {
  if (props.disabled || !context.value) return
  context.value.globalCompositeOperation = 'source-over'
  currentDrawingMode.value = 'draw'
}

function setToErase(): void {
  if (props.disabled || !context.value) return
  context.value.globalCompositeOperation = 'destination-out'
  currentDrawingMode.value = 'erase'
}

function createDrawingFile(target: HTMLCanvasElement): Promise<File> {
  return new Promise((resolve, reject) => {
    target.toBlob((blob) => {
      if (!blob) {
        reject(new Error('The drawing could not be exported.'))
        return
      }
      resolve(new File([blob], 'drawing.png', { type: 'image/png' }))
    }, 'image/png')
  })
}

async function saveImage(): Promise<void> {
  if (props.disabled || controller.invalidModel.value || controller.pending.value) return
  const target = canvas.value
  if (!target) {
    setError('The drawing could not be exported.')
    return
  }
  const accepted = await controller.acquireFile(() => createDrawingFile(target))
  if (accepted) hasUnsavedChanges.value = false
}

function clearCanvas(): void {
  if (props.disabled) return
  cancelRestore()
  clearPixels()
  hasUnsavedChanges.value = false
  controller.clear()
}

function initializeCanvas(): void {
  const target = canvas.value
  const drawingContext = target?.getContext('2d')
  if (!target || !drawingContext) return
  context.value = drawingContext
  drawingContext.lineCap = 'round'
  drawingContext.strokeStyle = 'black'
  drawingContext.lineWidth = 2
  canvasReady.value = true
  void restoreValue()
}

watch(controller.values, () => {
  if (canvasReady.value) void restoreValue()
}, { flush: 'post' })

onMounted(initializeCanvas)
onBeforeUnmount(() => {
  cancelRestore()
  isDrawing.value = false
})
</script>

<template>
  <BaseInput v-bind="props" :error="props.error || inputError || ''" v-slot="{ controlBindings }">
    <Card v-if="!hasSavedValue && !hasUnsavedChanges" class="flex flex-row items-center gap-4" color="surfaceContainerHigh">
      <Icon name="information" />
      <div class="flex flex-col">
        <p class="font-semibold">Draw a signature</p>
        <p>Use the pointer on the canvas to draw.</p>
      </div>
    </Card>
    <Card v-else-if="hasUnsavedChanges" class="flex flex-row items-center gap-4" color="errorContainer">
      <Icon name="information" />
      <div class="flex flex-col">
        <p class="font-semibold">Drawing not saved</p>
        <p>Save the drawing to add it to the form.</p>
      </div>
    </Card>
    <Card v-else class="flex flex-row items-center gap-4" color="secondaryContainer">
      <Icon name="check" />
      <div class="flex flex-col">
        <p class="font-semibold">Drawing saved</p>
        <p>The form contains the drawing file.</p>
      </div>
    </Card>
    <div class="flex max-w-fit flex-col gap-4 p-0.5">
      <canvas
        v-bind="controlBindings"
        class="canvas-container outline outline-1 outline-outline"
        ref="canvas"
        :width="width"
        :height="height"
        :style="{ backgroundColor: 'white', touchAction: 'none' }"
        @pointerdown="startDrawing"
        @pointermove="draw"
        @pointerup="stopDrawing"
        @pointercancel="stopDrawing"
        @pointerleave="stopDrawing"
      />
      <div class="flex flex-row items-center justify-between">
        <div class="flex flex-row items-center gap-2">
          <Tooltip>
            <template #trigger>
              <Button type="button" kind="icon" ariaLabel="Draw mode" :disabled="props.disabled || pending" :variant="currentDrawingMode === 'draw' ? 'filled' : 'outlined'" color="primary" @click="setToDraw"><Icon name="edit" /></Button>
            </template>
            <template #content>Draw</template>
          </Tooltip>
          <Tooltip>
            <template #trigger>
              <Button type="button" kind="icon" ariaLabel="Erase mode" :disabled="props.disabled || pending" :variant="currentDrawingMode === 'erase' ? 'filled' : 'outlined'" color="warning" @click="setToErase"><Icon name="eraser" /></Button>
            </template>
            <template #content>Erase</template>
          </Tooltip>
          <Tooltip>
            <template #trigger>
              <Button type="button" kind="icon" ariaLabel="Clear drawing" :disabled="props.disabled || pending" color="error" @click="clearCanvas"><Icon name="close-circle" /></Button>
            </template>
            <template #content>Clear</template>
          </Tooltip>
        </div>
        <div class="flex flex-row items-center gap-2">
          <div v-for="row in pendingRows" :key="row.id" class="flex items-center gap-2">
            <Spinner />
            <p role="status" aria-live="polite">Processing drawing</p>
            <Button type="button" kind="icon" ariaLabel="Cancel pending drawing" :disabled="props.disabled" color="error" @click="controller.remove(row.id)"><Icon name="close" /></Button>
          </div>
          <Button type="button" kind="icon" ariaLabel="Save drawing" :disabled="props.disabled || invalidModel || pending" color="info" @click="saveImage"><Icon name="save" /></Button>
        </div>
      </div>
    </div>
  </BaseInput>
</template>
