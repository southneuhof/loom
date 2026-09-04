<script setup lang="ts">
import { CollapsibleContent, CollapsibleRoot, CollapsibleTrigger } from 'reka-ui'
import { ref, watch } from 'vue'
import Icon from './Icon.vue'

const props = defineProps({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: false,
  },
  open: {
    type: Boolean,
    required: false,
    default: false,
  },
})

const panelState = ref(props.open)

watch(
  () => props.open,
  (value: boolean) => {
    panelState.value = value
  }
)
</script>

<template>
  <div class="w-full">
    <CollapsibleRoot v-model:open="panelState">
      <CollapsibleTrigger class="w-full">
        <div
          :class="panelState ? 'bg-secondary-container text-on-secondary-container  ' : 'bg-surface-container-high text-on-surface  '"
          class="overlay flex w-full flex-row items-center justify-between rounded-xl px-4 py-2 after:bg-on-surface-hover focus-visible:after:bg-on-surface-active active:after:bg-on-surface-active"
        >
          <div class="flex flex-col">
            <div class="text-start">{{ props.title }}</div>
            <div v-if="props.description" class="text-start text-sm">{{ props.description }}</div>
          </div>
          <Icon size="3xl" :name="!panelState ? 'arrow-down-s' : 'arrow-up-s'" />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent forceMount v-show="panelState">
        <slot></slot>
      </CollapsibleContent>
    </CollapsibleRoot>
  </div>
</template>
