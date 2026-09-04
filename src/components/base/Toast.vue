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
  info: 'bg-info text-on-info',
  error: 'bg-error text-on-error',
  warning: 'bg-warning text-on-warning',
  success: 'bg-success text-on-success',
}
</script>

<template>
  <div>
    <div :class="`flex w-fit flex-row gap-4 rounded-full ${colorMap[props.type]}`">
      <div class="flex flex-row items-center gap-4 px-8 py-4">
        <Icon name="error-warning" class="shrink-0 fill-white"></Icon>
        <slot></slot>
      </div>
    </div>
  </div>
</template>
