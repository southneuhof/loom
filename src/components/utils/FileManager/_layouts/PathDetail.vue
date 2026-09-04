<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import type { ManagedAsset } from '../../../../file-manager/contracts'
import { useFileManager } from '../../../../file-manager/provider'
import Button from '../../../base/Button.vue'

const props = defineProps<{ folder: ManagedAsset; ancestry?: ManagedAsset[] }>()
const selected = defineModel<ManagedAsset | undefined>('selected')
const emit = defineEmits<{ navigate: [folder: ManagedAsset] }>()
const provider = useFileManager()
const assets = ref<ManagedAsset[]>([])
const loading = ref(false)
const error = ref<string>()
let controller: AbortController | undefined

async function load() {
  controller?.abort()
  controller = new AbortController()
  loading.value = true
  error.value = undefined
  try {
    assets.value = (await provider.operations.list({ parentId: props.folder.id, signal: controller.signal })).data
  } catch (reason) {
    if (!controller.signal.aborted) error.value = reason instanceof Error ? reason.message : String(reason)
  } finally {
    if (!controller.signal.aborted) loading.value = false
  }
}
async function remove(asset: ManagedAsset) {
  if (!provider.operations.remove) return
  await provider.operations.remove({ id: asset.id })
  await provider.invalidateRemovedSubtree(asset.id, props.folder.id)
  await load()
}
watch(() => props.folder.id, load, { immediate: true })
onBeforeUnmount(() => controller?.abort())
</script>

<template>
  <section class="flex flex-col gap-3">
    <nav class="flex gap-1 text-sm"><button v-for="ancestor in ancestry" :key="ancestor.id" type="button" @click="emit('navigate', ancestor)">{{ ancestor.name }}</button></nav>
    <p v-if="loading">Memuat…</p>
    <p v-else-if="error" role="alert">{{ error }}</p>
    <div v-else class="grid gap-2">
      <div v-for="asset in assets" :key="asset.id" class="flex items-center justify-between rounded-lg p-3 outline outline-1 outline-outline/[24%]">
        <button type="button" class="flex-1 text-left" @click="asset.kind === 'folder' ? emit('navigate', asset) : selected = asset">{{ asset.name }}</button>
        <Button v-if="provider.operations.remove" kind="icon" color="error" @click="remove(asset)">Hapus</Button>
      </div>
    </div>
  </section>
</template>
