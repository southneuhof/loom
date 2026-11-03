<script setup lang="ts" generic="TRow extends object = Record<string, unknown>, TInput extends object = TRow, TContext extends object = Readonly<Record<string, unknown>>">
import { computed, inject, nextTick, onBeforeUpdate, useAttrs, useId, ref, watch } from 'vue'
import type { FormDraft, RowReorderPayload } from '../../../contracts'
import BaseInput from '../../inputs/BaseInput.vue'
import Table from '../../core/Table.vue'
import Button from '../../base/Button.vue'
import Icon from '../../base/Icon.vue'
import ConfirmationDialog from '../ConfirmationDialog.vue'
import DialogForm from '../DialogForm.vue'
import { formArrayContextKey } from '../../../forms/arrayField'
import { useRendererRegistry } from '../../../renderers/registry'
import type { InlineArrayField, TableInputCoreProps } from './tableInput.types'

const props = defineProps<TableInputCoreProps<TInput, TRow, TContext>>()

const standaloneId = useId()
const attrs = useAttrs()
const arrayForm = inject(formArrayContextKey, undefined)
const renderers = useRendererRegistry('form')
const inlineRootId = computed(() => (typeof attrs.id === 'string' ? attrs.id : props.field ? arrayForm?.id([props.field]) : undefined))
const locked = computed(() => props.disabled === true || arrayForm?.disabled.value === true)
for (const member of ['fields', 'data', 'load', 'submit']) {
  if (Object.hasOwn(attrs, member)) {
    throw new Error(`[loom][COMPOSITE_BINDING_CONFLICT] TableInput member "${member}" is owned by TableInput.`)
  }
}

function rejectMembers(value: object | undefined, owner: string, members: readonly string[]) {
  for (const member of members) {
    if (value && Object.hasOwn(value, member)) {
      throw new Error(`[loom][COMPOSITE_BINDING_CONFLICT] TableInput ${owner}.${member} is owned by TableInput.`)
    }
  }
}

function validateBindings() {
  if (props.mode === 'inline') return
  if (props.reorderable && !props.rowKey) throw new Error('[loom] TableInput reorderable mode requires rowKey.')
  rejectMembers(props.table, 'table', ['data', 'load'])
  rejectMembers(props.form, 'form', ['submit', 'load', 'modelValue'])

  if ((props.form === undefined) !== (props.toDraft === undefined)) {
    throw new Error('[loom][COMPOSITE_BINDING_CONFLICT] TableInput editor requires both form and toDraft.')
  }

  if (props.form === undefined && (props.reorderable || props.rowKey !== undefined)) {
    throw new Error('[loom][COMPOSITE_BINDING_CONFLICT] TableInput read-only mode cannot reorder rows.')
  }
}

validateBindings()
onBeforeUpdate(validateBindings)

const modelValue = defineModel<TRow[]>({ required: true })
let rowSequence = 0
const rowKeys = ref<string[]>([])
const newRowKey = () => `${standaloneId}-${++rowSequence}`
watch(
  () => modelValue.value.length,
  (length) => {
    rowKeys.value = Array.from({ length }, (_, index) => rowKeys.value[index] ?? newRowKey())
  },
  { immediate: true, flush: 'sync' }
)
const emit = defineEmits<{ (event: 'validation:touch'): void }>()

const baseInputProps = computed(() => ({
  field: props.field,
  helperMessage: props.helperMessage,
  disabled: props.disabled,
  error: props.mode === 'inline' && arrayForm && props.field ? arrayForm.issue([props.field]) : props.error,
  required: props.required,
}))
const tableContext = computed(() => (props.table && Object.hasOwn(props.table, 'context') ? props.table.context : props.context))
const formContext = computed(() => (props.form && Object.hasOwn(props.form, 'context') ? props.form.context : props.context))

function updateRows(rows: TRow[]) {
  if (props.disabled) return
  modelValue.value = rows
  emit('validation:touch')
}

function createRow(row: TRow) {
  updateRows([...modelValue.value, row])
  return row
}

function replaceRow(index: number, row: TRow) {
  updateRows(modelValue.value.map((current, currentIndex) => (currentIndex === index ? row : current)))
  return row
}

function deleteRow(index: number) {
  updateRows(modelValue.value.filter((_, currentIndex) => currentIndex !== index))
}

function reorderRows(payload: RowReorderPayload<TRow>) {
  if (props.disabled) return
  updateRows([...payload.rows])
}

function draftFor(row: TRow): FormDraft<TInput> {
  const toDraft = props.toDraft
  if (!toDraft) throw new Error('[loom][COMPOSITE_BINDING_CONFLICT] TableInput edit requires toDraft.')
  return toDraft(row)
}
const read = Reflect.get

function inlineFields(row: TRow, index: number): Array<[string, InlineArrayField]> {
  if (props.mode !== 'inline') return []
  const fields = typeof props.fields === 'function' ? props.fields(row, index) : props.fields
  const entries: Array<[string, InlineArrayField | undefined]> = Object.entries(fields)
  return entries.filter((entry): entry is [string, InlineArrayField] => entry[1] !== undefined && entry[1].visible !== false)
}

function cellPath(index: number, key: string): readonly (string | number)[] {
  return [props.field ?? '', index, key]
}

function cellId(index: number, key: string): string {
  return arrayForm?.id(cellPath(index, key)) ?? `${standaloneId}-${cellPath(index, key).join('.')}`
}

function cellError(index: number, key: string): string | undefined {
  return arrayForm?.issue(cellPath(index, key))
}

async function focusRow(index: number): Promise<void> {
  await nextTick()
  const field = modelValue.value[index] && inlineFields(modelValue.value[index], index)[0]?.[0]
  const element = field ? document.getElementById(cellId(index, field)) : document.getElementById(addId.value)
  const control = element?.matches('input,textarea,button,[role="combobox"]') ? element : element?.querySelector<HTMLElement>('input,textarea,button,[role="combobox"]')
  ;(control ?? element)?.focus()
}

function replaceInline(rows: TRow[], indices: readonly (number | null)[], changed?: readonly [number, string]): void {
  if (locked.value) return
  rowKeys.value = indices.map((index) => (index === null ? newRowKey() : (rowKeys.value[index] ?? newRowKey())))
  if (props.field) arrayForm?.update(props.field, rows, indices, changed)
  modelValue.value = rows
}

function changeInlineRow(index: number, key: string, value: TRow): void {
  replaceInline(
    modelValue.value.map((row, position) => (position === index ? value : row)),
    modelValue.value.map((_row, position) => position),
    [index, key]
  )
}

function changeCell(index: number, key: string, value: unknown): void {
  const next = modelValue.value.map((row, position) => (position === index ? { ...row, [key]: value } : row))
  replaceInline(
    next,
    next.map((_row, position) => position),
    [index, key]
  )
}

const addId = computed(() => `${arrayForm?.id([props.field ?? '']) ?? standaloneId}-add`)

function addInline(): void {
  if (props.mode !== 'inline' || locked.value) return
  const index = modelValue.value.length
  replaceInline([...modelValue.value, props.createRow()], [...modelValue.value.map((_row, index) => index), null])
  void focusRow(index)
}

function removeInline(index: number): void {
  if (locked.value) return
  const indices = modelValue.value.map((_row, position) => position).filter((position) => position !== index)
  replaceInline(
    indices.map((position) => modelValue.value[position]!),
    indices
  )
  void focusRow(Math.min(index, indices.length - 1))
}

function moveInline(index: number, direction: -1 | 1): void {
  if (locked.value) return
  const target = index + direction
  if (target < 0 || target >= modelValue.value.length) return
  const indices = modelValue.value.map((_row, position) => position)
  indices.splice(target, 0, indices.splice(index, 1)[0]!)
  replaceInline(
    indices.map((position) => modelValue.value[position]!),
    indices
  )
  void focusRow(target)
}
</script>

<template>
  <BaseInput v-if="mode === 'inline'" :id="inlineRootId" v-bind="baseInputProps" :label="''" :disabled="locked" v-slot="{ controlBindings }">
    <div v-bind="controlBindings" role="group" :aria-label="label ?? field" :aria-disabled="locked ? 'true' : undefined" tabindex="-1" class="flex flex-col gap-3" @focus.self="focusRow(0)">
      <article
        v-for="(row, index) in modelValue"
        :key="rowKey ? (typeof rowKey === 'function' ? rowKey(row) : String(read(row, rowKey))) : rowKeys[index]"
        :aria-label="`${label ?? field ?? 'Row'} ${index + 1}`"
        role="group"
        class="grid grid-cols-12 items-start gap-3 rounded-lg border border-outline-variant p-3"
      >
        <div
          v-for="[key, cell] in inlineFields(row, index)"
          :key="key"
          class="col-span-12 min-w-0 md:col-span-4"
          :style="cell.span ? { gridColumn: `span ${cell.span} / span ${cell.span}` } : undefined"
        >
          <slot
            :name="`cell:${key}`"
            :row="row"
            :index="index"
            :value="read(row, key)"
            :touch="() => arrayForm?.touch(cellPath(index, key))"
            :set-error="(message: string | undefined) => arrayForm?.setError(cellPath(index, key), message)"
            :set-row="(value: TRow) => changeInlineRow(index, key, value)"
            :set-value="(value: unknown) => changeCell(index, key, value)"
            :error="cellError(index, key)"
            :disabled="locked"
            :id="cellId(index, key)"
          >
            <component
              :is="typeof cell.renderer === 'string' ? renderers.require(cell.renderer) : cell.renderer"
              v-bind="cell.props"
              :id="cellId(index, key)"
              :label="cell.label"
              :required="cell.required"
              :disabled="locked || cell.props?.disabled === true"
              :model-value="read(row, key)"
              :error="cellError(index, key)"
              @update:model-value="changeCell(index, key, $event)"
              @validation:touch="arrayForm?.touch(cellPath(index, key))"
              @validation:error="arrayForm?.setError(cellPath(index, key), $event)"
            />
          </slot>
        </div>
        <div class="col-span-12 flex justify-end gap-1">
          <Button v-if="reorderable" type="button" kind="icon" variant="standard" ariaLabel="Move row up" :disabled="locked || index === 0" @click="moveInline(index, -1)"
            ><Icon name="arrow-up"
          /></Button>
          <Button v-if="reorderable" type="button" kind="icon" variant="standard" ariaLabel="Move row down" :disabled="locked || index === modelValue.length - 1" @click="moveInline(index, 1)"
            ><Icon name="arrow-down"
          /></Button>
          <Button type="button" kind="icon" variant="standard" ariaLabel="Delete row" :disabled="locked" @click="removeInline(index)"><Icon name="delete-bin" /></Button>
        </div>
      </article>
      <Button v-bind="{ id: addId }" type="button" variant="outlined" :disabled="locked" @click="addInline"><Icon name="add" />{{ addLabel ?? 'Tambah baris' }}</Button>
    </div>
  </BaseInput>
  <BaseInput v-else-if="props.mode !== 'inline'" v-bind="baseInputProps" :label="''" v-slot="{ controlBindings }">
    <div class="flex flex-col gap-4">
      <div class="flex flex-row justify-end">
        <DialogForm v-if="!disabled && props.form" v-bind="props.form" :context="formContext" :disabled="disabled" title="Tambah baris" cancel-label="Batal" :submit="createRow">
          <template #trigger>
            <slot v-if="$slots['create-button']" name="create-button" :control-bindings="controlBindings" />
            <Button v-else v-bind="controlBindings" type="button"><Icon name="add" />Tambah</Button>
          </template>
        </DialogForm>
      </div>

      <Table v-if="!$slots.table" v-bind="props.table" :context="tableContext" :data="modelValue" :reorderable="reorderable && !disabled" :row-key="rowKey" @row-reorder="reorderRows">
        <template v-if="!disabled && props.form" #row-actions="{ record, index }">
          <div class="flex items-center justify-end gap-1" aria-label="Row actions">
            <DialogForm
              v-bind="props.form"
              :context="formContext"
              :disabled="disabled"
              :initial-data="draftFor(record)"
              title="Ubah baris"
              cancel-label="Batal"
              :submit="(payload) => replaceRow(index, payload)"
            >
              <template #trigger>
                <Button type="button" kind="icon" variant="standard" ariaLabel="Edit row">
                  <template #icon>
                    <Icon name="edit" />
                  </template>
                </Button>
              </template>
            </DialogForm>
            <ConfirmationDialog :on-confirm="() => deleteRow(index)">
              <template #trigger>
                <Button type="button" kind="icon" color="error" variant="standard" ariaLabel="Delete row">
                  <template #icon>
                    <Icon name="delete-bin" />
                  </template>
                </Button>
              </template>
            </ConfirmationDialog>
          </div>
        </template>
      </Table>
      <slot v-else name="table" :data="modelValue" />
    </div>
  </BaseInput>
</template>
