<script setup lang="ts">
import { watch, type PropType } from 'vue'
import type { OptionLoad } from '../../contracts/load'
import type { QueryNamespace } from '../../contracts/query'
import Radio from '@southneuhof/loom/components/inputs/Radio.vue'
import { commonProps } from './commonprops'
import BaseInput from './BaseInput.vue'
import { sameOptionSourceContext, useOptionSource } from './useOptionSource'

type Option = Record<string, unknown>

const props = defineProps({
  data: Array as PropType<readonly Option[]>,
  load: Function as PropType<OptionLoad<Option>>,
  resource: String as PropType<string>,
  namespace: String as PropType<QueryNamespace>,
  view: { type: String, default: 'name' },
  pick: { type: String, default: 'id' },
  variant: { type: String as PropType<'native' | 'card'>, default: 'native' },
  direction: { type: String as PropType<'row' | 'column'>, default: 'row' },
  defaultValue: { type: [String, Number, Boolean] as PropType<string | number | boolean>, default: undefined },
  searchParameters: { type: Object as PropType<Record<string, unknown>>, default: () => ({}) },
  ...commonProps,
})
const modelValue = defineModel<string | number | boolean>()
const emit = defineEmits<{ (event: 'validation:touch'): void }>()
const source = useOptionSource(props, (options) => options.map((item) => item[props.pick]))
const { options: data, loading, error, refresh } = source
const directionClass = {
  row: 'flex flex-row gap-x-8 gap-y-4',
  column: 'flex flex-col gap-1',
}
let suppressDefault = false

function readContext() {
  return { source: source.externalContext.value, pick: props.pick }
}

let previousContext = readContext()
let previousModel = modelValue.value
let initialState = true

function setModelValue(value: string | number | boolean | undefined): void {
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
  if (props.disabled || (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean')) return
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
  const contextChanged = previousContext.pick !== context.pick
    || !sameOptionSourceContext(previousContext.source, context.source)
  const isInitialState = initialState
  initialState = false
  previousContext = context
  previousModel = model
  if ((isInitialState || contextChanged) && context.source.mode === 'data') reconcileStaticValue()
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
  <BaseInput v-bind="props" v-slot="{ controlBindings }">
    <p v-if="loading" class="text-muted">Loading options...</p>
    <p v-else-if="error" class="text-error">{{ error.message }} <button type="button" @click="refresh">Try again</button></p>
    <div v-else-if="data.length" role="radiogroup" :aria-required="controlBindings['aria-required']" :aria-invalid="controlBindings['aria-invalid']" :class="`${directionClass[direction]} ${$attrs.class as string} flex-wrap`">
      <Radio
        v-for="(item, index) in data"
        v-bind="{ ...controlBindings, id: index === 0 ? controlBindings.id : undefined, name: typeof $attrs.name === 'string' ? $attrs.name : controlBindings.id, required: controlBindings.required && index === 0 }"
        @click="choose(item[pick])"
        :description="String(item[view] ?? '')"
        :checked="modelValue === item[pick]"
      >
        <template v-if="$slots['label']" #label>
          <slot name="label" v-bind="{ data: item }" />
        </template>
      </Radio>
    </div>
    <p v-else class="text-muted">Tidak ada data</p>
  </BaseInput>
</template>
