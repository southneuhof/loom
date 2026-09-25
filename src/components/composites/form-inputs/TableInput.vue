<script setup lang="ts" generic="TRow extends object = Record<string, unknown>, TInput extends object = TRow">
import { computed, onBeforeUpdate, useAttrs } from 'vue'
import type { FormDraft, RowReorderPayload } from '../../../contracts'
import BaseInput from '../../inputs/BaseInput.vue'
import Table from '../../core/Table.vue'
import Button from '../../base/Button.vue'
import Icon from '../../base/Icon.vue'
import ConfirmationDialog from '../ConfirmationDialog.vue'
import DialogForm from '../DialogForm.vue'
import type { TableInputCoreProps } from './tableInput.types'

const props = defineProps<TableInputCoreProps<TInput, TRow>>()

const attrs = useAttrs()
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
  rejectMembers(props.table, 'table', ['data', 'load'])
  rejectMembers(props.form, 'form', ['submit', 'load', 'modelValue'])

  if ((props.form === undefined) !== (props.toDraft === undefined)) {
    throw new Error('[loom][COMPOSITE_BINDING_CONFLICT] TableInput editor requires both form and toDraft.')
  }

  if (props.form === undefined && (props.reorderable || props.rowKey !== undefined)) {
    throw new Error('[loom][COMPOSITE_BINDING_CONFLICT] TableInput read-only mode cannot reorder rows.')
  }

  if (props.reorderable && !props.rowKey) {
    throw new Error('[loom] TableInput reorderable mode requires rowKey.')
  }
}

validateBindings()
onBeforeUpdate(validateBindings)

const modelValue = defineModel<TRow[]>({ required: true })
const emit = defineEmits<{ (event: 'validation:touch'): void }>()

const baseInputProps = computed(() => ({
  field: props.field,
  enableHelperMessage: props.enableHelperMessage,
  helperMessage: props.helperMessage,
  disabled: props.disabled,
  error: props.error,
  required: props.required,
}))

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
  updateRows(modelValue.value.map((current, currentIndex) => currentIndex === index ? row : current))
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
</script>

<template>
  <BaseInput v-bind="baseInputProps" :label="''">
    <div class="flex flex-col gap-4">
      <div class="flex flex-row justify-end">
        <DialogForm
          v-if="!disabled && form"
          v-bind="form"
          :disabled="disabled"
          title="Tambah baris"
          cancel-label="Batal"
          :submit="createRow"
        >
          <template #trigger>
            <slot v-if="$slots['create-button']" name="create-button" />
            <Button v-else type="button"><Icon name="add" />Tambah</Button>
          </template>
        </DialogForm>
      </div>

      <Table
        v-if="!$slots.table"
        v-bind="table"
        :data="modelValue"
        :reorderable="reorderable && !disabled"
        :row-key="rowKey"
        @row-reorder="reorderRows"
      >
        <template v-if="!disabled && form" #row-actions="{ record, index }">
          <div class="flex items-center justify-end gap-1" aria-label="Row actions">
            <DialogForm
              v-bind="form"
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
