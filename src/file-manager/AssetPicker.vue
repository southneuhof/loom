<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { ManagedAsset } from './contracts'
import { useFileManager } from './provider'
import Button from '../components/base/Button.vue'

const props = withDefaults(defineProps<{ accept?: (asset: ManagedAsset) => boolean }>(), {
  accept: (asset: ManagedAsset) => asset.kind === 'file',
})
const emit = defineEmits<{ select: [asset: ManagedAsset]; cancel: [] }>()
const provider = useFileManager()
const assets = ref<ManagedAsset[]>([])
const activeParent = ref<string | null>(provider.root)
const loading = ref(false)
const error = ref<string>()
let controller: AbortController | undefined

async function load(parentId: string | null) {
  controller?.abort()
  controller = new AbortController()
  loading.value = true
  error.value = undefined
  try {
    assets.value = (await provider.operations.list({ parentId, signal: controller.signal })).data
    activeParent.value = parentId
  } catch (reason) {
    if (!controller.signal.aborted) error.value = reason instanceof Error ? reason.message : String(reason)
  } finally {
    if (!controller.signal.aborted) loading.value = false
  }
}
onMounted(() => load(activeParent.value))
onBeforeUnmount(() => controller?.abort())
</script>

<template>
  <div class="flex min-h-64 flex-col gap-3">
    <p v-if="loading">Memuat…</p>
    <p v-else-if="error" role="alert">{{ error }} <button type="button" @click="load(activeParent)">Coba lagi</button></p>
    <div v-else class="grid gap-2">
      <button v-for="asset in assets" :key="asset.id" type="button" class="rounded-lg p-3 text-left outline outline-1 outline-outline/[24%]" @click="asset.kind === 'folder' ? load(asset.id) : props.accept(asset) && emit('select', asset)">
        {{ asset.name }}
      </button>
    </div>
    <Button variant="text" type="button" @click="emit('cancel')">Batal</Button>
  </div>
</template>
