<script setup lang="ts">
import { type PropType } from 'vue'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import Card from './Card.vue'

const props = defineProps({
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

const open = defineModel<boolean>({ default: false })

function setOpen(value: boolean) {
  open.value = value
}
</script>

<template>
  <slot v-if="disabled" name="trigger" v-bind="{ setOpen, disabled }"></slot>
  <PopoverRoot v-else v-model:open="open">
    <div class="flex">
      <PopoverTrigger as-child>
        <slot name="trigger" v-bind="{ setOpen, disabled }"></slot>
      </PopoverTrigger>
    </div>
    <PopoverPortal>
      <PopoverContent
        :align="props.align"
        :alignOffset="props.alignOffset"
        :sideOffset="props.sideOffset"
        :side="props.side"
        class="z-[10] mx-2 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
        @interact-outside="(event) => {
          const target = event.target as HTMLElement
          if (target?.closest('.dp__menu') || target?.closest('.dp__overlay')) {
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
