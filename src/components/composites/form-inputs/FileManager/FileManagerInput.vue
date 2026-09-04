<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { ManagedAsset } from '../../../../file-manager/contracts'
import { useFileManager } from '../../../../file-manager/provider'
import { commonProps } from '../../../inputs/commonprops'
import BaseInput from '../../../inputs/BaseInput.vue'
import Dialog from '../../../base/Dialog.vue'
import Button from '../../../base/Button.vue'
import AssetPicker from '../../../../file-manager/AssetPicker.vue'

const props = defineProps({ ...commonProps, multi: Boolean })
const modelValue = defineModel<any>()
const emit = defineEmits<{ (event: 'validation:touch'): void }>()
const provider = useFileManager()
const selected = ref<ManagedAsset[]>([])
const error = ref<string>()

async function resolveModel(value: unknown) {
  error.value = undefined
  try {
    const values = props.multi && Array.isArray(value) ? value : value == null ? [] : [value]
    selected.value = (await Promise.all(values.map((item) => provider.values.fromModel(item)))).filter((item): item is ManagedAsset => Boolean(item))
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason)
  }
}
async function select(asset: ManagedAsset) {
  try {
    const value = await provider.values.toModel(asset)
    modelValue.value = props.multi ? [...(Array.isArray(modelValue.value) ? modelValue.value : []), value] : value
    await resolveModel(modelValue.value)
    emit('validation:touch')
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason)
  }
}
watch(modelValue, resolveModel, { immediate: true, deep: true })
const label = computed(() => selected.value.map((asset) => asset.name).join(', ') || 'Pilih berkas')
</script>

<template>
  <BaseInput v-bind="props">
    <Dialog>
      <template #trigger><Button type="button">{{ label }}</Button></template>
      <template #content="{ setOpen }"><AssetPicker @select="async (asset) => { await select(asset); setOpen(false) }" @cancel="setOpen(false)" /></template>
    </Dialog>
    <p v-if="error" role="alert" class="text-error">{{ error }}</p>
  </BaseInput>
</template>
