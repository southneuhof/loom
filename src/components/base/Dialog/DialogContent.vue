<script setup lang="ts">
import { type HTMLAttributes, computed, useAttrs } from 'vue'
import { DialogClose, DialogContent, type DialogContentEmits, type DialogContentProps, DialogOverlay, DialogPortal, useForwardPropsEmits } from 'reka-ui'
import { twMerge } from 'tailwind-merge'

const props = defineProps<DialogContentProps & { class?: HTMLAttributes['class'] }>()
const emits = defineEmits<DialogContentEmits>()
const attrs = useAttrs()

defineOptions({ inheritAttrs: false })

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props

  return { ...delegated, ...attrs }
})

const forwarded = useForwardPropsEmits(delegatedProps, emits) as any

const allowedOutsideInteractionSelector = '.tox, .tox-tinymce-aux, [data-mce-bogus], [data-reka-popper-content-wrapper], [data-reka-menu-content]'

function shouldPreventOutsideClose(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(target.closest(allowedOutsideInteractionSelector) || target.hasAttribute('data-mce-bogus'))
}
</script>

<template>
  <DialogPortal>
    <DialogOverlay class="fixed inset-0 z-10 bg-scrim/[38%] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
    <DialogContent
      v-bind="forwarded"
      :class="
        twMerge(
          'fixed left-1/2 top-1/2 z-10 w-full max-w-6xl -translate-x-1/2 -translate-y-1/2 transform rounded-3xl bg-surface-container text-left align-middle text-on-surface transition-all data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-2xl',
          props.class as any
        )
      "
      @pointerDownOutside="(e) => {
        if (shouldPreventOutsideClose(e.target)) {
          e.preventDefault()
        }
      }"
      @interactOutside="(e) => {
        if (shouldPreventOutsideClose(e.target)) {
          e.preventDefault()
        }
      }"
      @focusOutside="(e) => {
        if (shouldPreventOutsideClose(e.target)) {
          e.preventDefault()
        }
      }"
    >
      <slot />
    </DialogContent>
  </DialogPortal>
</template>
