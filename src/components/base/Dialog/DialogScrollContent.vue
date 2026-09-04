<script setup lang="ts">
import { type HTMLAttributes, computed, useAttrs } from 'vue'
import { DialogClose, DialogContent, type DialogContentEmits, type DialogContentProps, DialogOverlay, DialogPortal, useForwardPropsEmits } from 'reka-ui'
import { twMerge } from 'tailwind-merge'
import Icon from '../Icon.vue'

const props = defineProps<DialogContentProps & { class?: HTMLAttributes['class'] }>()
const emits = defineEmits<DialogContentEmits>()
const attrs = useAttrs()

defineOptions({ inheritAttrs: false })

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props

  return { ...delegated, ...attrs }
})

const forwarded = useForwardPropsEmits(delegatedProps, emits) as any
</script>

<template>
  <DialogPortal>
    <DialogOverlay
      class="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-scrim/[38%] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
    >
      <DialogContent
        :class="
          twMerge(
            'fixed left-1/2 top-1/2 z-50 grid max-h-[90vh] w-full max-w-[95vw] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-auto bg-surface-container p-6 text-on-surface shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-2xl',
            props.class as any
          )
        "
        v-bind="forwarded"
        @pointer-down-outside="(event) => {
          const originalEvent = event.detail.originalEvent;
          const target = originalEvent.target as HTMLElement;
          if (originalEvent.offsetX > target.clientWidth || originalEvent.offsetY > target.clientHeight) {
            event.preventDefault();
          }
        }"
      >
        <slot />

        <DialogClose class="overlay absolute right-3 top-3 rounded-md p-0.5 after:bg-on-surface-hover focus-visible:after:bg-on-surface-active active:after:bg-on-surface-active">
          <Icon name="close"></Icon>
          <span class="sr-only">Close</span>
        </DialogClose>
      </DialogContent>
    </DialogOverlay>
  </DialogPortal>
</template>
