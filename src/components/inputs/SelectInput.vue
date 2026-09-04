<script setup lang="ts">
import { ref, type PropType, watch, computed, type ComputedRef, onMounted } from 'vue'
import type { OptionLoad, QueryNamespace } from '../../contracts'
import { useOptionSource } from './useOptionSource'
import { commonProps } from './commonprops'
import BaseInput from './BaseInput.vue'
import Popover from '@southneuhof/loom/components/base/Popover.vue'
import SearchBox from '@southneuhof/loom/components/inputs/SearchBox.vue'
import Card from '@southneuhof/loom/components/base/Card.vue'
import Icon from '@southneuhof/loom/components/base/Icon.vue'

const props = defineProps({
  placeholder: {
    type: String,
    required: false,
    default: 'Pilih',
  },
  data: {
    type: Array as PropType<readonly Record<string, any>[]>,
    required: false,
  },
  load: Function as PropType<OptionLoad<Record<string, any>>>,
  namespace: String as PropType<QueryNamespace>,
  searchParameters: {
    type: Object as PropType<Record<string, unknown>>,
    required: false,
    default: () => ({}),
  },
  defaultToFirst: {
    type: Boolean,
    required: false,
    default: false,
  },
  pick: {
    type: String,
    required: false,
    default: 'id',
  },
  view: {
    type: String,
    required: false,
    default: 'name',
  },
  multi: {
    type: Boolean,
    required: false,
    default: false,
  },
  searchable: {
    type: Boolean,
    required: false,
    default: true,
  },
  asWhole: {
    type: Boolean,
    required: false,
    default: false,
  },
  transform: {
    type: Object,
  },
  onSelect: {
    type: Function,
    default: () => {},
  },
  clearable: {
    type: Boolean,
    required: false,
    default: true,
  },
  ...commonProps,
})
type SelectRecord = Record<string, any>
type SelectModelValue = SelectRecord[] | SelectRecord | string | null
const modelValue = defineModel<SelectModelValue>()
const emit = defineEmits<{
  (event: 'validation:touch'): void
}>()

const source = useOptionSource(props)
const loading = source.loading
const sourceError = source.error
const data = computed(() => {
  const values = [...source.options.value]
  if (!props.transform) return values
  const entries = Object.entries(props.transform)
  return values.map((value: any) => {
    const item = { ...value }
    for (const [from, to] of entries) {
      item[String(to)] = item[from]
      delete item[from]
    }
    return item
  })
})
const query = ref('')
const selected = ref<any[] | Record<string, string> | null>()

function isRecord(value: unknown): value is Record<string, any> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

onMounted(() => {
  if (modelValue.value != null) return
  if (props.multi) {
    modelValue.value = []
    selected.value = []
  }
})

let displayValue: ComputedRef<string>
const filteredData = computed(() => {
  if (query.value) return data.value.filter((item: any) => item[props.view].toLowerCase().includes(query.value.toLowerCase()))
  else return data.value
})

function isSameValue(a: any, b: any) {
  if (a === b) return true
  if ((a == null && b === '') || (a === '' && b == null)) return true

  const aIsObject = a != null && typeof a === 'object'
  const bIsObject = b != null && typeof b === 'object'

  // For object values (asWhole mode), compare by picked key to avoid
  // false positives like String({}) === String({}) => "[object Object]".
  if (aIsObject || bIsObject) {
    const aPicked = aIsObject ? (a as any)?.[props.pick] : a
    const bPicked = bIsObject ? (b as any)?.[props.pick] : b
    return String(aPicked) === String(bPicked)
  }

  return String(a) === String(b)
}

const currentPicked = computed(() => {
  if (props.multi) return null
  if (props.asWhole && modelValue.value && typeof modelValue.value === 'object') {
    return (modelValue.value as any)[props.pick]
  }
  return modelValue.value as any
})

function pickSelected() {
  if (props.multi) {
    if (Array.isArray(modelValue.value) && modelValue.value.length) {
      selected.value = data.value.filter((item: any) => (modelValue.value as any[]).some((modelItem) => (
        isRecord(modelItem) && String(modelItem[props.pick]) === String(item[props.pick])
      )))
    } else {
      selected.value = props.defaultToFirst ? [data.value[0]] : []
    }
    return
  }
  if (Array.isArray(modelValue.value)) {
    if (modelValue.value?.length)
      (selected.value as any[]) = data.value.filter((item: any) => (modelValue.value as any[]).find((modelItem: any) => String(modelItem[props.pick]) === String(item[props.pick])))
    else selected.value = props.defaultToFirst ? [data.value[0]] : []
  } else {
    if (modelValue.value) {
      if (props.asWhole && typeof modelValue.value === 'object') {
        selected.value = data.value.find((item: any) => String(item[props.pick]) === String((modelValue.value as any)?.[props.pick]))
      } else {
        selected.value = data.value.find((item: any) => String(item[props.pick]) === String(modelValue.value))
      }
    } else {
      selected.value = props.defaultToFirst ? data.value[0] : null
    }
  }
}

displayValue = computed(() => {
  if (props.multi) {
    if (selected.value?.length)
      return (
        (selected.value as any[])
          .slice(0, 2)
          .map((item) => item[props.view])
          .join(', ') + ((selected.value as any[]).length > 2 ? `, dan ${(selected.value as any[]).length - 2} lainnya` : '')
      )
    else return ''
  } else {
    if (selected.value != null) return (selected.value as any)[props.view]
    else return ''
  }
})

function reconcileSelection() {
  if (loading.value) return
  const hadValue = modelValue.value != null && (Array.isArray(modelValue.value) ? modelValue.value.length > 0 : true)
  pickSelected()
  if (!hadValue || props.multi) {
    updateModelValue()
  }
}

function updateModelValue() {
  let nextValue: any

  if (props.multi) {
    nextValue = Array.isArray(selected.value) ? selected.value : []
  } else {
    nextValue = selected.value == null ? null : props.asWhole ? (selected.value as any) : (selected.value as any)[props.pick]
  }

  if (props.multi) {
    const currentValue = Array.isArray(modelValue.value) ? modelValue.value : []
    const mappedCurrent = currentValue.map((item: any) => item?.[props.pick])
    const mappedNext = Array.isArray(nextValue) ? nextValue.map((item: any) => item?.[props.pick]) : []

    if (JSON.stringify(mappedCurrent) !== JSON.stringify(mappedNext)) {
      modelValue.value = nextValue
    }
  } else if (!isSameValue(modelValue.value, nextValue)) {
    modelValue.value = nextValue
  }

  props.onSelect(selected.value)
}

function handleItemClick(item: any, setOpen: Function) {
  if (item == null) {
    if (!props.multi) {
      selected.value = null
      setOpen(false)
    } else {
      selected.value = []
    }
    modelValue.value = props.multi ? [] : null
    emit('validation:touch')
    return
  }
  if (!props.multi) {
    selected.value = item
    setOpen(false)
  } else {
    // Ensure selected is an array for multi-select
    const currentSelected = Array.isArray(selected.value) ? selected.value : []
    if (currentSelected.map((s: any) => s[props.pick]).includes(item[props.pick])) {
      selected.value = currentSelected.filter((selectedItem: any) => selectedItem[props.pick] !== item[props.pick])
    } else {
      selected.value = [...currentSelected, item]
    }
  }
  updateModelValue()
  emit('validation:touch')
}

watch([data, loading], reconcileSelection, { immediate: true })

onMounted(() => {
  watch(modelValue, () => {
    pickSelected()
  })
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
