<script setup lang="ts" generic="TInput extends object, TOutput extends object, TResult">
import { computed } from 'vue'
import type { SubmitError } from '../../contracts/results'
import type { FormProps } from '../../forms/props'
import { useFormSession } from '../../forms/useFormSession'
import { useRendererRegistry } from '../../renderers/registry'
import Button from '../base/Button.vue'
import { useFrameworkUiDefaults } from '../views/uiDefaults'

const props = defineProps<FormProps<TInput, TOutput, TResult>>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: Partial<TInput>): void
  (event: 'submitted', result: TResult): void
  (event: 'error', error: SubmitError): void
  (event: 'reset'): void
}>()

const session = useFormSession(props, {
  updateModel: (value) => emit('update:modelValue', value),
  submitted: (result) => emit('submitted', result),
  error: (error) => emit('error', error),
  reset: () => emit('reset'),
})
const renderers = useRendererRegistry('form')
const { submitLabel: defaultSubmitLabel } = useFrameworkUiDefaults()
const visibleFields = session.visibleFields
const behavior = session.behavior
const loading = session.loading
const loadError = session.loadError
const dirty = session.dirty
const submitting = session.submitting
const validating = session.validating
const inputPending = session.inputPending
const issues = session.issues
const hasSubmit = session.hasSubmit
const submitLabel = computed(() => props.submitLabel ?? defaultSubmitLabel)

function fieldState(key: string) {
  return behavior.value.state(key).value
}

function fieldRenderer(key: string): string {
  const field = session.compiled.value.fields.find((entry) => entry.key === key)
  if (!field) throw new Error(`[loom][FORM_FIELD_UNKNOWN] Form field "${key}" is not selected.`)
  return fieldState(key).renderer ?? field.renderer
}

function fieldSpan(key: string): number {
  const field = session.compiled.value.fields.find((entry) => entry.key === key)
  return Math.min(12, Math.max(1, fieldState(key).span ?? field?.span ?? 12))
}

function fieldLabel(key: string): string {
  return fieldState(key).label
}

function fieldValue(key: string): unknown {
  return Reflect.get(session.draft, key)
}

function issueFor(key: string): string | undefined {
  return session.issueFor(key)
}

function fieldId(key: string): string {
  return `${session.formId}-field-${key}`
}

const formIssues = computed(() => issues.value.filter((issue) => {
  const key = issue.path[0]
  return issue.path.length === 0 || typeof key !== 'string' || !session.visibleKeys.value.includes(key)
}))

function setControlValue(key: string, value: unknown): void {
  session.setControlValue(key, value)
}

async function submit(): Promise<void> {
  await session.submit()
}

defineExpose({
  draft: session.draft,
  dirty,
  submitting,
  validating,
  inputPending,
  validate: session.validate,
  submit,
  reset: session.reset,
  refresh: session.refresh,
})
</script>

<template>
  <form :id="session.formId" novalidate class="flex flex-col gap-5" @submit.prevent="submit">
    <slot v-if="loading" name="loading">
      <div class="rounded-lg bg-surface-container px-4 py-3 text-sm text-on-surface">
        <p role="status" aria-live="polite">Loading…</p>
      </div>
    </slot>

    <template v-else-if="loadError">
      <slot name="load-error" :error="loadError" :refresh="session.refresh">
        <div class="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-error-container px-4 py-3 text-on-error-container">
          <p role="alert" class="text-sm leading-5">{{ loadError.message }}</p>
          <Button type="button" variant="text" class="min-w-0 px-4" @click="session.refresh">Retry</Button>
        </div>
      </slot>
    </template>

    <template v-else>
      <p v-if="formIssues.length > 0" :id="`${session.formId}-errors`" role="alert" class="rounded-lg bg-error-container px-4 py-3 text-sm leading-5 text-on-error-container">
        {{ formIssues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ') }}
      </p>

      <div class="grid grid-cols-12 gap-x-4 gap-y-5">
        <div
          v-for="field in visibleFields"
          :key="field.key"
          class="is-form-field flex min-w-0 flex-col gap-2"
          :style="{ gridColumn: `span ${fieldSpan(field.key)} / span ${fieldSpan(field.key)}` }"
        >
          <label :for="fieldId(field.key)" class="text-sm font-medium leading-5 text-on-surface">
            {{ fieldLabel(field.key) }}
            <span v-if="fieldState(field.key).required" class="text-error" aria-hidden="true">*</span>
          </label>

          <slot
            :name="`input:${field.key}`"
            :value="fieldValue(field.key)"
            :draft="session.draft"
            :field="{ ...field, label: fieldLabel(field.key) }"
            :set-value="(value: unknown) => session.setValue(field.key, value)"
            :error="issueFor(field.key)"
            :touched="session.touchedField(field.key)"
            :disabled="props.disabled === true || fieldState(field.key).disabled"
            :validating="session.validatingField(field.key)"
            :form-validating="validating"
          >
            <component
              :is="renderers.require(fieldRenderer(field.key))"
              :key="fieldRenderer(field.key)"
              :id="fieldId(field.key)"
              v-bind="fieldState(field.key).props"
              :value="session.controlValue(field.key)"
              :draft="session.draft"
              :field="field"
              :set-value="(value: unknown) => setControlValue(field.key, value)"
              :error="issueFor(field.key)"
              :touched="session.touchedField(field.key)"
              :disabled="props.disabled === true || fieldState(field.key).disabled"
              :validating="session.validatingField(field.key)"
              :form-validating="validating"
              :aria-invalid="issueFor(field.key) ? 'true' : undefined"
              :aria-required="fieldState(field.key).required ? 'true' : undefined"
              :aria-describedby="issueFor(field.key) ? `${session.formId}-error-${field.key}` : undefined"
              @validation:touch="session.touch(field.key)"
            />
          </slot>

          <p v-if="issueFor(field.key)" :id="`${session.formId}-error-${field.key}`" role="alert" class="text-sm leading-5 text-error">
            {{ issueFor(field.key) }}
          </p>
        </div>
      </div>

      <slot name="actions" :submit="submit" :reset="session.reset" :submitting="submitting" :validating="validating" :dirty="dirty" :input-pending="inputPending">
        <Button v-if="hasSubmit" type="submit" :disabled="props.disabled === true || loading || validating || submitting || inputPending">
          {{ submitting ? (props.submittingLabel ?? submitLabel) : submitLabel }}
        </Button>
      </slot>
    </template>
  </form>
</template>
