<script setup lang="ts">
import { computed, onMounted, ref, watch, type PropType } from 'vue'
import type { OptionLoad, QueryNamespace } from '../../contracts'
import { useOptionSource } from './useOptionSource'
import { commonProps } from './commonprops'
import type { SelectModelValue } from './selectInput.types'
import BaseInput from './BaseInput.vue'
import Popover from '@southneuhof/loom/components/base/Popover.vue'
import SearchBox from '@southneuhof/loom/components/inputs/SearchBox.vue'
import Card from '@southneuhof/loom/components/base/Card.vue'
import Icon from '@southneuhof/loom/components/base/Icon.vue'

type Option = Record<string, unknown>
type SelectionContext = {
  mode: 'data' | 'load' | 'none'
  load: OptionLoad<Option> | undefined
  resource: string | undefined
  namespace: QueryNamespace | undefined
  searchParameters: unknown
  pick: string
  multi: boolean
  asWhole: boolean
  identityTransform: Readonly<Record<string, string>>
  optionIdentities: readonly string[]
}
type SelectedIdentity = { kind: 'record' | 'value'; value: unknown }
type ModelIdentity =
  | { kind: 'empty' }
  | { kind: 'single'; value: SelectedIdentity }
  | { kind: 'multiple'; values: readonly SelectedIdentity[] }

const props = defineProps({
  placeholder: { type: String, default: 'Pilih' },
  data: Array as PropType<readonly Option[]>,
  load: Function as PropType<OptionLoad<Option>>,
  resource: String as PropType<string>,
  namespace: String as PropType<QueryNamespace>,
  searchParameters: { type: Object as PropType<Record<string, unknown>>, default: () => ({}) },
  defaultToFirst: { type: Boolean, default: false },
  pick: { type: String, default: 'id' },
  view: { type: String, default: 'name' },
  multi: { type: Boolean, default: false },
  searchable: { type: Boolean, default: true },
  asWhole: { type: Boolean, default: false },
  transform: Object as PropType<Record<string, string>>,
  onSelect: { type: Function as PropType<(selection: Option | Option[] | null) => void>, default: () => {} },
  clearable: { type: Boolean, default: true },
  ...commonProps,
})
const modelValue = defineModel<SelectModelValue>()
const emit = defineEmits<{ (event: 'validation:touch'): void }>()
const source = useOptionSource(props)
const loading = source.loading
const sourceError = source.error
const query = ref('')
const selected = ref<Option | Option[] | null>(null)
let suppressDefault = false

function isRecord(value: unknown): value is Option {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function transformedOptions(values: readonly Option[]): Option[] {
  if (!props.transform) return [...values]
  return values.map((value) => {
    const item = { ...value }
    for (const [from, to] of Object.entries(props.transform ?? {})) {
      item[to] = item[from]
      delete item[from]
    }
    return item
  })
}

const data = computed(() => transformedOptions(source.options.value))
const filteredData = computed(() => {
  const search = query.value.toLowerCase()
  if (!search) return data.value
  return data.value.filter((item) => String(item[props.view] ?? '').toLowerCase().includes(search))
})

function identity(value: unknown, pick = props.pick): unknown {
  return isRecord(value) ? value[pick] : value
}

function normalizedIdentity(value: unknown): string | null {
  return value == null || value === '' ? null : String(value)
}

function modelIdentity(value: SelectModelValue | undefined, context: SelectionContext): ModelIdentity {
  if (value == null || value === '') return { kind: 'empty' }
  if (Array.isArray(value)) {
    return {
      kind: 'multiple',
      values: value.map((item) => ({
        kind: isRecord(item) ? 'record' : 'value',
        value: identity(item, context.pick),
      })),
    }
  }
  if (isRecord(value)) {
    return { kind: 'single', value: { kind: 'record', value: identity(value, context.pick) } }
  }
  return { kind: 'single', value: { kind: 'value', value } }
}

function sameModelIdentity(left: ModelIdentity, right: ModelIdentity): boolean {
  if (left.kind !== right.kind) return false
  if (left.kind === 'empty' || right.kind === 'empty') return true
  if (left.kind === 'single' && right.kind === 'single') {
    return left.value.kind === right.value.kind && Object.is(left.value.value, right.value.value)
  }
  if (left.kind === 'multiple' && right.kind === 'multiple') {
    return left.values.length === right.values.length && left.values.every((value, index) => (
      value.kind === right.values[index]?.kind && value.value === right.values[index]?.value
    ))
  }
  return false
}

function readContext(): SelectionContext {
  const mode = props.data !== undefined ? 'data' : props.load ? 'load' : 'none'
  const staticOptions = mode === 'data' ? transformedOptions(props.data ?? []) : []
  return {
    mode,
    load: source.externalContext.value.load,
    resource: source.externalContext.value.resource,
    namespace: source.externalContext.value.namespace,
    searchParameters: source.externalContext.value.searchParameters,
    pick: props.pick,
    multi: props.multi,
    asWhole: props.asWhole,
    identityTransform: Object.fromEntries(Object.entries(props.transform ?? {})
      .filter(([from, to]) => from === props.pick || to === props.pick)),
    optionIdentities: staticOptions.map((item) => normalizedIdentity(item[props.pick]) ?? 'null'),
  }
}

function sameContext(left: SelectionContext, right: SelectionContext): boolean {
  if (left.mode !== right.mode || left.pick !== right.pick || left.multi !== right.multi || left.asWhole !== right.asWhole) return false
  if (left.mode === 'data' && right.mode === 'data') {
    return left.optionIdentities.length === right.optionIdentities.length
      && left.optionIdentities.every((value, index) => value === right.optionIdentities[index])
  }
  if (left.mode !== 'load' || right.mode !== 'load') return true
  return left.load === right.load
    && left.resource === right.resource
    && left.namespace === right.namespace
    && JSON.stringify(left.searchParameters) === JSON.stringify(right.searchParameters)
    && JSON.stringify(left.identityTransform) === JSON.stringify(right.identityTransform)
}

function modelOption(value: unknown, options = data.value): Option | undefined {
  const valueIdentity = normalizedIdentity(identity(value))
  return options.find((item) => normalizedIdentity(item[props.pick]) === valueIdentity)
}

function pickSelected(): void {
  const value = modelValue.value
  if (props.multi) {
    if (Array.isArray(value) && value.length > 0) {
      selected.value = data.value.filter((item) => value.some((modelItem) => (
        normalizedIdentity(identity(modelItem)) === normalizedIdentity(item[props.pick])
      )))
    } else {
      selected.value = !suppressDefault && props.defaultToFirst && data.value[0] ? [data.value[0]] : []
    }
    return
  }
  if (Array.isArray(value)) {
    selected.value = data.value.filter((item) => value.some((modelItem) => (
      normalizedIdentity(identity(modelItem)) === normalizedIdentity(item[props.pick])
    )))
    return
  }
  if (value == null || value === '') {
    selected.value = !suppressDefault && props.defaultToFirst && data.value[0] ? data.value[0] : null
    return
  }
  selected.value = modelOption(value) ?? null
}

const currentPicked = computed(() => props.multi ? null : identity(modelValue.value))
const displayValue = computed(() => {
  if (Array.isArray(selected.value)) {
    const labels = selected.value.slice(0, 2).map((item) => String(item[props.view] ?? ''))
    return labels.join(', ') + (selected.value.length > 2 ? `, dan ${selected.value.length - 2} lainnya` : '')
  }
  return selected.value ? String(selected.value[props.view] ?? '') : ''
})

function readModelIdentity(context = readContext()): ModelIdentity {
  return modelIdentity(modelValue.value, context)
}

let previousContext = readContext()
let previousModelIdentity = readModelIdentity(previousContext)
let initialState = true

function setModelValue(value: SelectModelValue): void {
  const context = readContext()
  const nextIdentity = modelIdentity(value, context)
  if (sameModelIdentity(readModelIdentity(context), nextIdentity)) return
  modelValue.value = value
  previousModelIdentity = nextIdentity
}

function reconcileStaticSelection(value: SelectModelValue | undefined): void {
  const staticOptions = transformedOptions(props.data ?? [])
  if (props.multi) {
    if (!Array.isArray(value)) {
      if (value != null && value !== '') {
        suppressDefault = true
        setModelValue([])
      }
      selected.value = []
      return
    }
    const surviving = value.filter((item) => staticOptions.some((option) => (
      normalizedIdentity(option[props.pick]) === normalizedIdentity(identity(item))
    )))
    selected.value = staticOptions.filter((option) => surviving.some((item) => (
      normalizedIdentity(option[props.pick]) === normalizedIdentity(identity(item))
    )))
    if (surviving.length !== value.length) {
      suppressDefault = true
      setModelValue(surviving)
    }
    return
  }
  if (Array.isArray(value)) {
    if (value.length > 0) {
      suppressDefault = true
      setModelValue(null)
    }
    selected.value = null
    return
  }
  if (value == null || value === '') return
  if (!staticOptions.some((option) => normalizedIdentity(option[props.pick]) === normalizedIdentity(identity(value)))) {
    suppressDefault = true
    selected.value = null
    setModelValue(null)
  }
}

function hasSelection(value: SelectModelValue | undefined): boolean {
  return Array.isArray(value) ? value.length > 0 : value != null && value !== ''
}

function handleContextChange(nextContext: SelectionContext, modelChanged: boolean): void {
  if (nextContext.mode === 'data') {
    reconcileStaticSelection(modelValue.value)
    return
  }
  if (modelChanged || !hasSelection(modelValue.value)) return
  suppressDefault = true
  selected.value = props.multi ? [] : null
  setModelValue(props.multi ? [] : null)
}

function selectionModelValue(): SelectModelValue {
  if (props.multi) return Array.isArray(selected.value) ? selected.value : []
  if (!selected.value || Array.isArray(selected.value)) return null
  return props.asWhole ? selected.value : selected.value[props.pick] as string | number
}

function updateModelValue(): void {
  setModelValue(selectionModelValue())
}

function handleItemClick(item: Option | null, setOpen: (value: boolean) => void): void {
  if (props.disabled) return
  if (item === null) {
    selected.value = props.multi ? [] : null
    setOpen(false)
  } else if (!props.multi) {
    selected.value = item
    setOpen(false)
  } else {
    const current = Array.isArray(selected.value) ? selected.value : []
    const exists = current.some((entry) => normalizedIdentity(entry[props.pick]) === normalizedIdentity(item[props.pick]))
    selected.value = exists
      ? current.filter((entry) => normalizedIdentity(entry[props.pick]) !== normalizedIdentity(item[props.pick]))
      : [...current, item]
  }
  suppressDefault = false
  updateModelValue()
  props.onSelect(selected.value)
  emit('validation:touch')
}

watch(() => ({ context: readContext(), model: modelValue.value }), ({ context, model }) => {
  const modelChanged = !sameModelIdentity(previousModelIdentity, modelIdentity(model, previousContext))
  const contextChanged = !sameContext(previousContext, context)
  const isInitialState = initialState
  initialState = false
  previousContext = context
  previousModelIdentity = modelIdentity(model, context)
  if (isInitialState && context.mode === 'data') reconcileStaticSelection(model)
  else if (contextChanged) handleContextChange(context, modelChanged)
  else if (modelChanged) suppressDefault = false
  pickSelected()
}, { immediate: true, deep: true, flush: 'pre' })

watch([data, loading], () => {
  pickSelected()
  if (loading.value || suppressDefault || hasSelection(modelValue.value)) return
  if (props.multi) {
    if (!Array.isArray(modelValue.value)) setModelValue([])
  } else if (props.defaultToFirst && data.value[0]) {
    selected.value = data.value[0]
    updateModelValue()
  }
}, { immediate: true })

onMounted(() => {
  if (props.multi && modelValue.value == null) {
    selected.value = []
    setModelValue([])
  }
})
</script>

<template>
  <BaseInput v-bind="props">
    <div class="w-full min-w-0 max-w-full">
      <Popover :class="$attrs.class" :disabled="disabled" contentClass="p-0">
        <template #trigger>
          <div
            :class="`flex w-full min-w-0 max-w-full flex-row items-center justify-between gap-2 overflow-hidden rounded-lg bg-transparent px-4 py-2 outline outline-1 outline-outline/[24%] transition-[outline-color,box-shadow] duration-150 ease-out focus-within:outline-secondary focus-within:ring-1 focus-within:ring-secondary/30 ${
              disabled ? 'pointer-events-none cursor-not-allowed opacity-60 ' : ''
            } ${$attrs.class || ''}`"
          >
            <p v-if="displayValue" class="min-w-0 max-w-full flex-1 truncate text-start">{{ displayValue }}</p>
            <p v-else class="text-muted">{{ placeholder }}</p>
            <Icon v-if="disabled || !modelValue || !clearable" name="arrow-down-s" />
            <button v-else-if="clearable" @click="() => handleItemClick(null, () => {})" class="flex items-center justify-center">
              <Icon name="close" />
            </button>
          </div>
        </template>
        <template #content="{ setOpen }">
          <Card variant="outlined" color="surfaceContainerHigh" class="p-0 max-h-80 max-w-screen-sm gap-1 shadow-sm">
            <div v-if="props.searchable" class="sticky top-0 z-10 border-b border-outline-variant bg-surface-container-high p-4">
              <SearchBox v-model="query" :debounced="false" placeholder="Cari..." />
            </div>
            <p v-if="loading" class="p-2 text-xs text-muted">Memuat data...</p>
            <div v-else-if="sourceError" class="flex items-center gap-2 p-2 text-xs text-error">
              <span>{{ sourceError.message }}</span>
              <button type="button" @click="source.refresh">Coba lagi</button>
            </div>
            <div v-else-if="filteredData.length" class="h-full overflow-y-auto">
              <Card
                v-for="item in filteredData"
                color="surfaceContainerHigh"
                class="flex flex-row items-center justify-between gap-4"
                style="padding: 8px 16px"
                @click="() => handleItemClick(item, setOpen)"
              >
                <div class="">{{ item[view] }}</div>
                <Icon v-if="multi && Array.isArray(modelValue)" :class="modelValue.map((item) => item[pick]).includes(item[pick]) ? 'opacity-100' : 'opacity-0'" name="check"></Icon>
                <Icon v-else :class="String(currentPicked) === String(item[pick]) ? 'opacity-100' : 'opacity-0'" name="check"></Icon>
              </Card>
            </div>
            <p v-else class="p-2 text-xs text-muted">Tidak ada data</p>
          </Card>
        </template>
      </Popover>
    </div>
  </BaseInput>
</template>
