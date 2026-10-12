<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef, watch, type PropType } from 'vue'
import type { Editor as TinyMCEEditor, RawEditorOptions } from 'tinymce'
import Editor from '@tinymce/tinymce-vue'
import type { BaseInputControlBindings } from '../../contracts/formControlBindings'

const props = defineProps({
  controlBindings: { type: Object as PropType<BaseInputControlBindings>, required: true },
  init: { type: Object as PropType<RawEditorOptions>, required: true },
})

const modelValue = defineModel<string>()
const editor = shallowRef<TinyMCEEditor | null>(null)
const initializedEditor = shallowRef<TinyMCEEditor | null>(null)

function iframeAttributes() {
  return {
    'aria-describedby': props.controlBindings['aria-describedby'] ?? null,
    'aria-invalid': props.controlBindings['aria-invalid'] == null ? null : String(props.controlBindings['aria-invalid']),
    'aria-required': props.controlBindings['aria-required'] == null ? null : String(props.controlBindings['aria-required']),
  }
}

function initialIframeAttributes(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(iframeAttributes()).filter((entry): entry is [string, string] => entry[1] !== null),
  )
}

function updateIframeAttributes(instance = editor.value): void {
  if (!instance?.iframeElement) return
  instance.dom.setAttribs(instance.iframeElement, iframeAttributes())
}

function registerEditor(instance: TinyMCEEditor): void {
  editor.value = instance
  instance.on('init', () => {
    initializedEditor.value = instance
    updateIframeAttributes(instance)
  })
  instance.on('remove', () => {
    if (editor.value === instance) {
      editor.value = null
      initializedEditor.value = null
    }
  })
}

const editorInit = computed(() => ({
  ...props.init,
  iframe_attrs: initialIframeAttributes(),
  setup: registerEditor,
}))

watch(() => props.controlBindings, () => updateIframeAttributes(initializedEditor.value), { deep: true, flush: 'post' })
onBeforeUnmount(() => {
  editor.value = null
  initializedEditor.value = null
})
</script>

<template>
  <Editor v-model="modelValue" :id="controlBindings.id" :disabled="controlBindings.disabled" api-key="no-api-key" :init="editorInit" />
</template>
