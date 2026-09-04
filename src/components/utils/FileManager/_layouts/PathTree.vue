<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { ManagedAsset } from '../../../../file-manager/contracts'
import { useFileManager } from '../../../../file-manager/provider'

defineProps<{ activeId?: string }>()
const emit = defineEmits<{ navigate: [asset: ManagedAsset] }>()
const provider = useFileManager()
const folders = ref<ManagedAsset[]>([])
const loading = ref(false)
const error = ref<string>()
let controller: AbortController | undefined

async function load() {
  controller?.abort()
  controller = new AbortController()
  loading.value = true
  try {
    folders.value = (await provider.operations.list({ parentId: provider.root, signal: controller.signal })).data.filter((asset) => asset.kind === 'folder')
  } catch (reason) {
    if (!controller.signal.aborted) error.value = reason instanceof Error ? reason.message : String(reason)
  } finally {
    if (!controller.signal.aborted) loading.value = false
  }
}
onMounted(load)
onBeforeUnmount(() => controller?.abort())
</script>

<template>
  <aside class="flex flex-col gap-2">
    <p v-if="loading">Memuat…</p>
    <p v-else-if="error" role="alert">{{ error }}</p>
    <button v-for="folder in folders" :key="folder.id" type="button" class="rounded-lg p-2 text-left" :class="{ 'bg-primary-container': activeId === folder.id }" @click="emit('navigate', folder)">
      {{ folder.name }}
    </button>
  </aside>
</template>
