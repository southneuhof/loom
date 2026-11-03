<script setup lang="ts">
import { ref, type PropType } from 'vue'
import { PopoverAnchor, PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import Card from './Card.vue'

const props = defineProps({
  matchWidth: { type: Boolean, default: false },
  anchor: { type: Boolean, default: false },
  align: {
    type: String as PropType<'start' | 'center' | 'end'>,
    default: 'start',
  },
  alignOffset: {
    type: Number,
    default: 0,
  },
  sideOffset: {
    type: Number,
    default: 4,
  },
  side: {
    type: String as PropType<'top' | 'bottom' | 'left' | 'right'>,
    default: 'bottom',
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  contentClass: {
    type: String,
    default: undefined,
  },
})

const anchorElement = ref<HTMLDivElement>()

const open = defineModel<boolean>({ default: false })

function setOpen(value: boolean) {
  open.value = value
}
</script>

<template>
  <slot v-if="disabled" name="trigger" v-bind="{ setOpen, disabled }"></slot>
  <PopoverRoot v-else v-model:open="open">
    <div ref="anchorElement" class="flex">
      <component :is="props.anchor ? PopoverAnchor : PopoverTrigger" as-child>
        <slot name="trigger" v-bind="{ setOpen, disabled }"></slot>
      </component>
    </div>
    <PopoverPortal>
      <PopoverContent
        :style="props.matchWidth ? { width: 'var(--reka-popover-trigger-width)' } : undefined"
        :class="props.matchWidth ? 'mx-0' : 'mx-2'"
        :align="props.align"
        :alignOffset="props.alignOffset"
        :sideOffset="props.sideOffset"
        :side="props.side"
        class="z-[10] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
        @open-auto-focus="(event) => { if (props.anchor) event.preventDefault() }"
        @close-auto-focus="(event) => { if (props.anchor) event.preventDefault() }"
        @interact-outside="(event) => {
          const target = event.target as HTMLElement
          if ((props.anchor && anchorElement?.contains(target)) || target?.closest('.dp__menu') || target?.closest('.dp__overlay')) {
            event.preventDefault()
          }
        }"
      >
        <Card :class="props.contentClass" variant="outlined">
          <slot name="content" v-bind="{ setOpen }"></slot>
        </Card>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
