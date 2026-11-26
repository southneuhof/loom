<script setup lang="ts">
import { ref, watch } from 'vue'
import { DrawerContent, DrawerOverlay, DrawerPortal, DrawerRoot, DrawerTrigger } from 'vaul-vue'

const emit = defineEmits(['update:isOpen'])
const props = defineProps({
  isOpen: {
    type: Boolean,
    required: false,
    default: false,
  },
  title: {
    type: String,
    required: false,
  },
  onClose: {
    type: Function,
    required: false,
    default: () => null,
  },
  onOpen: {
    type: Function,
    required: false,
    default: () => null,
  },
  disabled: {
    type: Boolean,
    required: false,
  },
})

const isOpen = ref(props.isOpen)

watch(
  () => props.isOpen,
  () => {
    isOpen.value = props.isOpen
  }
)

function openDialog() {
  props.onOpen()
  isOpen.value = true
}

function setOpen(value: boolean) {
  isOpen.value = value
}

watch(isOpen, (val, previous) => {
  emit('update:isOpen', val)
  if (!val && previous) props.onClose()
})
</script>

<template>
  <DrawerRoot v-model:open="isOpen" :direction="'right'">
    <DrawerTrigger v-if="$slots.trigger">
      <slot name="trigger" v-bind="openDialog"></slot>
    </DrawerTrigger>
    <DrawerPortal>
      <DrawerOverlay class="fixed inset-0 bg-black/40" />
      <DrawerContent class="fixed right-0 top-0 z-50 flex h-full w-full max-w-[480px] flex-col rounded-l-[10px] bg-surface-container p-8 outline-none">
        <slot name="content" v-bind="{ setOpen }"></slot>
      </DrawerContent>
    </DrawerPortal>
  </DrawerRoot>
</template>
