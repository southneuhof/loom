<script setup lang="ts">
import { h, ref } from 'vue'
import type { AssetValue } from '../../../assets/contracts'
import type { FileInputPublicProps } from '../fileInput.types'
import FileInput from '../FileInput.vue'
import ImageInput from '../ImageInput.vue'
import TextareaInput from '../TextareaInput.vue'

const asset: AssetValue = { kind: 'file', id: 'one', url: '/one', name: 'one' }
const assets = [asset]
const localFile = new File(['one'], 'one.txt', { type: 'text/plain' })
const localFiles = [localFile]
const dynamicModel = ref<AssetValue | File | AssetValue[] | File[] | null | undefined>(asset)
const dynamicMulti = ref<boolean>(false)
const dynamicMode = ref<'asset' | 'file'>('asset')
const textOrNumber = ref<string | number | undefined>('draft')

const validDefaultAsset = h(FileInput, { modelValue: asset })
const validExplicitAsset: FileInputPublicProps<'asset'> = { mode: 'asset', modelValue: asset }
const validLocalFile: FileInputPublicProps<'file'> = { mode: 'file', modelValue: localFile }
const validLocalFiles: FileInputPublicProps<'file', true> = { mode: 'file', multi: true, modelValue: localFiles }
const validDynamic: FileInputPublicProps<'asset' | 'file', boolean> = { mode: dynamicMode.value, multi: dynamicMulti.value, modelValue: dynamicModel.value }
// @ts-expect-error File mode accepts local File values.
const invalidAssetInFileMode: FileInputPublicProps<'file'> = { mode: 'file', modelValue: asset }
// @ts-expect-error Asset mode accepts canonical stored values.
const invalidFileInAssetMode: FileInputPublicProps<'asset'> = { mode: 'asset', modelValue: localFile }
// @ts-expect-error A multi file model uses an array.
const invalidMultiCardinality: FileInputPublicProps<'file', true> = { mode: 'file', multi: true, modelValue: localFile }
// @ts-expect-error Local mode does not accept asset upload settings.
const invalidLocalUpload: FileInputPublicProps<'file'> = { mode: 'file', modelValue: localFile, destination: 'images' }
</script>

<template>
  <TextareaInput v-model="textOrNumber" :constraint="['number']" />
  <TextareaInput :model-value="'draft'" :constraint="['number']" />
  <TextareaInput :model-value="12" :constraint="['text']" />
  <ImageInput :model-value="assets" mode="asset" :multi="true" />
  <ImageInput :model-value="localFiles" mode="file" :multi="true" />
  <FileInput v-model="dynamicModel" :mode="dynamicMode" :multi="dynamicMulti" />
  <!-- @vue-expect-error File mode requires a local File value. -->
  <FileInput mode="file" :model-value="asset" />
  <!-- @vue-expect-error Omitted mode uses the stored asset model. -->
  <FileInput :model-value="localFile" />
  <!-- @vue-expect-error A multiple local model uses an array. -->
  <FileInput mode="file" :multi="true" :model-value="localFile" />
  <!-- @vue-expect-error Local file mode does not accept asset destinations. -->
  <FileInput mode="file" :model-value="localFile" destination="images" />
</template>
