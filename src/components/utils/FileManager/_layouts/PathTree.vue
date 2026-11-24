<script setup lang="ts">
import { computed, onMounted } from 'vue'
import type { ManagedAsset } from '../../../../file-manager/contracts'
import { useFileManager } from '../../../../file-manager/provider'
import { useDirectoryList } from '../../../../file-manager/useDirectoryList'

defineProps<{ activeId?: string }>()
const emit = defineEmits<{ navigate: [asset: ManagedAsset] }>()
const provider = useFileManager()
const { assets, loading, error, load } = useDirectoryList(provider.operations)
const folders = computed(() => assets.value.filter((asset) => asset.kind === 'folder'))
onMounted(() => load(provider.root))
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
