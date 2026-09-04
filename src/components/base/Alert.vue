<script setup lang="ts">
import type { PropType } from 'vue'
import Icon from './Icon.vue'

const props = defineProps({
  type: {
    type: String as PropType<'info' | 'error' | 'warning' | 'success'>,
    required: false,
    default: 'info',
  },
  defaultIcon: {
    type: Boolean,
    required: false,
    default: true,
  },
})

const colorMap = {
  info: ['bg-info-light ', 'bg-info', 'text-info ', 'fill-info '],
  error: ['bg-error-light ', 'bg-error', 'text-error ', 'fill-error '],
  warning: ['bg-warning-light ', 'bg-warning', 'text-warning ', 'fill-warning '],
  success: ['bg-success-light ', 'bg-success', 'text-success ', 'fill-success '],
}
</script>

<template>
  <div :class="`${colorMap[props.type][0]} flex w-full flex-row gap-4 rounded-xl`">
    <div :class="`${colorMap[props.type][1]} w-2 rounded-l-lg`"></div>
    <div :class="`${colorMap[props.type][2]} flex flex-row items-center gap-4 py-4 pl-2 pr-8`">
      <div v-if="defaultIcon"><Icon name="error-warning"></Icon></div>
      <slot></slot>
    </div>
  </div>
</template>
