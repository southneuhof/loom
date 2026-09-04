<script setup lang="ts">
import FileManager from '@southneuhof/loom/components/utils/FileManager/FileManager.vue'

const props = defineProps({
  multi: {
    type: Boolean,
    default: false,
  },
})

const modelValue = defineModel<any>()
</script>

<template>
  <FileManager :multi="props.multi" v-model="modelValue" />
</template>
