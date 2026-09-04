<script setup lang="ts">
import { ref } from 'vue'
import { twMerge } from 'tailwind-merge'
import type { PropType } from 'vue'
import Button from './Button.vue'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './Dialog'
import Icon from './Icon.vue'

const props = defineProps({
  images: {
    type: Array as PropType<Array<{ url: string; thumbnail?: string }>>,
    required: true,
  },
  isOpen: {
    type: Boolean,
    required: false,
    default: false,
  },
  disableControls: {
    type: Boolean,
    required: false,
    default: false,
  },
})

const isOpen = ref(props.isOpen)
const currentIndex = ref(0)

function openDialog(index: number) {
  if (props.images[index].url) {
    currentIndex.value = index
    isOpen.value = true
  }
}

function closeDialog() {
  isOpen.value = false
}

function nextImage() {
  currentIndex.value = (currentIndex.value + 1) % props.images?.length
}

function prevImage() {
  currentIndex.value = (currentIndex.value - 1 + props.images?.length) % props.images?.length
}

setInterval(() => {
  if (isOpen.value) return
  currentIndex.value = (currentIndex.value + 1) % props.images?.length
}, 8000)
</script>

<template>
  <div v-if="!($slots as any).trigger" :class="twMerge('relative flex aspect-square w-28 items-center justify-center rounded-xl bg-surface-container-high', $attrs.class as string)">
    <div
      v-if="!props.disableControls && (props.images?.[currentIndex]?.thumbnail || props.images?.[currentIndex]?.url)"
      class="absolute flex h-full w-full flex-row items-center justify-center gap-2 rounded-xl bg-black/[12%] text-on-surface opacity-0 transition-opacity duration-100 hover:opacity-100"
    >
      <Button @click="() => openDialog(currentIndex)" color="info" ariaLabel="Preview image"><Icon name="eye"></Icon></Button>
      <slot name="actions" />
    </div>
    <div
      v-else
      @click="() => openDialog(currentIndex)"
      class="absolute flex h-full w-full cursor-pointer flex-row items-center justify-center gap-2 rounded-xl bg-black/[12%] text-on-surface opacity-0 transition-opacity duration-100 hover:opacity-100"
    ></div>
    <img
      v-if="props.images?.[currentIndex]?.thumbnail || props.images?.[currentIndex]?.url"
      :src="props.images?.[currentIndex].thumbnail || props.images?.[currentIndex].url"
      class="h-full w-full rounded-xl bg-surface-container-high object-cover"
    />
    <div v-else class="flex h-full w-full items-center justify-center rounded-xl bg-surface-container-high">
      <slot v-if="$slots['no-image']" name="no-image" />
      <Icon v-else name="eye-off" />
    </div>
  </div>

  <Dialog v-model:open="isOpen">
    <DialogContent class="flex max-h-[95vh] max-w-screen-lg items-center justify-center bg-transparent p-4 shadow-none">
      <DialogTitle class="sr-only">Image preview</DialogTitle>
      <DialogDescription class="sr-only">Preview selected image.</DialogDescription>
      <div class="relative">
        <button data-testid="image-preview-close" aria-label="Close image preview" class="absolute right-4 top-4 z-10 text-on-surface" @click="closeDialog()">
          <Icon name="close"></Icon>
        </button>
        <img class="h-full w-full rounded-xl object-scale-down" :src="props.images?.[currentIndex].url" />
        <div class="absolute bottom-4 left-4 right-4 flex items-center justify-between">
          <Button :disabled="currentIndex === 0" ariaLabel="Previous image" @click="prevImage"><Icon name="arrow-left-s"></Icon></Button>
          <span class="text-white">{{ currentIndex + 1 }} / {{ props.images.length }}</span>
          <Button :disabled="currentIndex === props.images.length - 1" ariaLabel="Next image" @click="nextImage"><Icon name="arrow-right-s"></Icon></Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
