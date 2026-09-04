<script setup lang="ts">
import Disclosure from '@southneuhof/loom/components/base/Disclosure.vue'
import { ref, type PropType } from 'vue'

const props = defineProps({
  config: {
    type: Array as PropType<{ title: string; [key: string]: any }[]>,
    required: true,
  },
})

const openDisclosure = ref(-1)
</script>

<template>
  <Disclosure v-for="(item, idx) in props.config" :title="item.title" :open="openDisclosure == idx" @click="openDisclosure = idx">
    <slot name="content" v-bind="item"></slot>
  </Disclosure>
</template>
