<script setup lang="ts">
import type { PropType } from 'vue'
import Icon from '../base/Icon.vue'

const modelValue = defineModel<string | null | undefined>()

const props = defineProps({
  items: {
    type: Array as PropType<readonly { id: string; label: string }[]>,
    required: true,
  },
  selection: {
    type: String as PropType<'optional' | 'required'>,
    required: true,
  },
  label: {
    type: String,
    default: undefined,
  },
})

function isSelected(itemId: string): boolean {
  return modelValue.value == itemId
}

function select(itemId: string) {
  if (modelValue.value === itemId && props.selection === 'optional') {
    modelValue.value = null
    return
  }
  modelValue.value = itemId
}

function chipClass(itemId: string): string {
  const base =
    'overlay relative inline-flex h-8 w-fit min-w-max cursor-pointer select-none items-center justify-center gap-1.5 overflow-hidden whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
  return isSelected(itemId)
    ? `${base} border border-transparent bg-secondary-container pl-2 pr-3 text-on-secondary-container after:bg-on-secondary-container-hover focus-visible:after:bg-on-secondary-container-active active:after:bg-on-secondary-container-active`
    : `${base} border border-outline-variant bg-transparent px-3 text-on-surface-variant hover:bg-surface-container-high after:bg-on-surface-hover focus-visible:after:bg-on-surface-active active:after:bg-on-surface-active`
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2" role="group" :aria-label="props.label">
    <button
      v-for="item in props.items"
      :key="item.id"
      type="button"
      :aria-pressed="isSelected(item.id) ? 'true' : 'false'"
      :class="chipClass(item.id)"
      @click="select(item.id)"
    >
      <Icon v-if="isSelected(item.id)" name="check" size="base" />
      <span>{{ item.label }}</span>
    </button>
  </div>
</template>
