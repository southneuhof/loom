<script setup lang="ts">
import { computed, watch } from 'vue'
import {
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerOverlay,
  DrawerPortal,
  DrawerRoot,
  DrawerTitle,
  DrawerTrigger,
} from 'vaul-vue'
import Icon from './Icon.vue'

const props = withDefaults(
  defineProps<{
    title?: string
    description?: string
    side?: 'left' | 'right'
    closeOnOutsideClick?: boolean
    closeOnEscape?: boolean
    disabled?: boolean
  }>(),
  {
    side: 'right',
    closeOnOutsideClick: true,
    closeOnEscape: true,
    disabled: false,
  },
)

const open = defineModel<boolean>({ default: false })
const emit = defineEmits<{
  (event: 'open'): void
  (event: 'close'): void
}>()

const contentPositionClass = computed(() =>
  props.side === 'left'
    ? 'left-0 sm:rounded-r-2xl'
    : 'right-0 sm:rounded-l-2xl',
)

function setOpen(value: boolean) {
  open.value = value
}

watch(open, (current, previous) => {
  if (current === previous) return
  if (current) emit('open')
  else emit('close')
})
</script>

<template>
  <slot v-if="props.disabled" name="trigger" v-bind="{ setOpen, disabled: props.disabled }" />
  <DrawerRoot v-else v-model:open="open" :direction="props.side" :dismissible="props.closeOnOutsideClick">
    <DrawerTrigger v-if="$slots.trigger" as-child>
      <slot name="trigger" v-bind="{ setOpen, disabled: props.disabled }" />
    </DrawerTrigger>
    <DrawerPortal>
      <DrawerOverlay class="fixed inset-0 z-50 bg-black/40" />
      <DrawerContent
        :class="[
          'fixed inset-y-0 z-50 flex h-dvh w-full max-w-[32rem] flex-col bg-surface-container text-on-surface outline-none',
          contentPositionClass,
          $attrs.class,
        ]"
        :style="$attrs.style"
        @pointer-down-outside="(event) => { if (!props.closeOnOutsideClick) event.preventDefault() }"
        @escape-key-down="(event) => { if (!props.closeOnEscape) event.preventDefault() }"
      >
        <div
          v-if="$slots.title || props.title || $slots.description || props.description"
          class="flex shrink-0 items-start justify-between gap-4 border-b border-outline-variant px-6 py-5"
        >
          <div class="min-w-0">
            <DrawerTitle v-if="$slots.title || props.title" class="text-lg font-semibold leading-6 tracking-tight text-on-surface">
              <slot name="title" v-bind="{ setOpen }">{{ props.title }}</slot>
            </DrawerTitle>
            <DrawerDescription v-if="$slots.description || props.description" class="mt-1 text-sm text-on-surface-variant">
              <slot name="description" v-bind="{ setOpen }">{{ props.description }}</slot>
            </DrawerDescription>
          </div>
          <DrawerClose class="shrink-0 rounded-sm p-1 opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-primary">
            <Icon name="close" />
            <span class="sr-only">Close</span>
          </DrawerClose>
        </div>
        <DrawerClose
          v-else
          class="absolute right-4 top-4 rounded-sm p-1 opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <Icon name="close" />
          <span class="sr-only">Close</span>
        </DrawerClose>

        <div v-if="$slots.content" class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
          <slot name="content" v-bind="{ setOpen }" />
        </div>

        <div v-if="$slots.footer" class="shrink-0 border-t border-outline-variant px-6 py-4">
          <slot name="footer" v-bind="{ setOpen }" />
        </div>
      </DrawerContent>
    </DrawerPortal>
  </DrawerRoot>
</template>
