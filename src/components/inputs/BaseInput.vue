<script setup lang="ts">
import { ref } from 'vue'
import { twMerge } from 'tailwind-merge'

const props = defineProps({
  field: {
    type: String,
    default: '',
  },
  error: {
    type: String,
    required: false,
    default: '',
  },
  label: {
    type: String,
    required: false,
    default: '',
  },
  helperMessage: {
    type: String,
    required: false,
    default: '',
  },
  enableHelperMessage: {
    type: Boolean,
    required: false,
    default: true,
  },
  required: Boolean,
})
const emit = defineEmits<{ (event: 'validation:touch'): void }>()

const containerRef = ref<HTMLElement | null>(null)

function onFocusOut(event: FocusEvent) {
  const relatedTarget = event.relatedTarget as Node | null
  const container = containerRef.value
  if (container && relatedTarget && container.contains(relatedTarget)) return
  emit('validation:touch')
}
</script>

<template>
  <div ref="containerRef" @focusout="onFocusOut" :class="`${twMerge(`flex flex-col gap-2`, $attrs.class as string)}`">
    <div v-if="props.label || $slots.label" class="text-sm font-medium">
      <label v-if="props.label" class="text-sm font-medium">
        <template v-if="!$slots.label">
          {{ props.label }}
          <span v-if="required" class="text-error">*</span>
        </template>
        <slot v-else name="label"></slot>
      </label>
      <div v-if="enableHelperMessage && (helperMessage || error)">
        <label v-if="helperMessage && !error" class="text-sm text-on-surface/[67%]">{{ helperMessage }}</label>
        <label v-else :class="`text-sm text-error `">{{ error }}</label>
      </div>
    </div>
    <slot></slot>
  </div>
</template>
