<script setup lang="ts">
import type { PropType } from 'vue'

const props = defineProps({
  checked: {
    type: Boolean,
    required: false,
    default: false,
  },
  description: {
    type: String,
    required: false,
  },
  direction: {
    type: String as PropType<'column' | 'row'>,
    default: 'row',
  },
})
</script>

<template>
  <div :class="direction === 'row' ? 'flex-row' : 'flex-col'" class="group/radio flex cursor-default items-center gap-2">
    <input type="radio" :checked="props.checked" class="native-radio" />
    <label v-if="!$slots['label']" @click="$emit('update:checked', !props.checked)">{{ props.description }}</label>
    <slot v-else name="label"></slot>
  </div>
</template>

<style scoped>
/* .native-radio {
  accent-color: rgb(var(--md-sys-color-primary));
}

.dark .native-radio {
  accent-color: rgb(var(--md-sys-color-primary));
  mix-blend-mode: unset;
} */
</style>
