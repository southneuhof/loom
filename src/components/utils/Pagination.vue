<script setup lang="ts">
import Select from '@southneuhof/loom/components/inputs/SelectInput.vue'
import { watch, type PropType, computed, ref } from 'vue'
import Button from '@southneuhof/loom/components/base/Button.vue'
import Icon from '@southneuhof/loom/components/base/Icon.vue'

const emit = defineEmits(['update:modelValue'])
const props = defineProps({
  dataInfo: {
    type: Object as PropType<{ total: number; totalPage: number; length: number }>,
    required: true,
  },
  disableLengthControl: {
    type: Boolean,
    required: false,
    default: false,
  },
  limitSet: {
    type: Array as PropType<number[]>,
    required: true,
  },
})

const modelValue = defineModel<any>()
const limitValue = ref(modelValue.value.limit)
watch(
  limitValue,
  (newValue, oldValue) => {
    if (newValue != oldValue) {
      modelValue.value.limit = newValue
    }
  },
  { deep: true }
)
</script>

<template>
  <div class="flex flex-col flex-wrap items-center justify-between gap-4 sm:flex-row">
    <div class="flex flex-row gap-2">
      <Button variant="tonal" :disabled="modelValue.page <= 1" @click="() => (modelValue.page = 1)"><Icon size="base" name="arrow-left-double" /></Button>
      <Button variant="tonal" :disabled="modelValue.page <= 1" @click="() => modelValue.page--"><Icon size="base" name="arrow-left-s" /></Button>
      <div class="flex aspect-square w-9 items-center justify-center rounded-full px-2 text-sm">{{ modelValue.page }}</div>
      <Button variant="tonal" :disabled="modelValue.page >= dataInfo.totalPage" @click="() => modelValue.page++"><Icon size="base" name="arrow-right-s" /></Button>
      <Button variant="tonal" :disabled="modelValue.page >= dataInfo.totalPage" @click="() => (modelValue.page = dataInfo.totalPage)"><Icon size="base" name="arrow-right-double" /></Button>
    </div>
    <div v-if="!$slots['pagination-lengthControl']" class="flex flex-row items-center gap-4 text-sm">
      <Select :data="limitSet.map((item) => ({ id: String(item), name: String(item) }))" v-model="limitValue"></Select>
      <div class="text-muted">Menampilkan {{ dataInfo.length }} dari {{ dataInfo.total }} data</div>
    </div>
    <slot v-else name="pagination-lengthControl"></slot>
  </div>
</template>
