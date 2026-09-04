<script setup lang="ts">
import type { PropType } from 'vue'
import Card from './Card.vue'

const props = defineProps({
  color: {
    type: String as PropType<
      | 'surface'
      | 'surfaceContainerLowest'
      | 'surfaceContainerLow'
      | 'surfaceContainer'
      | 'surfaceContainerHigh'
      | 'surfaceContainerHighest'
      | 'primaryContainer'
      | 'secondaryContainer'
      | 'tertiaryContainer'
      | 'errorContainer'
    >,
    required: false,
    default: 'surfaceContainer',
  },
})
</script>

<template>
  <Card :color="props.color" class="color-breathe"></Card>
</template>

<style scoped>
.color-breathe {
  animation: 1s infinite alternate ease-out breathing-color;
}

@keyframes breathing-color {
  from {
    filter: brightness(100%);
  }
  to {
    filter: brightness(92%);
  }
}
</style>
