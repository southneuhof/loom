<script setup lang="ts">
import { z } from 'zod/v4'
import type { FormProps } from '../../../contracts'
import FormView from '../FormView.vue'

type Result = { id: string; name: string }

const schema = z.object({ name: z.string() })
type Input = z.input<typeof schema>
type Output = z.output<typeof schema>
const form: FormProps<Input, Output, Result> = {
  schema,
  fields: { name: { label: 'Name' } },
  submit: async (output) => ({ id: '1', name: output.name }),
}
const defaultTo = (result: Result) => `/rows/${result.id}`
</script>

<template>
  <FormView :form="form" title="Edit" :default-to="defaultTo" />
</template>
