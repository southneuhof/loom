<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { ManagedAsset } from '../../../file-manager/contracts'
import { useFileManager } from '../../../file-manager/provider'
import PathTree from './_layouts/PathTree.vue'
import PathDetail from './_layouts/PathDetail.vue'

const provider = useFileManager()
const activeFolder = ref<ManagedAsset>({ id: provider.root, parentId: null, kind: 'folder', name: 'Root' })
const selected = ref<ManagedAsset>()
const history = ref<ManagedAsset[]>([activeFolder.value])

function navigate(folder: ManagedAsset) {
  activeFolder.value = folder
  const existing = history.value.findIndex((item) => item.id === folder.id)
  history.value = existing >= 0 ? history.value.slice(0, existing + 1) : [...history.value, folder]
  selected.value = undefined
}
</script>

<template>
  <div class="grid min-h-96 grid-cols-12 gap-4">
    <PathTree class="col-span-3" :active-id="activeFolder.id" @navigate="navigate" />
    <PathDetail class="col-span-9" :folder="activeFolder" :ancestry="history" v-model:selected="selected" @navigate="navigate" />
    <footer class="col-span-12"><slot name="footer" :data="selected" :folder="activeFolder" /></footer>
  </div>
</template>
