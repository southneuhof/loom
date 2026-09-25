<script setup lang="ts">
import { z } from 'zod/v4'
import type { FormViewProps } from '../../../contracts'
import { defineForm } from '../../../forms/defineForm'
import NumberInput from '../../inputs/NumberInput.vue'
import DialogForm from '../DialogForm.vue'
import Form from '../../core/Form.vue'
import FormView from '../../views/FormView.vue'

const schema = z.object({ age: z.number(), name: z.string() })
type Input = z.input<typeof schema>
type Output = z.output<typeof schema>
type OriginalResult = { id: string }
type AlternateResult = { workflowId: string }

const personForm = defineForm({
  schema,
  fields: {
    age: { renderer: 'number' },
    name: { renderer: 'text' },
  },
  submit: async (input) => ({ id: input.name }),
})

const saveForWorkflow = async (input: Output): Promise<AlternateResult> => ({ workflowId: input.name })
const saveWithWrongInput = async (input: { token: string }): Promise<AlternateResult> => ({ workflowId: input.token })
const onAlternateResult = (result: AlternateResult) => result.workflowId
const onOriginalResult = (result: OriginalResult) => result.id
const pageProps = {
  form: personForm,
  title: 'Person',
} satisfies FormViewProps<Input, Output, OriginalResult, 'age' | 'name'>
</script>

<template>
  <Form v-bind="personForm" :submit="saveForWorkflow" @submitted="onAlternateResult">
    <template #input:age="{ value, setValue }">
      <NumberInput :model-value="value" @update:model-value="setValue" />
      <!-- @vue-expect-error Age accepts number and its clear states. -->
      {{ setValue('old') }}
    </template>
    <template #input:name="{ value, setValue }">
      <button type="button" @click="setValue('Ada')">{{ value }}</button>
      <!-- @vue-expect-error Name accepts string and its clear states. -->
      {{ setValue(42) }}
    </template>
    <!-- @vue-expect-error Form derives slot names from selected input keys. -->
    <template #input:missing="{ setValue }">
      {{ setValue('old') }}
    </template>
  </Form>
  <!-- @vue-expect-error A submit override must accept the schema output. -->
  <Form v-bind="personForm" :submit="saveWithWrongInput" />
  <!-- @vue-expect-error The effective submit result must determine the event. -->
  <Form v-bind="personForm" :submit="saveForWorkflow" @submitted="onOriginalResult" />

  <DialogForm v-bind="personForm" :submit="saveForWorkflow" @submitted="onAlternateResult">
    <template #input:age="{ value, setValue }">
      <NumberInput :model-value="value" @update:model-value="setValue" />
      <!-- @vue-expect-error DialogForm preserves the age setter contract. -->
      {{ setValue('old') }}
    </template>
    <template #input:name="{ value, setValue }">
      <button type="button" @click="setValue('Ada')">{{ value }}</button>
      <!-- @vue-expect-error DialogForm preserves the name setter contract. -->
      {{ setValue(42) }}
    </template>
    <!-- @vue-expect-error DialogForm derives slot names from selected input keys. -->
    <template #input:missing="{ setValue }">
      {{ setValue('old') }}
    </template>
  </DialogForm>
  <!-- @vue-expect-error The DialogForm override determines the event result. -->
  <DialogForm v-bind="personForm" :submit="saveForWorkflow" @submitted="onOriginalResult" />

  <FormView v-bind="pageProps">
    <template #input:age="{ value, setValue }">
      <NumberInput :model-value="value" @update:model-value="setValue" />
      <!-- @vue-expect-error FormView preserves the age setter contract. -->
      {{ setValue('old') }}
    </template>
    <template #input:name="{ value, setValue }">
      <button type="button" @click="setValue('Ada')">{{ value }}</button>
      <!-- @vue-expect-error FormView preserves the name setter contract. -->
      {{ setValue(42) }}
    </template>
    <!-- @vue-expect-error FormView derives slot names from the nested form. -->
    <template #input:missing="{ setValue }">
      {{ setValue('old') }}
    </template>
  </FormView>
</template>
