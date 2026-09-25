<script setup lang="ts">
import { computed, watch, type PropType } from 'vue'
import type { OptionLoad, QueryNamespace } from '../../contracts'
import Radio from '@southneuhof/loom/components/inputs/Radio.vue'
import { commonProps } from './commonprops'
import BaseInput from './BaseInput.vue'
import { useOptionSource } from './useOptionSource'

type Option = Record<string, unknown>
type SelectionContext = {
  mode: 'data' | 'load' | 'none'
  load: OptionLoad<Option> | undefined
  namespace: QueryNamespace | undefined
  searchParameters: unknown
  pick: string
  optionIdentities: readonly unknown[]
}

const props = defineProps({
  data: Array as PropType<readonly Option[]>,
  load: Function as PropType<OptionLoad<Option>>,
  namespace: String as PropType<QueryNamespace>,
  view: { type: String, default: 'name' },
  pick: { type: String, default: 'id' },
  variant: { type: String as PropType<'native' | 'card'>, default: 'native' },
  direction: { type: String as PropType<'row' | 'column'>, default: 'row' },
  defaultValue: { type: [String, Number] as PropType<string | number>, default: undefined },
  searchParameters: { type: Object as PropType<Record<string, unknown>>, default: () => ({}) },
  ...commonProps,
})
const modelValue = defineModel<string | number>()
const emit = defineEmits<{ (event: 'validation:touch'): void }>()
const source = useOptionSource(props)
const { options: data, loading, error, refresh } = source
const directionClass = {
  row: 'flex flex-row gap-x-8 gap-y-4',
  column: 'flex flex-col gap-1',
}
let suppressDefault = false

function readContext(): SelectionContext {
  const mode = props.data !== undefined ? 'data' : props.load ? 'load' : 'none'
  return {
    mode,
    load: source.externalContext.value.load,
    namespace: source.externalContext.value.namespace,
    searchParameters: source.externalContext.value.searchParameters,
    pick: props.pick,
    optionIdentities: mode === 'data' ? (props.data ?? []).map((item) => item[props.pick]) : [],
  }
}

function sameContext(left: SelectionContext, right: SelectionContext): boolean {
  if (left.mode !== right.mode || left.pick !== right.pick) return false
  if (left.mode === 'data' && right.mode === 'data') {
    return left.optionIdentities.length === right.optionIdentities.length
      && left.optionIdentities.every((value, index) => Object.is(value, right.optionIdentities[index]))
  }
  if (left.mode !== 'load' || right.mode !== 'load') return true
  return left.load === right.load
    && left.namespace === right.namespace
    && JSON.stringify(left.searchParameters) === JSON.stringify(right.searchParameters)
}

let previousContext = readContext()
let previousModel = modelValue.value
let initialState = true

function setModelValue(value: string | number | undefined): void {
  if (Object.is(modelValue.value, value)) return
  modelValue.value = value
  previousModel = value
}

function reconcileStaticValue(): void {
  const value = modelValue.value
  if (value == null) return
  if ((props.data ?? []).some((item) => Object.is(item[props.pick], value))) return
  suppressDefault = true
  setModelValue(undefined)
}

function choose(value: unknown): void {
  if (props.disabled || (typeof value !== 'string' && typeof value !== 'number')) return
  suppressDefault = false
  setModelValue(value)
  emit('validation:touch')
}

function applyDefault(): void {
  if (!loading.value && !suppressDefault && props.defaultValue !== undefined && modelValue.value == null) {
    setModelValue(props.defaultValue)
  }
}

watch(() => ({ context: readContext(), model: modelValue.value }), ({ context, model }) => {
  const modelChanged = !Object.is(previousModel, model)
  const contextChanged = !sameContext(previousContext, context)
  const isInitialState = initialState
  initialState = false
  previousContext = context
  previousModel = model
  if (isInitialState && context.mode === 'data') reconcileStaticValue()
  else if (contextChanged && context.mode === 'data') reconcileStaticValue()
  else if (contextChanged && !modelChanged && modelValue.value != null) {
    suppressDefault = true
    setModelValue(undefined)
  } else if (modelChanged) {
    suppressDefault = false
  }
}, { immediate: true, deep: true, flush: 'pre' })

watch(loading, applyDefault, { immediate: true })
</script>

<template>
  <BaseInput v-bind="props">
    <p v-if="loading" class="text-muted">Memuat data...</p>
    <p v-else-if="error" class="text-error">{{ error.message }} <button type="button" @click="refresh">Coba lagi</button></p>
    <div v-else-if="data.length" :class="`${directionClass[direction]} ${$attrs.class as string} flex-wrap`">
      <Radio v-for="item in data" @click="choose(item[pick])" :description="String(item[view] ?? '')" :checked="modelValue === item[pick]">
        <template v-if="$slots['label']" #label>
          <slot name="label" v-bind="{ data: item }" />
        </template>
      </Radio>
    </div>
    <p v-else class="text-muted">Tidak ada data</p>
  </BaseInput>
</template>
