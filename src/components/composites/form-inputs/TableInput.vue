<script setup lang="ts">
import { type PropType } from 'vue'
import type { FieldsInput, RowReorderPayload, TableProps } from '../../../contracts'
import { commonProps } from '../../inputs/commonprops'
import BaseInput from '../../inputs/BaseInput.vue'
import Table from '../../core/Table.vue'
import Button from '../../base/Button.vue'
import Icon from '../../base/Icon.vue'
import ConfirmationDialog from '../ConfirmationDialog.vue'
import DialogForm from '../DialogForm.vue'
import type {
  TableInputFormOptions,
  TableInputRow,
  TableInputTableOptions,
} from './tableInput.types'
import {
  appendTableInputRow,
  removeTableInputRow,
  reorderedTableInputRows,
  replaceTableInputRow,
} from './tableInput.model'

const props = defineProps({
  fields: {
    type: [Array, Object] as PropType<FieldsInput<TableInputRow, TableInputRow>>,
    required: true,
  },
  form: {
    type: Object as PropType<TableInputFormOptions<TableInputRow>>,
    default: () => ({}),
  },
  table: {
    type: Object as PropType<TableInputTableOptions<TableInputRow>>,
    default: () => ({}),
  },
  reorderable: {
    type: Boolean,
    default: false,
  },
  rowKey: {
    type: [String, Function] as PropType<TableProps<TableInputRow>['rowKey']>,
  },
  ...commonProps,
})

if (props.reorderable && !props.rowKey) {
  throw new Error('[loom] TableInput reorderable mode requires rowKey.')
}

const modelValue = defineModel<TableInputRow[]>({ default: () => [] })
const emit = defineEmits<{ (event: 'validation:touch'): void }>()

function cloneRow(row: TableInputRow): TableInputRow {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(row)
    } catch {
      // Vue exposes table records through reactive proxies, which structuredClone rejects.
    }
  }
  return JSON.parse(JSON.stringify(row)) as TableInputRow
}

function updateRows(rows: TableInputRow[]) {
  modelValue.value = [...rows]
  emit('validation:touch')
}

function createRow(row: TableInputRow) {
  updateRows(appendTableInputRow(modelValue.value, row))
  return row
}

function replaceRow(index: number, row: TableInputRow) {
  updateRows(replaceTableInputRow(modelValue.value, index, row))
  return row
}

function deleteRow(index: number) {
  updateRows(removeTableInputRow(modelValue.value, index))
}

function reorderRows(payload: RowReorderPayload<TableInputRow>) {
  updateRows(reorderedTableInputRows(payload))
}
</script>

<template>
  <BaseInput v-bind="props" :label="''">
    <div class="flex flex-col gap-4">
      <div class="flex flex-row justify-end">
        <DialogForm
          v-if="!disabled"
          v-bind="form"
          :fields="fields"
          :initial-data="{}"
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
        :fields="fields"
        :data="modelValue"
        :reorderable="reorderable && !disabled"
        :row-key="rowKey"
        @row-reorder="reorderRows"
      >
        <template v-if="!disabled" #row-actions="{ record, index }">
          <div class="flex items-center justify-end gap-1" aria-label="Row actions">
            <DialogForm
              v-bind="form"
              :fields="fields"
              :initial-data="cloneRow(record)"
              title="Ubah baris"
              cancel-label="Batal"
              :submit="(payload) => replaceRow(index, payload)"
            >
              <template #trigger>
                <Button type="button" kind="icon" variant="standard" aria-label="Edit row">
                  <template #icon>
                    <Icon name="edit" />
                  </template>
                </Button>
              </template>
            </DialogForm>
            <ConfirmationDialog :on-confirm="() => deleteRow(index)">
              <template #trigger>
                <Button type="button" kind="icon" color="error" variant="standard" aria-label="Delete row">
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
