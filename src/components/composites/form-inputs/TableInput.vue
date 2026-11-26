<script setup lang="ts" generic="TRow extends object = Record<string, unknown>, TInput extends object = TRow, TContext extends object = Readonly<Record<string, unknown>>">
import { computed, inject, nextTick, onBeforeUpdate, useAttrs, useId, ref, watch } from 'vue'
import type { RowReorderPayload } from '../../../contracts/components'
import type { FormDraft } from '../../../contracts/forms'
import BaseInput from '../../inputs/BaseInput.vue'
import Table from '../../core/Table.vue'
import Button from '../../base/Button.vue'
import Icon from '../../base/Icon.vue'
import ConfirmationDialog from '../ConfirmationDialog.vue'
import DialogForm from '../DialogForm.vue'
import { formArrayContextKey } from '../../../forms/arrayField'
import { useRendererRegistry } from '../../../renderers/registry'
import { useFrameworkUiDefaults } from '../../views/uiDefaults'
import type { InlineArrayDisplayField, InlineArrayField, TableInputCoreProps } from './tableInput.types'

const props = defineProps<TableInputCoreProps<TInput, TRow, TContext>>()

const standaloneId = useId()
const attrs = useAttrs()
const arrayForm = inject(formArrayContextKey, undefined)
const renderers = useRendererRegistry('form')
const uiDefaults = useFrameworkUiDefaults()
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
  updateRows([...payload.rows])
}

function draftFor(row: TRow): FormDraft<TInput> {
  const toDraft = props.toDraft
  if (!toDraft) throw new Error('[loom][COMPOSITE_BINDING_CONFLICT] TableInput edit requires toDraft.')
  return toDraft(row)
}
const read = Reflect.get

function inlineFields(row: TRow, index: number): Array<[string, InlineArrayField<TRow>]> {
  if (props.mode !== 'inline') return []
  const fields = typeof props.fields === 'function' ? props.fields(row, index) : props.fields
  const entries: Array<[string, InlineArrayField<TRow> | undefined]> = Object.entries(fields)
  return entries.filter((entry): entry is [string, InlineArrayField<TRow>] => entry[1] !== undefined && entry[1].visible !== false)
}

function isDisplayCell(cell: InlineArrayField<TRow>): cell is InlineArrayDisplayField<TRow> {
  return cell.kind === 'display'
}

function formatDisplayCell(row: TRow, index: number, key: string, cell: InlineArrayDisplayField<TRow>): string {
  const raw = cell.read ? cell.read(row, index) : read(row, key)
  if (cell.format) return cell.format(raw, row, index)
  if (raw === undefined || raw === null || raw === '') return '-'
  return String(raw)
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
  const field = modelValue.value[index] && inlineFields(modelValue.value[index], index).find(([, cell]) => !isDisplayCell(cell))?.[0]
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

function changeInlineRow(index: number, key: string, update: (row: TRow) => TRow): void {
  const rows = modelValue.value
  replaceInline(
    rows.map((row, position) => (position === index ? update(row) : row)),
    rows.map((_row, position) => position),
    [index, key]
  )
}

function changeCell(index: number, key: string, value: unknown): void {
  changeInlineRow(index, key, (row) => ({ ...row, [key]: value }))
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
            :value="isDisplayCell(cell) && cell.read ? cell.read(row, index) : read(row, key)"
            :touch="() => arrayForm?.touch(cellPath(index, key))"
            :set-error="(message: string | undefined) => arrayForm?.setError(cellPath(index, key), message)"
            :set-row="(value: TRow) => changeInlineRow(index, key, () => value)"
            :set-value="(value: unknown) => changeCell(index, key, value)"
            :error="cellError(index, key)"
            :disabled="locked"
            :id="cellId(index, key)"
          >
            <div v-if="isDisplayCell(cell)" class="flex flex-col gap-2">
              <span class="text-sm font-medium leading-5 text-on-surface">{{ cell.label }}</span>
              <output
                :id="cellId(index, key)"
                class="flex min-h-10 items-center rounded-md bg-surface-container-low px-3 text-sm font-medium tabular-nums text-on-surface"
                :class="{
                  'justify-end text-right': cell.align === 'end',
                  'justify-center text-center': cell.align === 'center',
                }"
              >
                {{ formatDisplayCell(row, index, key, cell) }}
              </output>
            </div>
            <component
              v-else
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
          <Button v-if="reorderable" type="button" kind="icon" variant="standard" ariaLabel="Move row up" :disabled="locked || index === 0" @click="moveInline(index, -1)">
            <template #icon><Icon name="arrow-up" size="base" /></template>
          </Button>
          <Button v-if="reorderable" type="button" kind="icon" variant="standard" ariaLabel="Move row down" :disabled="locked || index === modelValue.length - 1" @click="moveInline(index, 1)">
            <template #icon><Icon name="arrow-down" size="base" /></template>
          </Button>
          <Button type="button" kind="icon" variant="standard" color="error" ariaLabel="Delete row" :disabled="locked" @click="removeInline(index)">
            <template #icon><Icon name="delete-bin" size="base" /></template>
          </Button>
        </div>
      </article>
      <Button v-bind="{ id: addId }" type="button" variant="outlined" class="w-fit" :disabled="locked" @click="addInline">
        <template #icon><Icon name="add" size="base" /></template>
        {{ addLabel ?? uiDefaults.addRowLabel }}
      </Button>
    </div>
  </BaseInput>
  <BaseInput v-else-if="props.mode !== 'inline'" v-bind="baseInputProps" :label="''" v-slot="{ controlBindings }">
    <div class="flex flex-col gap-4">
      <div class="flex flex-row justify-end">
        <DialogForm v-if="!disabled && props.form" v-bind="props.form" :context="formContext" :disabled="disabled" :title="uiDefaults.addRowLabel" :cancel-label="uiDefaults.cancelLabel" :submit="createRow">
          <template #trigger>
            <slot v-if="$slots['create-button']" name="create-button" :control-bindings="controlBindings" />
            <Button v-else v-bind="controlBindings" type="button">
              <template #icon><Icon name="add" size="base" /></template>
              {{ uiDefaults.addLabel }}
            </Button>
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
              :title="uiDefaults.editRowLabel"
              :cancel-label="uiDefaults.cancelLabel"
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
