<script setup lang="ts">
import { commonProps } from './commonprops'
import BaseInput from './BaseInput.vue'
import { onBeforeUnmount, ref, watch, type PropType } from 'vue'
import 'tinymce/tinymce'
import 'tinymce/skins/ui/oxide/skin.css'
import 'tinymce/skins/ui/oxide/content.css'
import 'tinymce/themes/silver'
import 'tinymce/icons/default'
import 'tinymce/models/dom/model'
import 'tinymce/plugins/advlist/plugin.js'
import 'tinymce/plugins/autolink/plugin.js'
import 'tinymce/plugins/lists/plugin.js'
import 'tinymce/plugins/link/plugin.js'
import 'tinymce/plugins/image/plugin.js'
import 'tinymce/plugins/charmap/plugin.js'
import 'tinymce/plugins/preview/plugin.js'
import 'tinymce/plugins/anchor/plugin.js'
import 'tinymce/plugins/searchreplace/plugin.js'
import 'tinymce/plugins/visualblocks/plugin.js'
import 'tinymce/plugins/code/plugin.js'
import 'tinymce/plugins/fullscreen/plugin.js'
import 'tinymce/plugins/insertdatetime/plugin.js'
import 'tinymce/plugins/media/plugin.js'
import 'tinymce/plugins/table/plugin.js'
import 'tinymce/plugins/help/plugin.js'
import 'tinymce/plugins/wordcount/plugin.js'
import 'tinymce/plugins/help/js/i18n/keynav/en.js'
import RichTextEditorControl from './RichTextEditorControl.vue'

const props = defineProps({
  contentType: {
    type: String as PropType<'html' | 'delta' | 'text'>,
    default: 'html',
  },
  height: {
    type: Number,
    default: 400,
  },
  ...commonProps,
})

const modelValue = defineModel<string>()

// const imageUploadHandler = (blobInfo: any, progress: any) => new Promise((resolve, reject) => {
//   services.fileMediaUpload(blobInfo.blob(), () => {}).then(res => {
//     resolve(res.url);
//   })
// })

const init = {
  // images_upload_handler: imageUploadHandler,
  plugins: [
    'advlist',
    'autolink',
    'lists',
    'link',
    'image',
    'charmap',
    'preview',
    'anchor',
    'searchreplace',
    'visualblocks',
    'code',
    'fullscreen',
    'insertdatetime',
    'media',
    'table',
    // 'help',
    // 'wordcount'
  ],
  elementpath: false,
  file_picker_types: 'image',
  toolbar: 'undo redo | blocks | ' + 'bold italic backcolor | alignleft aligncenter ' + 'alignright alignjustify | bullist numlist outdent indent | ' + 'removeformat | help',
  content_css: false,
  skin: false,
  height: props.height || undefined,
  content_style: ".mce-content-body {font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,Cantarell,'Open Sans','Helvetica Neue',sans-serif;}",
}

const editorMountQueue: (() => void)[] = ((window as any).__tinymce_mount_queue__ ??= [])
let isProcessingQueue = (window as any).__tinymce_queue_processing__ ?? false

const processQueue = () => {
  if (isProcessingQueue || editorMountQueue.length === 0) return
  isProcessingQueue = true
  ;(window as any).__tinymce_queue_processing__ = true

  const next = editorMountQueue.shift()
  if (next) {
    next()
    setTimeout(() => {
      isProcessingQueue = false
      ;(window as any).__tinymce_queue_processing__ = false
      processQueue()
    }, 50)
  }
}

const shouldMount = ref(false)

const mountEditor = () => {
  shouldMount.value = true
}

editorMountQueue.push(mountEditor)
processQueue()

onBeforeUnmount(() => {
  const idx = editorMountQueue.indexOf(mountEditor)
  if (idx > -1) editorMountQueue.splice(idx, 1)
})
</script>

<template>
  <BaseInput v-bind="props">
    <template #default="{ controlBindings }">
      <RichTextEditorControl v-if="shouldMount" v-model="modelValue" :control-bindings="controlBindings" :init="init" />
      <div v-else class="editor-placeholder" :style="{ height: `${props.height}px` }">
        <span>Loading editor...</span>
      </div>
    </template>
  </BaseInput>
</template>

<style scoped>
.editor-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #ccc;
  border-radius: 4px;
  background-color: #f5f5f5;
  color: #999;
}
</style>
