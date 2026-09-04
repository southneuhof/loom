<script setup lang="ts">
import type { PropType } from 'vue'
import { ref } from 'vue'
import TextInput from './TextInput.vue'
import Button from '@southneuhof/loom/components/base/Button.vue'
import Icon from '@southneuhof/loom/components/base/Icon.vue'

const props = defineProps({
  prefix: {
    type: String,
    default: '',
  },
  suffix: {
    type: String,
    default: '',
  },
  icon: {
    type: String,
    default: '',
  },
  constraint: {
    type: Array as PropType<Array<'number' | 'text'>>,
    default: () => ['text', 'number'],
  },
  inputClass: {
    type: String,
  },
})

const modelValue = defineModel<string | number>()
const showPassword = ref<boolean>(false)
</script>

<template>
  <TextInput
    v-bind="props"
    :model-value="modelValue"
    @update:model-value="(value) => (modelValue = String(value))"
    :type="showPassword ? 'text' : 'password'"
  >
    <template #action>
      <Button kind="icon" variant="standard" @click="showPassword = !showPassword">
        <template #icon>
          <Icon :name="showPassword ? 'eye-off' : 'eye'" />
        </template>
      </Button>
    </template>
  </TextInput> 
</template>
