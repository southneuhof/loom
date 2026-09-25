<script setup lang="ts">
import { ref } from 'vue'
import TextInput from './TextInput.vue'
import Button from '@southneuhof/loom/components/base/Button.vue'
import Icon from '@southneuhof/loom/components/base/Icon.vue'
import type { PasswordInputProps } from './textInput.types'

const props = defineProps<PasswordInputProps>()
const emit = defineEmits<{
  (event: 'validation:touch'): void
  (event: 'input', value: Event): void
  (event: 'change', value: Event): void
  (event: 'focus', value: FocusEvent): void
  (event: 'blur', value: FocusEvent): void
  (event: 'keydown', value: KeyboardEvent): void
  (event: 'keyup', value: KeyboardEvent): void
  (event: 'click', value: MouseEvent): void
}>()

const modelValue = defineModel<string | undefined>()
const showPassword = ref<boolean>(false)
</script>

<template>
  <TextInput
    v-bind="props"
    :model-value="modelValue"
    @update:model-value="(value) => (modelValue = value === undefined ? undefined : String(value))"
    :type="showPassword ? 'text' : 'password'"
    @validation:touch="emit('validation:touch')"
    @input="emit('input', $event)"
    @change="emit('change', $event)"
    @focus="emit('focus', $event)"
    @blur="emit('blur', $event)"
    @keydown="emit('keydown', $event)"
    @keyup="emit('keyup', $event)"
    @click="emit('click', $event)"
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
