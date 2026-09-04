<script setup lang="ts">
import { ref, useId } from 'vue'
import { useVueToPrint } from 'vue-to-print'

const props = defineProps({
  documentTitle: String,
  pageStyle: String,
  hidePrintView: {
    type: Boolean,
    default: true,
  },
})

const printableRef = ref()

const { handlePrint } = useVueToPrint({
  content: printableRef,
  documentTitle: props.documentTitle,
  pageStyle: props.pageStyle,
  suppressErrors: false,
})
</script>

<template>
  <slot name="trigger" v-bind="{ handlePrint }" />
  <div ref="printableRef" class="print:flex" :class="hidePrintView ? 'hidden' : ''">
    <slot name="content" />
  </div>
</template>
