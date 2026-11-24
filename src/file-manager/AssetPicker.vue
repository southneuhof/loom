<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { ManagedAsset } from './contracts'
import { useFileManager } from './provider'
import { useDirectoryList } from './useDirectoryList'
import Button from '../components/base/Button.vue'

const props = withDefaults(defineProps<{ accept?: (asset: ManagedAsset) => boolean }>(), {
  accept: (asset: ManagedAsset) => asset.kind === 'file',
})
const emit = defineEmits<{ select: [asset: ManagedAsset]; cancel: [] }>()
const provider = useFileManager()
const { assets, loading, error, load } = useDirectoryList(provider.operations)
const activeParent = ref<string | null>(provider.root)

async function openFolder(parentId: string | null) {
  if (await load(parentId)) activeParent.value = parentId
}
onMounted(() => openFolder(activeParent.value))
</script>

<template>
  <div class="flex min-h-64 flex-col gap-3">
    <p v-if="loading">Memuat…</p>
    <p v-else-if="error" role="alert">{{ error }} <button type="button" @click="openFolder(activeParent)">Coba lagi</button></p>
    <div v-else class="grid gap-2">
      <button v-for="asset in assets" :key="asset.id" type="button" class="rounded-lg p-3 text-left outline outline-1 outline-outline/[24%]" @click="asset.kind === 'folder' ? openFolder(asset.id) : props.accept(asset) && emit('select', asset)">
        {{ asset.name }}
      </button>
    </div>
    <Button variant="text" type="button" @click="emit('cancel')">Batal</Button>
  </div>
</template>
