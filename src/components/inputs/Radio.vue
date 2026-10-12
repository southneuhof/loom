<script setup lang="ts">
import { useAttrs, type PropType } from 'vue'

defineOptions({ inheritAttrs: false })

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

const attrs = useAttrs()

function controlAttrs(): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(attrs).filter(([key]) => key === 'id' || key === 'name' || key === 'disabled' || key === 'required' || key === 'tabindex' || key.startsWith('aria-')),
  )
}

function wrapperAttrs(): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(attrs).filter(([key]) => key !== 'id' && key !== 'name' && key !== 'disabled' && key !== 'required' && key !== 'tabindex' && !key.startsWith('aria-')),
  )
}
</script>

<template>
  <div v-bind="wrapperAttrs()" :class="direction === 'row' ? 'flex-row' : 'flex-col'" class="group/radio flex cursor-default items-center gap-2">
    <input v-bind="controlAttrs()" type="radio" :checked="props.checked" class="native-radio" />
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
