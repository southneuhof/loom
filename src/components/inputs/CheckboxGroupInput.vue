<script setup lang="ts">
import { watch, type PropType } from 'vue'
import type { OptionLoad } from '../../contracts/load'
import type { QueryNamespace } from '../../contracts/query'
import { commonProps } from './commonprops'
import BaseInput from './BaseInput.vue'
import Checkbox from './CheckboxInput.vue'
import { sameOptionSourceContext, useOptionSource } from './useOptionSource'

type Option = Record<string, unknown>
type ModelValue = Array<string | number | Record<string, unknown>>
type SelectionContext = ReturnType<typeof readContext>
type SelectedIdentity = { kind: 'record' | 'value'; value: unknown }

const props = defineProps({
  pick: { type: String, default: 'id' },
  view: { type: String, default: 'name' },
  searchParameters: { type: Object as PropType<Record<string, unknown>>, default: () => ({}) },
  data: Array as PropType<readonly Option[]>,
  load: Function as PropType<OptionLoad<Option>>,
  resource: String as PropType<string>,
  namespace: String as PropType<QueryNamespace>,
  uniqueIDAs: String,
  ...commonProps,
})
const modelValue = defineModel<ModelValue>({ default: () => [] })
const source = useOptionSource(props, (options) => options.map((item) => item[props.pick]))
const { options: data, loading, error, refresh } = source

function identity(value: unknown, pick = props.pick, uniqueIDAs = props.uniqueIDAs): unknown {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return value
  const item = value as Record<string, unknown>
  return uniqueIDAs && item[pick] === undefined ? item[uniqueIDAs] : item[pick]
}

function readContext() {
  return {
    source: source.externalContext.value,
    pick: props.pick,
    uniqueIDAs: props.uniqueIDAs,
  }
}

function modelIdentities(value: readonly ModelValue[number][], context: SelectionContext): readonly SelectedIdentity[] {
  return value.map((item) => ({
    kind: item !== null && typeof item === 'object' && !Array.isArray(item) ? 'record' : 'value',
    value: identity(item, context.pick, context.uniqueIDAs),
  }))
}

function sameModel(left: readonly SelectedIdentity[], right: readonly SelectedIdentity[]): boolean {
  return left.length === right.length && left.every((value, index) => (
    value.kind === right[index]?.kind && Object.is(value.value, right[index]?.value)
  ))
}

let previousContext = readContext()
let previousModel = modelIdentities(modelValue.value, previousContext)
let initialState = true

function setModelValue(value: ModelValue): void {
  if (sameModel(modelIdentities(modelValue.value, readContext()), modelIdentities(value, readContext()))) return
  modelValue.value = value
  previousModel = modelIdentities(value, readContext())
}

function reconcileStaticValues(): void {
  const current = modelValue.value ?? []
  const surviving = current.filter((value) => (props.data ?? []).some((item) => (
    Object.is(item[props.pick], identity(value))
  )))
  if (surviving.length !== current.length) setModelValue(surviving)
}

watch(() => ({ context: readContext(), model: modelValue.value }), ({ context, model }) => {
  const currentModel = modelIdentities(model ?? [], previousContext)
  const modelChanged = !sameModel(previousModel, currentModel)
  const contextChanged = previousContext.pick !== context.pick
    || previousContext.uniqueIDAs !== context.uniqueIDAs
    || !sameOptionSourceContext(previousContext.source, context.source)
  const isInitialState = initialState
  initialState = false
  previousContext = context
  previousModel = modelIdentities(model ?? [], context)
  if (isInitialState) {
    if (context.source.mode === 'data') reconcileStaticValues()
    return
  }
  if (!contextChanged) return
  if (context.source.mode === 'data') {
    reconcileStaticValues()
  } else if (!modelChanged && previousModel.length > 0) {
    setModelValue([])
  }
}, { immediate: true, deep: true, flush: 'pre' })

function handleItemClick(item: Option): void {
  if (props.disabled) return
  const current = modelValue.value ?? []
  const itemIdentity = item[props.pick]
  if (current.some((value) => Object.is(identity(value), itemIdentity))) {
    setModelValue(current.filter((value) => !Object.is(identity(value), itemIdentity)))
  } else {
    const value = props.uniqueIDAs
      ? Object.fromEntries(Object.entries(item).filter(([key]) => key !== props.pick).concat([[props.uniqueIDAs, itemIdentity]]))
      : item
    setModelValue([...current, value])
  }
}
</script>

<template>
  <BaseInput v-bind="props" v-slot="{ controlBindings }">
    <p v-if="loading" class="text-muted">Memuat data...</p>
    <p v-else-if="error" class="text-error">{{ error.message }} <button type="button" @click="refresh">Coba lagi</button></p>
    <div v-else role="group" class="grid gap-4 grid-dynamic-[250px]" :aria-required="controlBindings['aria-required']" :aria-invalid="controlBindings['aria-invalid']">
      <template v-for="(item, index) in data">
        <Checkbox
          v-bind="{ ...controlBindings, id: index === 0 ? controlBindings.id : undefined, required: false }"
          :label="String(item[view] ?? '')"
          :onToggle="() => handleItemClick(item)"
          :checked="!!modelValue.find((mvItem) => Object.is(identity(mvItem), item[pick]))"
        />
      </template>
    </div>
  </BaseInput>
</template>
