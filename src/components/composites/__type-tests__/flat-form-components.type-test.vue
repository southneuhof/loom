<script setup lang="ts">
import { z } from 'zod/v4'
import type { FormProps } from '../../../forms/props'
import DialogForm from '../DialogForm.vue'
import Form from '../../core/Form.vue'

const schema = z.object({ name: z.string() })
type Input = z.input<typeof schema>
type Output = z.output<typeof schema>
const formProps: FormProps<Input, Output, string> = {
  schema,
  fields: { name: {} },
  submit: async ({ name }) => name,
}
</script>

<template>
  <!-- @vue-expect-error Form does not accept a nested form prop. -->
  <Form v-bind="formProps" :form="formProps" />
  <!-- @vue-expect-error DialogForm does not accept a nested form prop. -->
  <DialogForm v-bind="formProps" :form="formProps" title="Create user" />
</template>
