<script setup lang="ts">
import { computed } from 'vue'
import type { PropType } from 'vue'
import type remixiconTags from '../base/remixicon-tags'
import IframePreviewDialog from '../composites/IframePreviewDialog.vue'
import { getFileExtension, isPreviewableExtension } from '@southneuhof/utilities/object'
import type { AssetValue } from '../../assets/contracts'
import { useAssetAdapter } from '../../assets/provider'
import Icon from '../base/Icon.vue'
import Tooltip from '../base/Tooltip.vue'

type IconName = (typeof remixiconTags)[number]

const props = defineProps({
  filename: {
    type: String,
    required: false,
  },
  ext: {
    type: String,
    required: false,
  },
  url: {
    type: String,
    required: false,
  },
  asset: {
    type: Object as PropType<AssetValue | null>,
    required: false,
  },
  action: {
    type: Object as PropType<{ label: string; action: () => void | Promise<void> }>,
    required: false,
    default: undefined,
  },
  style: {
    type: String as PropType<'card' | 'link'>,
    required: false,
    default: 'card',
  },
  icon: {
    type: String as PropType<IconName>,
    required: false,
    default: 'file',
  },
})

const assets = useAssetAdapter({ optional: true })
const file = computed(() => {
  if (props.asset === undefined) {
    return {
      filename: props.filename,
      url: props.url,
      extension: props.ext ?? getFileExtension(props.filename || props.url || ''),
      invalid: false,
    }
  }
  if (props.filename !== undefined || props.ext !== undefined || props.url !== undefined) {
    throw new Error('[loom] ASSET_PREVIEW_SOURCE_CONFLICT')
  }
  if (!assets) throw new Error('[loom] ASSET_ADAPTER_REQUIRED')
  if (props.asset === null) return { filename: undefined, url: undefined, extension: '', invalid: false }
  const asset = assets.read(props.asset)
  if (!asset) return { filename: undefined, url: undefined, extension: '', invalid: true }
  return {
    filename: asset.name,
    url: assets.preview(asset).imageURL,
    extension: getFileExtension(asset.name),
    invalid: false,
  }
})

const filename = computed(() => file.value.filename)
const url = computed(() => file.value.url)
const invalidAsset = computed(() => file.value.invalid)
const extension = computed(() => file.value.extension)

const isPreviewable = computed(() => {
  return isPreviewableExtension(extension.value)
})
</script>

<template>
  <p v-if="invalidAsset" role="alert" class="text-sm text-error">Invalid asset value.</p>
  <div v-else-if="props.style === 'card'" class="flex max-w-max flex-row items-center gap-4 rounded-md p-4 outline outline-1 outline-outline/[24%]">
    <Icon :name="props.icon"></Icon>
    <div>
      <div class="text-sm">{{ filename || url?.split('/').pop() }}</div>
      <div class="flex flex-row items-center gap-2">
        <template v-if="url">
          <div class="flex flex-row gap-4">
            <a :href="url" target="_blank" rel="noopener noreferrer" class="cursor-pointer text-sm text-primary">Download <Icon name="download" size="sm"></Icon></a>
          </div>
          <template v-if="isPreviewable">
            <div class="h-[12px] w-[1px] bg-outline/[24%]"></div>
            <IframePreviewDialog :url="url" :title="filename">
              <template #trigger>
                <button class="cursor-pointer text-sm text-primary">Preview <Icon name="eye" size="sm"></Icon></button>
              </template>
            </IframePreviewDialog>
          </template>
          <template v-else>
            <div class="h-[12px] w-[1px] bg-outline/[24%]"></div>
            <Tooltip>
              <template #trigger>
                <p class="text-sm text-muted">Preview <Icon name="eye" size="sm"></Icon></p>
              </template>
              <template #content>
                <p>File {{ extension }} tidak didukung untuk preview</p>
              </template>
            </Tooltip>
          </template>
        </template>
        <template v-if="props.action">
          <div class="h-[12px] w-[1px] bg-outline/[24%]"></div>
          <button type="button" @click="() => props.action?.action()" class="text-sm text-primary">{{ props.action?.label }}</button>
        </template>
      </div>
    </div>
  </div>
  <a v-else :href="url" class="flex items-center gap-1 whitespace-nowrap text-info" target="_blank" rel="noopener noreferrer">
    <Icon :name="props.icon"></Icon>
    <span class="max-w-[150px] overflow-hidden text-ellipsis underline">{{ filename }}</span>
  </a>
</template>
