<script setup lang="ts">
import type { PropType } from 'vue'
const props = defineProps({
  color: {
    type: String as PropType<'on-primary' | 'on-surface'>,
    required: false,
    default: 'on-surface',
  },
})

const colorMap = {
  'on-primary': 'stroke-on-primary ',
  'on-surface': 'stroke-on-surface ',
}
</script>

<template>
  <svg class="spinner aspect-square min-h-[35px]" :class="colorMap[props.color]" viewBox="0 0 50 50">
    <circle class="path" cx="25" cy="25" r="20" fill="none" stroke-width="5"></circle>
  </svg>
</template>
