<script setup lang="ts">
import FormView from '../../views/FormView.vue'
import Form from '../../core/Form.vue'
import DialogForm from '../DialogForm.vue'
import { pinForm, pins } from '../../../renderers/__type-tests__/field-binding.type-test'
</script>

<template>
  <Form v-bind="pinForm" />
  <Form v-bind="pins.update({ id: 'harbor' }).form" />
  <FormView v-bind="pins.update({ id: 'harbor' })">
    <template #input:location="{ setValue }">
      <button type="button" @click="setValue(null)">Clear</button>
    </template>
  </FormView>
  <DialogForm v-bind="pinForm" />
</template>
