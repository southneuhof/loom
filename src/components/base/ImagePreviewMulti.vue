<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, type PropType } from 'vue'
import { twMerge } from 'tailwind-merge'
import type { AssetValue } from '../../assets/contracts'
import { useAssetAdapter } from '../../assets/provider'
import Button from './Button.vue'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './Dialog'
import Icon from './Icon.vue'

type ImageSource = { url: string; thumbnail?: string; alt?: string }
type ImageItem = ImageSource & { invalid?: boolean }

const props = defineProps({
  images: {
    type: Array as PropType<ImageSource[]>,
    required: false,
  },
  assets: {
    type: Array as PropType<AssetValue[]>,
    required: false,
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
const assetAdapter = useAssetAdapter({ optional: true })

const images = computed<ImageItem[]>(() => {
  if (props.assets === undefined) return props.images ?? []
  if (props.images !== undefined) throw new Error('[loom] ASSET_PREVIEW_SOURCE_CONFLICT')
  if (!assetAdapter) throw new Error('[loom] ASSET_ADAPTER_REQUIRED')
  return props.assets.map((value) => {
    const asset = assetAdapter.read(value)
    if (!asset) return { url: '', invalid: true }
    const preview = assetAdapter.preview(asset)
    return { url: preview.imageURL, thumbnail: preview.thumbnailURL, alt: asset.name }
  })
})

const invalidAssets = computed(() => images.value.some((image) => image.invalid))
const currentImage = computed(() => images.value[currentIndex.value])
let interval: ReturnType<typeof setInterval> | undefined

function openDialog(index: number) {
  if (images.value[index]?.url) {
    currentIndex.value = index
    isOpen.value = true
  }
}

function closeDialog() {
  isOpen.value = false
}

function nextImage() {
  if (images.value.length === 0 || currentIndex.value >= images.value.length - 1) return
  currentIndex.value += 1
}

function prevImage() {
  if (currentIndex.value === 0) return
  currentIndex.value -= 1
}

watch(() => images.value.length, (length) => {
  if (length === 0) currentIndex.value = 0
  else if (currentIndex.value >= length) currentIndex.value = length - 1
})

onMounted(() => {
  interval = setInterval(() => {
    if (isOpen.value || images.value.length === 0) return
    currentIndex.value = (currentIndex.value + 1) % images.value.length
  }, 8000)
})

onBeforeUnmount(() => {
  if (interval !== undefined) clearInterval(interval)
})
</script>

<template>
  <div v-if="!$slots.trigger" :class="twMerge('relative flex aspect-square w-28 items-center justify-center rounded-xl bg-surface-container-high', $attrs.class as string)">
    <div
      v-if="!props.disableControls && (currentImage?.thumbnail || currentImage?.url)"
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
      v-if="currentImage?.thumbnail || currentImage?.url"
      :src="currentImage.thumbnail || currentImage.url"
      :alt="currentImage.alt ?? ''"
      class="h-full w-full rounded-xl bg-surface-container-high object-cover"
    />
    <div v-else-if="invalidAssets" role="alert" class="flex h-full w-full items-center justify-center text-error">Invalid asset value.</div>
    <div v-else class="flex h-full w-full items-center justify-center rounded-xl bg-surface-container-high">
      <slot v-if="$slots['no-image']" name="no-image" />
      <Icon v-else name="eye-off" />
    </div>
  </div>

  <div v-if="invalidAssets" role="alert" class="text-sm text-error">Invalid asset value.</div>

  <Dialog v-model:open="isOpen">
    <DialogContent class="flex max-h-[95vh] max-w-screen-lg items-center justify-center bg-transparent p-4 shadow-none">
      <DialogTitle class="sr-only">Image preview</DialogTitle>
      <DialogDescription class="sr-only">Preview selected image.</DialogDescription>
      <div class="relative">
        <button v-bind="{ 'data-testid': 'image-preview-close' }" aria-label="Close image preview" class="absolute right-4 top-4 z-10 text-on-surface" @click="closeDialog()">
          <Icon name="close"></Icon>
        </button>
        <img v-if="currentImage?.url" class="h-full w-full rounded-xl object-scale-down" :src="currentImage.url" :alt="currentImage.alt ?? ''" />
        <div v-else class="flex h-[240px] w-[240px] items-center justify-center text-error">{{ currentImage?.invalid ? 'Invalid asset value.' : 'No image available.' }}</div>
        <div class="absolute bottom-4 left-4 right-4 flex items-center justify-between">
          <Button :disabled="currentIndex === 0" ariaLabel="Previous image" @click="prevImage"><Icon name="arrow-left-s"></Icon></Button>
          <span class="text-white">{{ images.length === 0 ? '0 / 0' : `${currentIndex + 1} / ${images.length}` }}</span>
          <Button :disabled="currentIndex >= images.length - 1" ariaLabel="Next image" @click="nextImage"><Icon name="arrow-right-s"></Icon></Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
