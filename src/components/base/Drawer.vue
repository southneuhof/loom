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

function closeDialog() {
  isOpen.value = false
  props.onClose()
}
function openDialog() {
  props.onOpen()
  isOpen.value = true
}

function setOpen(value: boolean) {
  isOpen.value = value
}

watch(isOpen, (val) => {
  emit('update:isOpen', val)
})
</script>

<template>
  <DrawerRoot :direction="'right'">
    <DrawerTrigger>
      <slot name="trigger" v-bind="openDialog"></slot>
    </DrawerTrigger>
    <DrawerPortal>
      <DrawerOverlay class="fixed inset-0 bg-black/40" />
      <DrawerContent direction class="fixed right-0 top-0 z-50 flex h-full w-full max-w-[480px] flex-col rounded-l-[10px] bg-surface-container p-8 outline-none">
        <slot name="content" v-bind="{ setOpen }"></slot>
      </DrawerContent>
    </DrawerPortal>
  </DrawerRoot>
</template>

<style scoped>
.drawer-transition {
  transition: all 0.5s cubic-bezier(0.32, 0.72, 0, 1);
}
</style>
