<script setup lang="ts">
import { computed } from 'vue'
import type { PropType } from 'vue'
import IframePreviewDialog from '../composites/IframePreviewDialog.vue'
import { getFileExtension, isPreviewableExtension } from '@southneuhof/utilities/object'
import Icon from '../base/Icon.vue'
import Tooltip from '../base/Tooltip.vue'

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
  action: {
    type: Object as PropType<{ label: string; action: Function }>,
    required: false,
    default: undefined,
  },
  style: {
    type: String as PropType<'card' | 'link'>,
    required: false,
    default: 'card',
  },
  icon: {
    type: String,
    required: false,
    default: 'file',
  },
})

const extension = computed(() => {
  const filename = props.filename || props.url || ''
  return getFileExtension(filename)
})

const isPreviewable = computed(() => {
  return isPreviewableExtension(extension.value)
})
</script>

<template>
  <div v-if="style === 'card'" class="flex max-w-max flex-row items-center gap-4 rounded-md p-4 outline outline-1 outline-outline/[24%]">
    <Icon :name="props.icon as any"></Icon>
    <div>
      <div class="text-sm">{{ filename || url?.split('/').pop() }}</div>
      <div class="flex flex-row items-center gap-2">
        <template v-if="url">
          <div class="flex flex-row gap-4">
            <a :href="url" target="_blank" class="cursor-pointer text-sm text-primary">Download <Icon name="download" size="sm"></Icon></a>
          </div>
          <template v-if="isPreviewable">
            <div class="h-[12px] w-[1px] bg-outline/[24%]"></div>
            <IframePreviewDialog :url="url" :title="filename">
              <template #trigger>
                <button target="_blank" class="cursor-pointer text-sm text-primary">Preview <Icon name="eye" size="sm"></Icon></button>
              </template>
            </IframePreviewDialog>
          </template>
          <template v-else>
            <div class="h-[12px] w-[1px] bg-outline/[24%]"></div>
            <Tooltip>
              <template #trigger>
                <p target="_blank" class="text-sm text-muted">Preview <Icon name="eye" size="sm"></Icon></p>
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
  <a v-else :href="url" class="flex items-center gap-1 whitespace-nowrap text-info" target="_blank">
    <Icon :name="props.icon as any"></Icon>
    <span class="max-w-[150px] overflow-hidden text-ellipsis underline">{{ filename }}</span>
  </a>
</template>
