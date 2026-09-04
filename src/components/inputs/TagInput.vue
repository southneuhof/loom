<script setup lang="ts">
import { ref, watch } from 'vue'
import TextInput from './TextInput.vue'
import { commonProps } from './commonprops'
import type { PropType } from 'vue'
import BaseInput from './BaseInput.vue'
import Chip from '@southneuhof/loom/components/base/Chip.vue'
import Icon from '@southneuhof/loom/components/base/Icon.vue'

const props = defineProps({
  prefix: {
    type: String,
    default: '',
  },
  suffix: {
    type: String,
    default: '',
  },
  icon: {
    type: String,
    default: '',
  },
  placeholder: {
    type: String,
    default: '',
  },
  constraint: {
    type: Array as PropType<Array<'number' | 'text'>>,
    default: ['text', 'number'],
  },
  separator: {
    type: String,
    default: ',',
  },
  validator: {
    type: Function,
    default: () => true,
  },
  ...commonProps,
})

const modelValue = defineModel<string[]>()

const tags = ref<any>(modelValue.value?.length == 0 ? [] : modelValue.value || [])
const inputValue = ref<string>('')

function removeTag(index: number) {
  tags.value.splice(index, 1)
  modelValue.value = tags.value
}

watch(inputValue, () => {
  if (inputValue.value.slice(-1) === props.separator) {
    if (!props.validator(inputValue.value.slice(0, -1))) return
    const value = inputValue.value.slice(0, -1)
    if (inputValue.value !== '' && !tags.value.includes(value)) tags.value.push(value)
    inputValue.value = ''
    modelValue.value = tags.value
  }
})

watch(
  () => modelValue.value,
  (newValue) => {
    const nextTags = newValue || []
    if (JSON.stringify(tags.value) !== JSON.stringify(nextTags)) tags.value = [...nextTags]
  },
  { immediate: true, deep: true }
)
</script>

<template>
  <BaseInput v-bind="props">
    <div class="flex flex-col gap-4">
      <div class="flex flex-row flex-wrap gap-2">
        <template v-if="tags.length">
          <Chip v-for="(item, index) in tags" color="neutral" @click="() => removeTag((index as any))" interactive class="flex flex-row items-center gap-1"
            >{{ item }} <Icon name="close" size="sm"></Icon
          ></Chip>
        </template>
        <div v-else class="h-[25px] max-h-[25px] min-h-[25px] text-muted">Belum ada data yang dimasukkan</div>
      </div>
      <TextInput
        v-bind="{ prefix, suffix, icon, constraint }"
        placeholder="Tekan tombol koma (,) untuk memisahkan"
        :model-value="inputValue"
        @update:model-value="(value) => (inputValue = String(value))"
      />
    </div>
  </BaseInput>
</template>
