<script setup lang="ts">
import { z } from 'zod/v4'
import type { FormProps, FormViewProps } from '../../../contracts'
import FormView from '../FormView.vue'

type Result = { id: string; name: string }

const schema = z.object({ name: z.string() })
type Input = z.input<typeof schema>
type Output = z.output<typeof schema>
const form: FormProps<Input, Output, Result> = {
  schema,
  fields: { name: { renderer: 'text', label: 'Name' } },
  submit: async (output) => ({ id: '1', name: output.name }),
}
const defaultTo = (result: Result) => `/rows/${result.id}`
const viewProps = {
  form,
  title: 'Edit',
  defaultTo,
  backTo: false,
  afterSubmit: async ({ result, defaultTo: target, navigate, preventDefaultNavigation }) => {
    void result.id
    void target
    void navigate
    void preventDefaultNavigation
  },
} satisfies FormViewProps<Input, Output, Result>
</script>

<template>
  <FormView v-bind="viewProps" />
</template>
