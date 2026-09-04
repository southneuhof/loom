<script setup lang="ts">
import { watch } from 'vue'
import type { PropType } from 'vue'
import type { OptionLoad, QueryNamespace } from '../../contracts'
import Radio from '@southneuhof/loom/components/inputs/Radio.vue'
import { commonProps } from './commonprops'
import BaseInput from './BaseInput.vue'
import { useOptionSource } from './useOptionSource'

const props = defineProps({
  data: {
    type: Array as PropType<readonly Record<string, any>[]>,
  },
  load: Function as PropType<OptionLoad<Record<string, any>>>,
  namespace: String as PropType<QueryNamespace>,
  view: {
    type: String,
    default: 'name',
  },
  pick: {
    type: String,
    default: 'id',
  },
  variant: {
    type: String as PropType<'native' | 'card'>,
    default: 'native',
  },
  direction: {
    type: String as PropType<'row' | 'column'>,
    default: 'row',
  },
  defaultValue: {},
  searchParameters: {
    type: Object as PropType<Record<string, unknown>>,
    default: () => ({}),
  },
  ...commonProps,
})
const modelValue = defineModel()
const emit = defineEmits<{
  (event: 'validation:touch'): void
}>()
const { options: data, loading, error, refresh } = useOptionSource(props)

const directionClass = {
  row: 'flex flex-row gap-x-8 gap-y-4',
  column: 'flex flex-col gap-1',
}

watch(loading, (value) => {
  if (!value && props.defaultValue !== undefined && modelValue.value == null) modelValue.value = props.defaultValue
}, { immediate: true })

watch(modelValue, () => {
  emit('validation:touch')
})
</script>

<template>
  <BaseInput v-bind="props">
    <p v-if="loading" class="text-muted">Memuat data...</p>
    <p v-else-if="error" class="text-error">{{ error.message }} <button type="button" @click="refresh">Coba lagi</button></p>
    <div v-else-if="data.length" :class="`${directionClass[direction]} ${$attrs.class as string} flex-wrap`">
      <Radio v-for="item in data" @click="modelValue = item[pick]" :description="item[view]" :checked="modelValue === item[pick]">
        <template v-if="$slots['label']" #label>
          <slot name="label" v-bind="{ data: item }" />
        </template>
      </Radio>
    </div>
    <p v-else class="text-muted">Tidak ada data</p>
  </BaseInput>
</template>
