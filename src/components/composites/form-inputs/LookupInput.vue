<script setup lang="ts" generic="TRecord extends object = Record<string, unknown>">
import { computed, getCurrentInstance, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import type { CollectionMeta, QueryValues } from '../../../contracts'
import { stableValue } from '../../../query/keys'
import type { LookupInputProps, LookupModelValue } from './lookupInput.types'
import BaseInput from '../../inputs/BaseInput.vue'
import Button from '../../base/Button.vue'
import Chip from '../../base/Chip.vue'
import ConfirmationDialog from '../ConfirmationDialog.vue'
import Dialog from '../../base/Dialog.vue'
import Icon from '../../base/Icon.vue'
import Radio from '../../inputs/Radio.vue'
import Checkbox from '../../inputs/CheckboxInput.vue'
import SearchBox from '../../inputs/SearchBox.vue'
import Table from '../../core/Table.vue'

const props = withDefaults(defineProps<LookupInputProps<TRecord>>(), {
  field: '',
  label: '',
  enableHelperMessage: false,
  helperMessage: '',
  error: '',
  disabled: false,
  required: false,
  searchParameters: () => ({}),
  multi: false,
  pick: 'id',
  placeholder: 'Pilih',
})

const attrs = getCurrentInstance()?.attrs ?? {}
for (const member of ['fields', 'transform', 'formDataSetter', 'formData', 'onSelectData', 'static']) {
  if (Object.hasOwn(attrs, member)) {
    throw new Error(`[loom][COMPOSITE_BINDING_CONFLICT] LookupInput member "${member}" is no longer supported.`)
  }
}

for (const member of ['data', 'load']) {
  if (Object.hasOwn(props.table, member)) {
    throw new Error(`[loom][COMPOSITE_BINDING_CONFLICT] LookupInput table.${member} is owned by LookupInput.`)
  }
}

const modelValue = defineModel<LookupModelValue<TRecord>>()
const emit = defineEmits<{ (event: 'validation:touch'): void }>()
const committed = shallowRef<TRecord[]>([])
const staged = shallowRef<TRecord[]>([])
const committedIdentity = ref<unknown>()
const stagedIdentity = ref<unknown>()
const loadedRows = shallowRef<TRecord[]>([])
const loadedMeta = ref<CollectionMeta>()
const loadPending = ref(false)
const loadError = ref<string>()
const hydrationError = ref<string>()
const search = ref('')
const dialogOpen = ref(false)
const query = ref<QueryValues>({ page: 1, limit: 5 })
let loadController: AbortController | undefined
let loadGeneration = 0
let detailController: AbortController | undefined
let detailGeneration = 0
let stagingGeneration = 0
let skipNextQueryLoad = false

type SourceMode = 'data' | 'load'
type SelectionContext = {
  mode: SourceMode
  load: LookupInputProps<TRecord>['load']
  namespace: LookupInputProps<TRecord>['namespace']
  searchParameters: unknown
  loadDetail: LookupInputProps<TRecord>['loadDetail']
  pick: string
  multi: boolean
  dataIdentities: readonly unknown[]
}

function sourceMode(): SourceMode {
  const hasData = props.data !== undefined
  const hasLoad = typeof props.load === 'function'
  if (hasData === hasLoad) {
    throw new Error('[loom][SURFACE_DATA_SOURCE_INVALID] LookupInput requires exactly one of "data" or "load".')
  }
  if (hasData && !Array.isArray(props.data)) {
    throw new Error('[loom][SURFACE_DATA_SOURCE_INVALID] LookupInput "data" must be an array.')
  }
  return hasData ? 'data' : 'load'
}

function readContext(): SelectionContext {
  const mode = sourceMode()
  return {
    mode,
    load: props.load,
    namespace: props.namespace,
    searchParameters: stableValue(props.searchParameters),
    loadDetail: props.loadDetail,
    pick: props.pick,
    multi: props.multi,
    dataIdentities: mode === 'data' ? (props.data ?? []).map((record) => read(record, props.pick)) : [],
  }
}

function sameContext(left: SelectionContext, right: SelectionContext): boolean {
  if (left.mode !== right.mode || left.pick !== right.pick || left.multi !== right.multi) return false
  if (left.mode === 'data' && right.mode === 'data') {
    return left.dataIdentities.length === right.dataIdentities.length
      && left.dataIdentities.every((identity, index) => Object.is(identity, right.dataIdentities[index]))
  }
  if (left.mode !== 'load' || right.mode !== 'load') return true
  return left.load === right.load
    && left.namespace === right.namespace
    && left.loadDetail === right.loadDetail
    && JSON.stringify(left.searchParameters) === JSON.stringify(right.searchParameters)
}

function modelIdentities(value: unknown, context: SelectionContext): readonly unknown[] {
  if (context.multi) {
    return Array.isArray(value) ? value.map((item) => isSelectionRecord(item) ? read(item, context.pick) : item) : []
  }
  if (isSelectionRecord(value)) return [read(value, context.pick)]
  if (typeof value === 'string' || typeof value === 'number') return value === '' ? [] : [value]
  return []
}

function sameModelIdentities(left: readonly unknown[], right: readonly unknown[]): boolean {
  return left.length === right.length && left.every((identity, index) => Object.is(identity, right[index]))
}

let previousContext = readContext()
let initialSelectionState = true

watch([() => props.data, () => props.load], sourceMode)

function copyRecord(record: TRecord): TRecord {
  return { ...record }
}

function copySelection(selection: readonly TRecord[]): TRecord[] {
  return selection.map(copyRecord)
}

function isSelectionRecord(value: unknown): value is TRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function read(record: object, key: string): unknown {
  return Reflect.get(record, key)
}

function pickValue(record: TRecord): unknown {
  return read(record, props.pick)
}

function viewValue(record: TRecord): unknown {
  return read(record, viewKey.value)
}

function forModel(selection: readonly TRecord[], identity?: unknown): LookupModelValue<TRecord> {
  if (props.multi) return copySelection(selection)
  const value = selection.length ? pickValue(selection[0]!) : identity
  return typeof value === 'string' || typeof value === 'number' ? value : null
}

const viewKey = computed(() => props.view ?? Object.keys(props.table.columns)[0] ?? props.pick)
const combinedSearchParameters = computed(() => ({
  ...props.searchParameters,
  ...(search.value ? { search: search.value } : {}),
}))
const rows = computed<TRecord[]>(() => sourceMode() === 'data' ? [...(props.data ?? [])] : loadedRows.value)
const baseInputProps = computed(() => ({
  field: props.field,
  label: props.label,
  enableHelperMessage: props.enableHelperMessage,
  helperMessage: props.helperMessage,
  disabled: props.disabled,
  error: props.error,
  required: props.required,
}))

async function loadOptions() {
  const load = props.load
  if (sourceMode() !== 'load' || !load) return
  loadController?.abort()
  const controller = new AbortController()
  loadController = controller
  const generation = ++loadGeneration
  loadPending.value = true
  loadError.value = undefined
  try {
    const result = await load({ query: { ...query.value }, searchParameters: { ...combinedSearchParameters.value }, signal: controller.signal })
    if (generation !== loadGeneration || controller.signal.aborted) return
    loadedRows.value = [...result.data]
    loadedMeta.value = result.meta
  } catch (reason) {
    if (!controller.signal.aborted && generation === loadGeneration) {
      loadError.value = reason instanceof Error ? reason.message : String(reason)
    }
  } finally {
    if (generation === loadGeneration) loadPending.value = false
  }
}

watch(query, () => {
  if (skipNextQueryLoad) {
    skipNextQueryLoad = false
    return
  }
  void loadOptions()
}, { deep: true, immediate: true })

const loadContext = computed(() => ({
  mode: sourceMode(),
  load: props.load,
  namespace: props.namespace,
  searchParameters: combinedSearchParameters.value,
}))

watch(loadContext, (next, previous) => {
  if (next.mode !== 'load') {
    loadGeneration += 1
    loadController?.abort()
    loadedRows.value = []
    loadedMeta.value = undefined
    loadPending.value = false
    loadError.value = undefined
    return
  }
  const searchChanged = JSON.stringify(stableValue(previous.searchParameters)) !== JSON.stringify(stableValue(next.searchParameters))
  if (searchChanged && query.value.page !== 1) {
    skipNextQueryLoad = true
    query.value = { ...query.value, page: 1 }
  }
  void loadOptions()
}, { deep: true })

function updateQuery(values: QueryValues) {
  query.value = { ...values }
}

function selectionIdentity(records: readonly TRecord[], identity: unknown): unknown {
  return records.length ? pickValue(records[0]!) : identity
}

function sameSelection(left: readonly TRecord[], leftIdentity: unknown, right: readonly TRecord[], rightIdentity: unknown): boolean {
  if (props.multi) {
    const leftValues = left.map(pickValue)
    const rightValues = right.map(pickValue)
    return leftValues.length === rightValues.length && leftValues.every((value, index) => Object.is(value, rightValues[index]))
  }
  return Object.is(selectionIdentity(left, leftIdentity), selectionIdentity(right, rightIdentity))
}

function modelShape(value: unknown): 'empty' | 'scalar' | 'record' | 'array' {
  if (value == null || value === '') return 'empty'
  if (Array.isArray(value)) return 'array'
  if (isSelectionRecord(value)) return 'record'
  return 'scalar'
}

type ModelSnapshot = { shape: ReturnType<typeof modelShape>; identities: readonly unknown[] }

function snapshotModel(value: unknown, context: SelectionContext): ModelSnapshot {
  return { shape: modelShape(value), identities: modelIdentities(value, context) }
}

function sameModel(left: ModelSnapshot, right: ModelSnapshot): boolean {
  return left.shape === right.shape && sameModelIdentities(left.identities, right.identities)
}

let previousModel = snapshotModel(modelValue.value, previousContext)

function setModelValue(value: LookupModelValue<TRecord>, context = readContext()): void {
  if (sameModel(snapshotModel(modelValue.value, context), snapshotModel(value, context))) return
  modelValue.value = value
  previousModel = snapshotModel(value, context)
}

function invalidateDetailLoad(): void {
  detailGeneration += 1
  detailController?.abort()
  detailController = undefined
}

function clearSelection(): void {
  invalidateDetailLoad()
  stagingGeneration += 1
  committed.value = []
  staged.value = []
  committedIdentity.value = undefined
  stagedIdentity.value = undefined
  setModelValue(props.multi ? [] : null)
}

function scalarIdentity(value: unknown): string | number | undefined {
  if (typeof value === 'string' || typeof value === 'number') return value === '' ? undefined : value
  if (isSelectionRecord(value)) {
    const identity = read(value, props.pick)
    return typeof identity === 'string' || typeof identity === 'number' ? identity : undefined
  }
  return undefined
}

function staticRecord(identity: unknown): TRecord | undefined {
  return (props.data ?? []).find((record) => Object.is(pickValue(record), identity))
}

function hasSelection(value: unknown): boolean {
  if (value == null || value === '') return false
  return !Array.isArray(value) || value.length > 0
}

function reconcileStaticSelection(value: unknown): void {
  if (props.multi) {
    if (!Array.isArray(value)) {
      if (hasSelection(value)) clearSelection()
      return
    }
    const surviving = value.filter((item): item is TRecord => isSelectionRecord(item)
      && staticRecord(read(item, props.pick)) !== undefined)
    if (surviving.length !== value.length) {
      committed.value = copySelection(surviving)
      staged.value = copySelection(surviving)
      committedIdentity.value = undefined
      stagedIdentity.value = undefined
      stagingGeneration += 1
      setModelValue(copySelection(surviving))
    }
    return
  }
  if (!hasSelection(value)) return
  const identity = scalarIdentity(value)
  if (identity === undefined || !staticRecord(identity)) clearSelection()
}

function currentScalarModelIdentity(value: unknown): string | number | undefined {
  return scalarIdentity(value) ?? committedIdentity.value as string | number | undefined
}

async function hydrate(value: unknown, replaceSelection = true): Promise<void> {
  invalidateDetailLoad()
  const generation = detailGeneration
  let records: TRecord[] = []
  let identity: unknown
  if (props.multi) {
    if (Array.isArray(value)) records = value.filter(isSelectionRecord).map(copyRecord)
  } else if (typeof value === 'string' || typeof value === 'number') {
    if (value !== '') identity = value
  } else if (isSelectionRecord(value)) {
    records = [copyRecord(value)]
  }

  if (!replaceSelection && !props.multi && identity === undefined) identity = committedIdentity.value

  if (replaceSelection) {
    const current = committed.value[0]
    if (!props.multi && identity !== undefined && current && pickValue(current) === identity && viewValue(current) != null) {
      records = [copyRecord(current)]
      identity = undefined
    }

    committed.value = records
    staged.value = copySelection(records)
    committedIdentity.value = identity
    stagedIdentity.value = identity
    stagingGeneration += 1
  }
  hydrationError.value = undefined

  const current = committed.value[0]
  if (!props.multi && identity !== undefined && current && pickValue(current) === identity && viewValue(current) != null) return

  const loadDetail = props.loadDetail
  if (props.multi || !loadDetail || (typeof identity !== 'string' && typeof identity !== 'number') || identity === '') return

  const controller = new AbortController()
  detailController = controller
  const stagingAtStart = stagingGeneration
  const stageFollowsCommitted = sameSelection(staged.value, stagedIdentity.value, committed.value, committedIdentity.value)
  try {
    const detail = await loadDetail({ id: identity, searchParameters: { ...props.searchParameters }, signal: controller.signal })
    if (generation !== detailGeneration || controller.signal.aborted || !detail) return
    const record = copyRecord(detail)
    if (!Object.is(pickValue(record), identity) || !Object.is(committedIdentity.value, identity)) return
    committed.value = [record]
    committedIdentity.value = undefined
    if (stageFollowsCommitted && stagingGeneration === stagingAtStart) {
      staged.value = [copyRecord(record)]
      stagedIdentity.value = undefined
    }
  } catch (reason) {
    if (!controller.signal.aborted && generation === detailGeneration) {
      hydrationError.value = reason instanceof Error ? reason.message : String(reason)
    }
  }
}

async function validateRemoteSelection(identity: string | number, context: SelectionContext): Promise<void> {
  const loadDetail = props.loadDetail
  if (!loadDetail) return
  invalidateDetailLoad()
  const generation = detailGeneration
  const controller = new AbortController()
  detailController = controller
  const modelAtStart = snapshotModel(modelValue.value, context)
  const stagingAtStart = stagingGeneration
  const stageFollowsCommitted = sameSelection(staged.value, stagedIdentity.value, committed.value, committedIdentity.value)
  hydrationError.value = undefined
  try {
    const detail = await loadDetail({ id: identity, searchParameters: { ...props.searchParameters }, signal: controller.signal })
    if (generation !== detailGeneration || controller.signal.aborted || !sameContext(context, readContext())) return
    if (!sameModel(modelAtStart, snapshotModel(modelValue.value, context))) return
    if (!detail || !Object.is(read(detail, context.pick), identity)) {
      committed.value = []
      committedIdentity.value = undefined
      if (stagingAtStart === stagingGeneration && stageFollowsCommitted) {
        staged.value = []
        stagedIdentity.value = undefined
        stagingGeneration += 1
      }
      setModelValue(props.multi ? [] : null, context)
      return
    }
    const record = copyRecord(detail)
    committed.value = [record]
    committedIdentity.value = undefined
    if (stageFollowsCommitted && stagingGeneration === stagingAtStart) {
      staged.value = [copyRecord(record)]
      stagedIdentity.value = undefined
    }
  } catch (reason) {
    if (!controller.signal.aborted && generation === detailGeneration && sameContext(context, readContext())) {
      hydrationError.value = reason instanceof Error ? reason.message : String(reason)
    }
  }
}

function applyContextChange(context: SelectionContext, modelChanged: boolean): void {
  invalidateDetailLoad()
  hydrationError.value = undefined
  if (context.mode === 'data') {
    reconcileStaticSelection(modelValue.value)
    void hydrate(modelValue.value)
    return
  }
  if (modelChanged) {
    void hydrate(modelValue.value)
    return
  }
  if (!hasSelection(modelValue.value)) return
  if (props.multi) {
    clearSelection()
    return
  }
  const identity = currentScalarModelIdentity(modelValue.value)
  if (identity !== undefined && props.loadDetail) {
    void validateRemoteSelection(identity, context)
  } else {
    clearSelection()
  }
}

watch(() => ({ context: readContext(), model: modelValue.value }), ({ context, model }) => {
  const modelChanged = !sameModel(previousModel, snapshotModel(model, previousContext))
  const contextChanged = !sameContext(previousContext, context)
  const isInitial = initialSelectionState
  initialSelectionState = false
  previousContext = context
  previousModel = snapshotModel(model, context)
  if (isInitial) {
    if (context.mode === 'data') reconcileStaticSelection(model)
    void hydrate(modelValue.value)
  } else if (contextChanged) {
    applyContextChange(context, modelChanged)
  } else if (modelChanged) {
    invalidateDetailLoad()
    void hydrate(model)
  }
}, { immediate: true, deep: true, flush: 'pre' })

let closedDuringHydration = false
watch(dialogOpen, (open) => {
  if (!open) {
    closedDuringHydration = true
    invalidateDetailLoad()
    stagingGeneration += 1
    staged.value = copySelection(committed.value)
    stagedIdentity.value = committedIdentity.value
    return
  }
  if (closedDuringHydration) {
    closedDuringHydration = false
    void hydrate(modelValue.value, false)
  }
})

onBeforeUnmount(() => {
  loadGeneration += 1
  invalidateDetailLoad()
  loadController?.abort()
})

function toggle(record: TRecord) {
  if (props.disabled) return
  const id = pickValue(record)
  if (!props.multi) {
    const selectedId = staged.value.length ? pickValue(staged.value[0]!) : stagedIdentity.value
    if (selectedId === id) {
      staged.value = []
      stagedIdentity.value = undefined
    } else {
      staged.value = [record]
      stagedIdentity.value = undefined
    }
    stagingGeneration += 1
    return
  }
  const index = staged.value.findIndex((item) => pickValue(item) === id)
  staged.value = index < 0
    ? [...staged.value, record]
    : staged.value.filter((_, itemIndex) => itemIndex !== index)
  stagingGeneration += 1
}

function commit() {
  if (props.disabled) return
  invalidateDetailLoad()
  stagingGeneration += 1
  const selection = copySelection(staged.value)
  committed.value = copySelection(selection)
  committedIdentity.value = stagedIdentity.value
  setModelValue(forModel(selection, stagedIdentity.value))
  emit('validation:touch')
}

function remove(record: TRecord) {
  if (props.disabled) return
  staged.value = committed.value.filter((item) => pickValue(item) !== pickValue(record))
  stagedIdentity.value = undefined
  return commit()
}

function removeStaged(index: number) {
  if (props.disabled) return
  staged.value = staged.value.filter((_, itemIndex) => itemIndex !== index)
  stagingGeneration += 1
}

const selectedIds = computed(() => [
  ...staged.value.map(pickValue),
  ...(stagedIdentity.value === undefined ? [] : [stagedIdentity.value]),
])
const displayValue = computed(() => {
  const labels = committed.value
    .map(viewValue)
    .filter((value) => value !== undefined && value !== null && value !== '')
    .map(String)
  if (!labels.length) {
    const selectedCount = committed.value.length || (committedIdentity.value === undefined ? 0 : 1)
    return selectedCount ? `${selectedCount} Selected` : props.placeholder
  }
  return props.multi && labels.length > 2 ? `${labels.slice(0, 2).join(', ')}, ${labels.length - 2} lainnya` : labels.join(', ')
})
</script>

<template>
  <BaseInput v-bind="baseInputProps">
    <div class="flex flex-row items-center gap-2">
      <Dialog v-model="dialogOpen" :disabled="disabled">
        <template #trigger>
          <slot v-if="$slots.trigger" name="trigger" />
          <div v-else class="overlay flex max-w-fit cursor-pointer items-center justify-between gap-4 rounded-lg bg-surface-container-high px-4 py-2 after:bg-on-surface-hover focus-visible:after:bg-on-surface-active active:after:bg-on-surface-active">
            <p class="min-w-max">{{ displayValue }}</p>
            <Icon name="arrow-right-up" />
          </div>
        </template>
        <template #title>Pilih data</template>
        <template #description>Pilih data dari daftar untuk mengisi nilai ini.</template>
        <template #content="{ setOpen }">
          <div class="flex flex-col gap-4">
            <SearchBox v-model="search" class="w-full" />
            <p v-if="hydrationError" role="alert" class="text-sm text-error">{{ hydrationError }}</p>
            <p v-if="loadPending" role="status" class="text-sm text-muted">Memuat data...</p>
            <div v-else-if="loadError" class="flex items-center gap-2 text-sm text-error">
              <p role="alert">{{ loadError }}</p>
              <Button type="button" variant="text" @click="loadOptions">Coba lagi</Button>
            </div>
            <div v-if="multi" class="flex flex-row flex-wrap items-center gap-2">
              <Chip v-for="(item, index) in staged" :key="String(pickValue(item))" class="flex items-center gap-2">
                <span>{{ viewValue(item) }}</span>
                <Icon size="xs" name="close" class="cursor-pointer" @click="removeStaged(index)" />
              </Chip>
            </div>
            <Table
              v-if="!loadPending && !loadError"
              v-bind="table"
              :data="rows"
              :meta="props.data ? undefined : loadedMeta"
              :query="query"
              :namespace="namespace"
              :search-parameters="combinedSearchParameters"
              :page-size-options="[5, 10]"
              :default-page-size="5"
              pagination="always"
              @update:query="updateQuery"
              @row-click="toggle"
            >
              <template #row-prefix="{ record }">
                <Checkbox v-if="multi" :on-toggle="() => toggle(record)" static :checked="selectedIds.includes(pickValue(record))" />
                <Radio v-else :checked="selectedIds[0] === pickValue(record)" @click="toggle(record)" />
              </template>
            </Table>
            <div class="flex flex-row items-center justify-end gap-2">
              <Button :disabled="loadPending" @click="() => { commit(); setOpen(false) }">
                <Icon name="save" />Simpan
              </Button>
            </div>
          </div>
        </template>
      </Dialog>
    </div>
    <Table v-if="multi && committed.length" v-bind="table" :data="committed" :pagination="false">
      <template v-if="!disabled" #row-actions="{ record }">
        <ConfirmationDialog :on-confirm="() => remove(record)">
          <template #trigger><Button variant="tonal" color="error" ariaLabel="Remove selected record"><Icon name="delete-bin" /></Button></template>
        </ConfirmationDialog>
      </template>
    </Table>
  </BaseInput>
</template>
