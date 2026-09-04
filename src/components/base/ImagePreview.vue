<script setup lang="ts">
import { computed, ref, useSlots, watch } from 'vue'
import { twMerge } from 'tailwind-merge'
import Button from './Button.vue'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './Dialog'
import Icon from './Icon.vue'

const props = defineProps({
  imageURL: {
    type: String,
  },
  thumbnailURL: {
    type: String,
    required: false,
  },
  isOpen: {
    type: Boolean,
    required: false,
    default: false,
  },
  square: {
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

const slots = useSlots()

const isOpen = ref(props.isOpen)
const thumbnailError = ref(false)
const detailError = ref(false)

const imageCandidates = computed(() => {
  const list = [props.thumbnailURL, props.imageURL].filter((item): item is string => Boolean(item))
  return [...new Set(list)]
})

const thumbnailSrc = computed(() => {
  if (thumbnailError.value) {
    return imageCandidates.value[1] ?? null
  }
  return imageCandidates.value[0] ?? null
})

const detailSrc = computed(() => {
  if (detailError.value) {
    return imageCandidates.value[1] ?? null
  }
  return imageCandidates.value[0] ?? null
})

watch(
  () => [props.thumbnailURL, props.imageURL],
  () => {
    thumbnailError.value = false
    detailError.value = false
  },
)

function onThumbnailError() {
  if (!thumbnailError.value && imageCandidates.value.length > 1) {
    thumbnailError.value = true
    return
  }
  thumbnailError.value = true
}

function onDetailError() {
  if (!detailError.value && imageCandidates.value.length > 1) {
    detailError.value = true
    return
  }
  detailError.value = true
}

function openDialog() {
  if (slots['image-thumbnail']) {
    isOpen.value = true
    return
  }
  if (thumbnailSrc.value || detailSrc.value) isOpen.value = true
}

function closeDialog() {
  isOpen.value = false
}
</script>

<template>
  <div v-if="!$slots.trigger" :class="twMerge('relative flex aspect-square w-28 items-center justify-center rounded-xl bg-surface-container-high', $attrs.class as string)">
    <div
      v-if="!props.disableControls && (props.thumbnailURL || props.imageURL)"
      class="absolute flex h-full w-full flex-row items-center justify-center gap-2 rounded-xl bg-black/[12%] text-on-surface opacity-0 transition-opacity duration-100 hover:opacity-100"
    >
      <Button @click="() => openDialog()" color="info" kind="icon" type="button" ariaLabel="Preview image">
        <template #icon>
          <Icon size="lg" name="eye"></Icon>
        </template>
      </Button>
      <slot name="actions" />
    </div>
    <div
      v-else
      @click="() => openDialog()"
      class="absolute flex h-full w-full cursor-pointer flex-row items-center justify-center gap-2 rounded-xl bg-black/[12%] text-on-surface opacity-0 transition-opacity duration-100 hover:opacity-100"
    ></div>
    <div v-if="$slots['image-description']" class="absolute bottom-4 rounded-xl bg-scrim/[18%] px-4 py-2 text-sm text-white">
      <slot name="image-description" />
    </div>
    <slot v-if="$slots['image-thumbnail']" name="image-thumbnail" />
    <template v-else>
      <img v-if="thumbnailSrc" class="h-full w-full rounded-xl bg-surface-container-high object-cover" :src="thumbnailSrc" @error="onThumbnailError" />
      <div v-else class="flex h-full w-full items-center justify-center rounded-xl bg-surface-container-high">
        <div v-if="$slots['no-image']" class="text-sm text-muted">
          <slot name="no-image" />
        </div>
        <Icon v-else size="lg" name="user"></Icon>
      </div>
    </template>
  </div>
  <div v-else @click="() => openDialog()">
    <slot name="trigger" />
  </div>
  <Dialog v-model:open="isOpen">
    <DialogContent class="flex max-h-[95vh] max-w-screen-lg items-center justify-center bg-transparent p-4 shadow-none">
      <DialogTitle class="sr-only">Image preview</DialogTitle>
      <DialogDescription class="sr-only">Preview selected image.</DialogDescription>
      <div class="relative">
        <button data-testid="image-preview-close" aria-label="Close image preview" class="absolute right-4 top-4 z-10 text-on-surface" @click="closeDialog()"><Icon name="close"></Icon></button>
        <slot v-if="$slots['image-detail']" name="image-detail" />
        <img v-else-if="detailSrc" class="h-full rounded-xl bg-surface-container-high object-scale-down" :src="detailSrc" @error="onDetailError" />
        <div v-else class="flex h-[240px] w-[240px] items-center justify-center rounded-xl bg-surface-container-high text-muted">
          <Icon size="lg" name="user"></Icon>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
