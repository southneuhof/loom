<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { ManagedAsset } from '../../../../file-manager/contracts'
import type { AssetValue } from '../../../../assets/contracts'
import { useFileManager } from '../../../../file-manager/provider'
import { commonProps } from '../../../inputs/commonprops'
import { useAssetAdapter } from '../../../../assets/provider'
import BaseInput from '../../../inputs/BaseInput.vue'
import Dialog from '../../../base/Dialog.vue'
import Button from '../../../base/Button.vue'
import AssetPicker from '../../../../file-manager/AssetPicker.vue'

const props = defineProps({ ...commonProps, multi: Boolean })
const modelValue = defineModel<AssetValue | AssetValue[] | null>()
const emit = defineEmits<{
  (event: 'validation:touch'): void
  (event: 'validation:error', message: string | undefined): void
}>()
const provider = useFileManager()
const assets = useAssetAdapter()
const selected = ref<ManagedAsset[]>([])
const error = ref<string>()
let disposed = false
let modelGeneration = 0
let selectionGeneration = 0
let resolutionGeneration = 0

onBeforeUnmount(() => {
  disposed = true
})

async function resolveModel(value: unknown) {
  const resolution = ++resolutionGeneration
  const target = modelGeneration
  error.value = undefined
  try {
    const values = value === null || value === undefined
      ? []
      : props.multi && Array.isArray(value)
        ? value
        : !props.multi && !Array.isArray(value)
          ? [value]
          : null
    if (values === null) throw new Error('Invalid asset value.')
    const canonical = values.map((item) => assets.read(item))
    if (canonical.some((item) => item === null)) throw new Error('Invalid asset value.')
    const valid = canonical.filter((item): item is AssetValue => item !== null)
    const resolved = (await Promise.all(valid.map((item) => provider.values.fromModel(item)))).filter((item): item is ManagedAsset => Boolean(item))
    if (disposed || resolution !== resolutionGeneration || target !== modelGeneration) return
    selected.value = resolved
    emit('validation:error', undefined)
  } catch (reason) {
    if (disposed || resolution !== resolutionGeneration || target !== modelGeneration) return
    error.value = reason instanceof Error ? reason.message : String(reason)
    emit('validation:error', error.value)
  }
}
async function select(asset: ManagedAsset) {
  if (props.disabled || disposed) return
  const selection = ++selectionGeneration
  const target = modelGeneration
  try {
    const value = await provider.values.toModel(asset)
    if (props.disabled || disposed || selection !== selectionGeneration || target !== modelGeneration) return
    const canonical = assets.read(value)
    if (!canonical) throw new Error('Invalid asset value.')
    modelValue.value = props.multi ? [...(Array.isArray(modelValue.value) ? modelValue.value : []), canonical] : canonical
    emit('validation:touch')
  } catch (reason) {
    if (props.disabled || disposed || selection !== selectionGeneration || target !== modelGeneration) return
    error.value = reason instanceof Error ? reason.message : String(reason)
    emit('validation:error', error.value)
  }
}
watch(modelValue, (value) => {
  modelGeneration += 1
  void resolveModel(value)
}, { immediate: true, deep: true, flush: 'sync' })
watch(() => props.disabled, (disabled) => {
  if (disabled) selectionGeneration += 1
}, { flush: 'sync' })
watch(() => props.multi, () => {
  modelGeneration += 1
  selectionGeneration += 1
  void resolveModel(modelValue.value)
}, { flush: 'sync' })
const label = computed(() => selected.value.map((asset) => asset.name).join(', ') || 'Pilih berkas')
</script>

<template>
  <BaseInput v-bind="props">
    <Dialog>
      <template #trigger><Button type="button" :disabled="props.disabled">{{ label }}</Button></template>
      <template #content="{ setOpen }"><AssetPicker @select="async (asset) => { await select(asset); setOpen(false) }" @cancel="setOpen(false)" /></template>
    </Dialog>
    <p v-if="error" role="alert" class="text-error">{{ error }}</p>
  </BaseInput>
</template>
