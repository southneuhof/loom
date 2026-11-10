<script
  setup
  lang="ts"
  generic="
    TInput extends object,
    TOutput extends object,
    TResult,
    TKeys extends string = Extract<keyof TInput, string>,
    TContext extends object = Readonly<Record<string, unknown>>,
    TFields extends object = {}
  "
>
import { useAttrs } from 'vue'
import type { FormDraftSnapshot, FormSlots } from '../../contracts/forms'
import type { SubmitError } from '../../contracts/results'
import type { FormProps } from '../../forms/props'
import { useFormSession } from '../../forms/useFormSession'
import { formSessionHost } from '../../forms/formSessionHost'
import FormRendering from './FormRendering.vue'

defineOptions({ inheritAttrs: false })
const props = defineProps<FormProps<TInput, TOutput, TResult, TKeys, TContext, TFields>>()
defineSlots<FormSlots<TInput, TKeys, TOutput, TResult, TContext>>()
const attrs = useAttrs()
const emit = defineEmits<{
  (event: 'update:modelValue', value: FormDraftSnapshot<TInput>): void
  (event: 'submitted', result: TResult, refreshError?: SubmitError): void
  (event: 'error', error: SubmitError): void
  (event: 'reset'): void
}>()
const session = useFormSession<TInput, TOutput, TResult, TKeys, TContext, TFields>(props, {
  updateModel: (value) => emit('update:modelValue', value),
  submitted: (result, refreshError) => {
    if (refreshError === undefined) emit('submitted', result)
    else emit('submitted', result, refreshError)
  },
  error: (error) => emit('error', error),
  reset: () => emit('reset'),
}, formSessionHost())
defineExpose({
  submittedValues: session.submittedValues,
  draft: session.draft,
  dirty: session.dirty,
  submitting: session.submitting,
  submitPending: session.submitPending,
  postWriteError: session.postWriteError,
  validating: session.validating,
  inputPending: session.inputPending,
  validate: session.validate,
  submit: session.submit,
  reset: session.reset,
  refresh: session.refresh,
})
</script>
<template>
  <FormRendering :configuration="props" :session="session" v-bind="attrs">
    <template v-for="(_, name) in $slots" #[name]="bindings">
      <slot :name="name" v-bind="bindings" />
    </template>
  </FormRendering>
</template>
