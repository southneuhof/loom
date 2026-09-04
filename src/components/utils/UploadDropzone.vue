<script setup lang="ts">
import { useDropZone } from '@vueuse/core'
import { ref, type PropType } from 'vue'
import Button from '@southneuhof/loom/components/base/Button.vue'
import Icon from '@southneuhof/loom/components/base/Icon.vue'

const props = defineProps({
  accept: {
    type: Array as PropType<string[]>,
    required: false,
    default: () => [],
  },
  multi: {
    type: Boolean,
    required: false,
    default: false,
  },
})

const emit = defineEmits(['update:modelValue', 'update:uploadState'])

const dropZoneRef = ref<HTMLDivElement>()
function handleFileDrop(files: File[]) {
  emit('update:modelValue', files)
}
function openFileDialog() {
  if (fileInput.value) (fileInput.value as HTMLInputElement).click()
}
function onDrop(files?: File[] | null) {
  if (files && files.length > 0) handleFileDrop(files)
}

const { isOverDropZone } = useDropZone(dropZoneRef as any, onDrop)

const fileInput = ref()
</script>

<template>
  <div ref="dropZoneRef">
    <div class="flex w-full flex-col items-center justify-center gap-4 rounded-md py-8 outline-dashed outline-2 outline-outline/[24%]">
      <div v-if="!isOverDropZone" class="flex flex-row items-center gap-4">
        <div class="text-black-light font-bold">Letakkan file anda di sini</div>
        <div class="text-black-light">/</div>
        <label class="w-fit">
          <a class="cursor-pointer">
            <Button @click="openFileDialog()">
              <template #icon>
                <Icon name="add-circle"></Icon>
              </template>
              <div>Pilih dari penyimpanan</div>
            </Button>
            <input
              ref="fileInput"
              type="file"
              hidden
              id="file"
              :multiple="props.multi"
              :accept="props.accept.join(',') || undefined"
              class="rounded-md p-2"
              @change="handleFileDrop(Array.from(($event.target as HTMLInputElement).files as FileList))"
            />
          </a>
        </label>
      </div>
      <div v-else>
        <div class="flex flex-col items-center justify-center gap-4">
          <div><Icon name="upload-cloud"></Icon></div>
          <div class="text-black-light font-bold">Lepaskan kursor untuk mengunggah</div>
        </div>
      </div>
    </div>
  </div>
</template>
