<script setup lang="ts">
import { computed, onMounted, ref, watch, type PropType } from 'vue'
import type {
  CollectionLoadContext,
  CollectionResult,
  FieldsInput,
  Load,
  QueryNamespace,
  RecordLoadContext,
  RecordResult,
} from '../../../contracts'
import { resolveFields } from '../../../fields'
import { commonProps } from '../../inputs/commonprops'
import Radio from '../../inputs/Radio.vue'
import BaseInput from '../../inputs/BaseInput.vue'
import Checkbox from '../../inputs/CheckboxInput.vue'
import SearchBox from '../../inputs/SearchBox.vue'
import ConfirmationDialog from '../ConfirmationDialog.vue'
import Dialog from '../../base/Dialog.vue'
import Button from '../../base/Button.vue'
import Chip from '../../base/Chip.vue'
import Icon from '../../base/Icon.vue'
import Table from '../../core/Table.vue'

type RecordData = Record<string, any>

const props = defineProps({
  ...commonProps,
  fields: { type: [Array, Object] as PropType<FieldsInput<RecordData>>, required: true },
  data: Array as PropType<RecordData[]>,
  load: Function as PropType<Load<CollectionLoadContext, CollectionResult<RecordData>>>,
  /** Optional scalar-model hydration used when no selected record is available locally. */
  loadDetail: Function as PropType<Load<RecordLoadContext, RecordResult<RecordData>>>,
  searchParameters: { type: Object as PropType<Record<string, unknown>>, default: () => ({}) },
  namespace: String as PropType<QueryNamespace>,
  view: String,
  multi: { type: Boolean, default: false },
  pick: { type: String, default: 'id' },
  transform: Object as PropType<Record<string, string>>,
  preview: String,
  placeholder: { type: String, default: 'Pilih' },
  static: { type: Boolean, default: false },
  onCommit: { type: Function as PropType<(data: RecordData[]) => unknown>, default: () => {} },
  formDataSetter: { type: Function as PropType<(newData: any) => void>, default: () => {} },
  hidePreviewTable: Boolean,
  formData: Object,
  onSelectData: Function as PropType<(formData: any, selectedData: RecordData[], setter: (data: any) => void) => void>,
})

const modelValue = defineModel<any>()
const emit = defineEmits<{ (event: 'validation:touch'): void }>()
const resolvedFields = computed(() => resolveFields({ fields: props.fields, surface: 'table' }))
const viewKey = computed(() => props.view ?? resolvedFields.value[0]?.key ?? props.pick)
const committed = ref<RecordData[]>([])
const staged = ref<RecordData[]>([])
const busy = ref(false)
const hydrationError = ref<string>()
const search = ref('')

function clone<T>(value: T): T {
  if (value == null) return value
  return JSON.parse(JSON.stringify(value))
}

function normalize(value: any): RecordData[] {
  if (value == null || value === '') return []
  if (props.multi) {
    return Array.isArray(value)
      ? value.every((item) => item && typeof item === 'object' && !Array.isArray(item)) ? value.map((item) => clone(item)) : []
      : []
  }
  return typeof value === 'object' ? [clone(value)] : [{ [props.pick]: value }]
}

function forModel(selection: RecordData[]) {
  let records = clone(selection)
  if (props.transform && !props.multi) {
    records = records.map((record) => {
      const next = { ...record }
      for (const [source, target] of Object.entries(props.transform!)) next[target] = next[source]
      return next
    })
  }
  if (props.multi) return records
  return records[0]?.[props.pick] ?? null
}

async function hydrate() {
  let fallback = normalize(modelValue.value)
  const incomingIsScalar = modelValue.value != null && typeof modelValue.value !== 'object'
  const current = committed.value[0]
  if (
    !props.multi
    && incomingIsScalar
    && fallback[0]
    && current?.[props.pick] === fallback[0][props.pick]
    && current[viewKey.value] != null
  ) {
    fallback = [clone(current)]
  }
  committed.value = fallback
  staged.value = clone(fallback)
  hydrationError.value = undefined

  const loadDetail = props.loadDetail
  if (props.multi) return
  if (!loadDetail || !fallback.some((record) => record[viewKey.value] == null && record[props.pick] != null && record[props.pick] !== '')) return
  try {
    const records = await Promise.all(fallback.map(async (record) => {
      if (record[viewKey.value] != null) return record
      const id = record[props.pick]
      if (id == null || id === '') return record
      const detail = await loadDetail({ id, searchParameters: props.searchParameters })
      return detail ? clone(detail) : record
    }))
    committed.value = records
    staged.value = clone(records)
  } catch (error) {
    hydrationError.value = error instanceof Error ? error.message : String(error)
  }
}

function toggle(record: RecordData) {
  if (!props.multi) {
    staged.value = staged.value[0]?.[props.pick] === record[props.pick] ? [] : [record]
    return
  }
  const index = staged.value.findIndex((item) => item[props.pick] === record[props.pick])
  if (index < 0) staged.value = [...staged.value, record]
  else staged.value = staged.value.filter((_, itemIndex) => itemIndex !== index)
}

async function commit() {
  const selection = clone(staged.value)
  busy.value = true
  try {
    await props.onCommit(selection)
    committed.value = clone(selection)
    modelValue.value = forModel(selection)
    props.onSelectData?.(props.formData, selection, props.formDataSetter)
    emit('validation:touch')
  } finally {
    busy.value = false
  }
}

function reset() {
  staged.value = clone(committed.value)
}

const selectedIds = computed(() => staged.value.map((item) => item[props.pick]))
const displayValue = computed(() => {
  if (props.preview) return props.preview
  const labels = committed.value.map((item) => item[viewKey.value]).filter(Boolean)
  if (!labels.length) return committed.value.length ? `${committed.value.length} Selected` : props.placeholder
  return props.multi && labels.length > 2 ? `${labels.slice(0, 2).join(', ')}, ${labels.length - 2} lainnya` : labels.join(', ')
})
const combinedSearchParameters = computed(() => ({
  ...props.searchParameters,
  ...(search.value ? { search: search.value } : {}),
}))

onMounted(hydrate)
watch(() => modelValue.value, hydrate, { deep: true })
</script>

<template>
  <BaseInput v-bind="props">
    <div class="flex flex-row items-center gap-2">
      <Dialog @close="reset">
        <template #trigger>
          <slot v-if="$slots.trigger" name="trigger" />
          <div v-else class="overlay flex max-w-fit cursor-pointer items-center justify-between gap-4 rounded-lg bg-surface-container-high px-4 py-2 after:bg-on-surface-hover focus-visible:after:bg-on-surface-active active:after:bg-on-surface-active">
            <p class="min-w-max">{{ displayValue }}</p>
            <Icon name="arrow-right-up" />
          </div>
        </template>
        <template #content="{ setOpen }">
          <div class="flex flex-col gap-4">
            <SearchBox v-model="search" class="w-full" />
            <p v-if="hydrationError" role="alert" class="text-sm text-error">{{ hydrationError }}</p>
            <div v-if="multi" class="flex flex-row flex-wrap items-center gap-2">
              <Chip v-for="(item, index) in staged" :key="String(item[pick])" class="flex items-center gap-2">
                <span>{{ item[viewKey] }}</span>
                <Icon size="xs" name="close" class="cursor-pointer" @click="staged.splice(index, 1)" />
              </Chip>
            </div>
            <Table
              :fields="fields"
              :data="data"
              :load="load"
              :namespace="namespace"
              :search-parameters="combinedSearchParameters"
              :page-size-options="[5, 10]"
              :default-page-size="5"
              pagination="always"
              @row-click="toggle"
            >
              <template #row-prefix="{ record }">
                <Checkbox v-if="multi" :on-toggle="() => toggle(record)" static :checked="selectedIds.includes(record[pick])" />
                <Radio v-else :checked="selectedIds[0] === record[pick]" @click="toggle(record)" />
              </template>
            </Table>
            <div class="flex flex-row items-center justify-end gap-2">
              <slot v-if="$slots.actionButton" name="actionButton" v-bind="{ searchParameters: combinedSearchParameters, selectedData: staged, setOpen, isLoading: busy }" />
              <Button :disabled="busy" @click="async () => { await commit(); setOpen(false) }">
                <Icon name="save" />Simpan
              </Button>
            </div>
          </div>
        </template>
      </Dialog>
    </div>
    <Table v-if="multi && committed.length && !hidePreviewTable" :data="committed" :fields="fields" :pagination="false">
      <template #row-actions="{ record }">
        <ConfirmationDialog :on-confirm="async () => { toggle(record); await commit() }">
          <template #trigger><Button variant="tonal" color="error"><Icon name="delete-bin" /></Button></template>
        </ConfirmationDialog>
      </template>
    </Table>
  </BaseInput>
</template>
