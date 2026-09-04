<script setup lang="ts">
import { ref, onMounted, type PropType } from 'vue'
import BaseInput from './BaseInput.vue'
import { commonProps } from './commonprops'
import Button from '@southneuhof/loom/components/base/Button.vue'
import Card from '@southneuhof/loom/components/base/Card.vue'
import Icon from '@southneuhof/loom/components/base/Icon.vue'
import Tooltip from '@southneuhof/loom/components/base/Tooltip.vue'
// import { defaultDrawingCanvasOnSave } from "./configs/DrawingCanvas";

const props = defineProps({
  onSave: {
    type: Function as PropType<(image: string) => Promise<any>>,
  },
  height: {
    type: Number,
    default: 500,
  },
  width: {
    type: Number,
    default: 500,
  },
  ...commonProps,
})
const modelValue = defineModel()

const canvas = ref<any>(null)
const context = ref<any>(null)
const currentDrawingMode = ref('draw')
const isDrawing = ref(false)
const isSaved = ref()

onMounted(() => {
  context.value = canvas.value.getContext('2d')
  if (context.value) {
    context.value.lineCap = 'round'
    context.value.strokeStyle = 'black'
    context.value.lineWidth = 2
  }
})

const startDrawing = (event: any) => {
  isSaved.value = false
  const { offsetX, offsetY } = event
  if (!context.value) return
  context.value.beginPath()
  context.value.moveTo(offsetX, offsetY)
  context.value.lineTo(offsetX, offsetY)
  context.value.stroke()
  isDrawing.value = true
}

const draw = (event: any) => {
  if (!isDrawing.value || !context.value) return
  const { offsetX, offsetY } = event
  context.value.lineTo(offsetX, offsetY)
  context.value.stroke()
}

const stopDrawing = () => {
  if (context.value) {
    context.value.closePath()
    isDrawing.value = false
  }
}

const setToDraw = () => {
  if (context.value) {
    context.value.globalCompositeOperation = 'source-over'
    currentDrawingMode.value = 'draw'
  }
}

const setToErase = () => {
  if (context.value) {
    context.value.globalCompositeOperation = 'destination-out'
    currentDrawingMode.value = 'erase'
  }
}

const saveImage = async () => {
  if (canvas.value) {
    const image = canvas.value.toDataURL('image/png')
    if (!props.onSave) return
    modelValue.value = await props.onSave(image)
    isSaved.value = true
  }
}

const clearCanvas = () => {
  if (context.value && canvas.value) {
    context.value.clearRect(0, 0, canvas.value.width, canvas.value.height)
  }
}
</script>

<template>
  <BaseInput v-bind="props">
    <Card v-if="isSaved == null" class="flex flex-row items-center gap-4" color="surfaceContainerHigh">
      <Icon name="information" />
      <div class="flex flex-col">
        <p class="font-semibold">Gambar tanda tangan</p>
        <p>Tekan kursor pada kanvas untuk mulai menggambar</p>
      </div>
    </Card>
    <Card v-else-if="!isSaved" class="flex flex-row items-center gap-4" color="errorContainer">
      <Icon name="information" />
      <div class="flex flex-col">
        <p class="font-semibold">Gambar belum tersimpan</p>
        <p>Tekan tombol simpan untuk menyimpan gambar.</p>
      </div>
    </Card>
    <Card v-else class="flex flex-row items-center gap-4" color="secondaryContainer">
      <Icon name="check" />
      <div class="flex flex-col">
        <p class="font-semibold">Gambar sudah tersimpan</p>
        <p>Gambar sudah diunggah dan tersimpan</p>
      </div>
    </Card>
    <div class="flex max-w-fit flex-col gap-4 p-0.5">
      <canvas
        class="canvas-container outline outline-1 outline-outline"
        ref="canvas"
        :width="width"
        :height="height"
        @mousedown="startDrawing"
        @mousemove="draw"
        @mouseup="stopDrawing"
        @mouseleave="stopDrawing"
        style="background-color: white"
      ></canvas>
      <div class="flex flex-row items-center justify-between">
        <div class="flex flex-row items-center gap-2">
          <Tooltip>
            <template #trigger>
              <Button :variant="currentDrawingMode === 'draw' ? 'filled' : 'outlined'" color="primary" @click="setToDraw">
                <Icon name="edit" />
              </Button>
            </template>
            <template #content>Draw</template>
          </Tooltip>
          <Tooltip>
            <template #trigger>
              <Button :variant="currentDrawingMode === 'erase' ? 'filled' : 'outlined'" color="warning" @click="setToErase">
                <Icon name="eraser" />
              </Button>
            </template>
            <template #content>Erase</template>
          </Tooltip>
          <Tooltip>
            <template #trigger>
              <Button color="error" @click="clearCanvas">
                <Icon name="close-circle" />
              </Button>
            </template>
            <template #content>Clear</template>
          </Tooltip>
        </div>
        <Tooltip>
          <template #trigger>
            <Button color="info" :disabled="!props.onSave" @click="saveImage">
              <Icon name="save" />
            </Button>
          </template>
          <template #content>Save</template>
        </Tooltip>
      </div>
    </div>
  </BaseInput>
</template>
