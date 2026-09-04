<script setup lang="ts">
import type { PropType } from 'vue'
import Chip from '@southneuhof/loom/components/base/Chip.vue'

const modelValue = defineModel()

const props = defineProps({
  items: {
    type: Array as PropType<Array<{ id: string; label: string }>>,
    required: true,
  },
  selection: {
    type: String as PropType<'optional' | 'required'>,
    required: true,
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
  <div class="flex flex-row items-center gap-2">
    <Chip
      v-for="item in props.items"
      :key="item.id"
      class="cursor-pointer"
      @click="select(item.id)"
      color="primary"
      :variant="modelValue == item.id ? 'tonal' : 'outline'"
    >
      {{ item.label }}
    </Chip>
  </div>
</template>
