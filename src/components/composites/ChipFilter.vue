<script setup lang="ts">
import type { PropType } from 'vue'
import Button from '../base/Button.vue'
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

function select(itemId: string) {
  if (modelValue.value === itemId && props.selection === 'optional') {
    modelValue.value = null
    return
  }
  modelValue.value = itemId
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2" role="group" :aria-label="props.label">
    <Button
      v-for="item in props.items"
      :key="item.id"
      type="button"
      variant="outlined"
      toggle
      :selected="modelValue == item.id"
      class="h-8 gap-1.5 px-3"
      @click="select(item.id)"
    >
      <template #selected-icon><Icon name="check" size="base" /></template>
      {{ item.label }}
    </Button>
  </div>
</template>
