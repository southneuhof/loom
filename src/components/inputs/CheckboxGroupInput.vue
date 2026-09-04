<script setup lang="ts">
import { type PropType } from 'vue'
import type { OptionLoad, QueryNamespace } from '../../contracts'
import { commonProps } from './commonprops'
import BaseInput from './BaseInput.vue'
import Checkbox from './CheckboxInput.vue'
import { useOptionSource } from './useOptionSource'

const props = defineProps({
  pick: { type: String, default: 'id' },
  view: { type: String, default: 'name' },
  searchParameters: {
    type: Object as PropType<Record<string, unknown>>,
    required: false,
    default: () => ({}),
  },
  data: {
    type: Array as PropType<readonly Record<string, any>[]>,
  },
  load: Function as PropType<OptionLoad<Record<string, any>>>,
  namespace: String as PropType<QueryNamespace>,
  uniqueIDAs: {
    type: String,
  },
  ...commonProps,
})
const modelValue = defineModel<any[]>({ default: () => [] })

const { options: data, loading, error, refresh } = useOptionSource(props)
function identity(item: any) {
  return props.uniqueIDAs && item?.[props.pick] === undefined ? item?.[props.uniqueIDAs] : item?.[props.pick]
}

function handleItemClick(item: any) {
  const current = modelValue.value ?? []
  const itemIdentity = item[props.pick]
  if (current.some((value) => identity(value) === itemIdentity))
    modelValue.value = current.filter((value) => identity(value) !== itemIdentity)
  else
    modelValue.value = [...current, props.uniqueIDAs
      ? Object.fromEntries(Object.entries(item).filter(([key]) => key !== props.pick).concat([[props.uniqueIDAs, itemIdentity]]))
      : item]
}
</script>

<template>
  <BaseInput v-bind="props">
    <p v-if="loading" class="text-muted">Memuat data...</p>
    <p v-else-if="error" class="text-error">{{ error.message }} <button type="button" @click="refresh">Coba lagi</button></p>
    <div v-else class="grid gap-4 grid-dynamic-[250px]">
      <template v-for="item in data">
        <Checkbox :label="item[view]" :onToggle="() => handleItemClick(item)" :checked="!!modelValue.find((mvItem) => identity(mvItem) === item[pick])" />
      </template>
    </div>
  </BaseInput>
</template>
