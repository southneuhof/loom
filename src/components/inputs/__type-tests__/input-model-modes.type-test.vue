<script setup lang="ts">
import { ref } from 'vue'
import type { AssetValue } from '../../../assets/contracts'
import FileInput from '../FileInput.vue'
import ImageInput from '../ImageInput.vue'
import TextareaInput from '../TextareaInput.vue'

const file: AssetValue = { kind: 'file', id: 'one', url: '/one', name: 'one' }
const files = [file]
const anyAsset = ref<AssetValue | AssetValue[] | null | undefined>(files)
const dynamicMulti = ref<boolean>(false)
const textOrNumber = ref<string | number | undefined>('draft')
</script>

<template>
  <TextareaInput v-model="textOrNumber" :constraint="['number']" />
  <TextareaInput :model-value="'draft'" :constraint="['number']" />
  <TextareaInput :model-value="12" :constraint="['text']" />
  <FileInput v-model="anyAsset" :multi="dynamicMulti" />
  <FileInput :model-value="files" :multi="false" />
  <FileInput :model-value="file" :multi="true" />
  <ImageInput v-model="anyAsset" :multi="dynamicMulti" />
  <ImageInput :model-value="files" :multi="false" />
  <ImageInput :model-value="file" :multi="true" />
</template>
