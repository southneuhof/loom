<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import Icon from '@southneuhof/loom/components/base/Icon.vue'

const props = defineProps({
  debounced: {
    type: Boolean,
    default: true,
  },
  placeholder: {
    type: String,
    default: 'Search...',
  },
})

const modelValue = defineModel<string>({ default: '' })

const value = ref<string>(modelValue.value)
let debounceTimer: ReturnType<typeof setTimeout> | undefined

function debouncedSetValue() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => (modelValue.value = value.value), 300)
}

watch(value, () => {
  if (!props.debounced) modelValue.value = value.value
  else debouncedSetValue()
})

watch(modelValue, () => {
  clearTimeout(debounceTimer)
  value.value = modelValue.value
})
onBeforeUnmount(() => clearTimeout(debounceTimer))
</script>

<template>
  <div class="flex flex-row gap-4 rounded-full py-3 pl-4 outline outline-1 outline-outline/[24%] transition-all ease-linear">
    <Icon class="text-primary" name="search"></Icon>
    <input class="w-full bg-transparent focus-visible:outline-none" :placeholder="placeholder" v-model="value" />
  </div>
</template>
