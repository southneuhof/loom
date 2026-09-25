<script setup lang="ts" generic="TInput extends object, TOutput extends object, TResult, TKeys extends Extract<keyof TInput, string> = Extract<keyof TInput, string>">
import { computed, getCurrentInstance, onBeforeUpdate, reactive, ref, useAttrs, type WritableComputedRef } from 'vue'
import type { FormDraft, FormDraftSnapshot, FormSlots } from '../../contracts/forms'
import type { SubmitError } from '../../contracts/results'
import type { FormProps } from '../../forms/props'
import { formNativeAttributeNames } from '../../forms/props'
import { useFormSession } from '../../forms/useFormSession'
import { useRendererRegistry } from '../../renderers/registry'
import Button from '../base/Button.vue'
import { useFrameworkUiDefaults } from '../views/uiDefaults'

defineOptions({ inheritAttrs: false })

const props = defineProps<FormProps<TInput, TOutput, TResult, TKeys>>()
defineSlots<FormSlots<TInput, TKeys>>()
const attrs = useAttrs()
const componentProps = getCurrentInstance()?.type.props
const componentPropNames = Array.isArray(componentProps) ? componentProps : Object.keys(componentProps ?? {})
const nativePropNames = componentPropNames.filter((name) => formNativeAttributeNames.includes(name as (typeof formNativeAttributeNames)[number]) || name.startsWith('aria'))
const attrsRevision = ref(0)

const emit = defineEmits<{
  (event: 'update:modelValue', value: FormDraftSnapshot<TInput>): void
  (event: 'submitted', result: TResult): void
  (event: 'error', error: SubmitError): void
  (event: 'reset'): void
}>()

const controlGenerations = reactive(new Map<string, number>())
const fieldModels = new Map<string, WritableComputedRef<unknown>>()
const session = useFormSession(props, {
  updateModel: (value) => emit('update:modelValue', value),
  submitted: (result) => emit('submitted', result),
  error: (error) => emit('error', error),
  reset: () => emit('reset'),
})
const inputPending = session.inputPending
const renderers = useRendererRegistry('form')
const { submitLabel: defaultSubmitLabel } = useFrameworkUiDefaults()
const visibleFields = computed(() =>
  session.visibleFields.value.map((field) => ({
    ...field,
    key: field.key as TKeys,
  }))
)
const draft = session.draft
const behavior = session.behavior
const loading = session.loading
const loadError = session.loadError
const dirty = session.dirty
const submitting = session.submitting
const submitPending = session.submitPending
const validating = session.validating
const issues = session.issues
const hasSubmit = session.hasSubmit
const submitLabel = computed(() => props.submitLabel ?? defaultSubmitLabel)
const nativeFormBindings = computed<Record<string, unknown>>(() => {
  attrsRevision.value
  const declared: Record<string, unknown> = {}
  for (const name of nativePropNames) {
    const prop = name.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase())
    const attribute = name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
    const value = Reflect.get(props, prop)
    if (value !== undefined) declared[attribute] = value
  }
  for (const [name, value] of Object.entries(attrs)) {
    if (name === 'class' || name === 'style' || name.startsWith('data-')) declared[name] = value
  }
  return declared
})

onBeforeUpdate(() => {
  attrsRevision.value += 1
})

function fieldState(key: string) {
  return behavior.value.state(key).value
}

function fieldRenderer(key: string): string {
  const field = session.compiled.value.fields.find((entry) => entry.key === key)
  if (!field) throw new Error(`[loom][FORM_FIELD_UNKNOWN] Form field "${key}" is not selected.`)
  return fieldState(key).renderer ?? field.renderer
}

function fieldComponentKey(key: string): string {
  return `${fieldRenderer(key)}:${controlGenerations.get(key) ?? 0}`
}

function fieldSpan(key: string): number {
  const field = session.compiled.value.fields.find((entry) => entry.key === key)
  return Math.min(12, Math.max(1, fieldState(key).span ?? field?.span ?? 12))
}

function fieldLabel(key: string): string {
  return fieldState(key).label
}

function fieldValue<TKey extends TKeys>(key: TKey): FormDraftSnapshot<TInput>[TKey] {
  return draft.value[key]
}

function fieldModel(key: string): WritableComputedRef<unknown> {
  const existing = fieldModels.get(key)
  if (existing) return existing
  const model = computed({
    get: () => session.controlValue(key),
    set: (value: unknown) => session.setControlValue(key, value),
  })
  fieldModels.set(key, model)
  return model
}

function setSlotValue<TKey extends TKeys>(key: TKey, value: FormDraft<TInput>[TKey]): void {
  session.setValue(key, value)
}

function issueFor(key: string): string | undefined {
  return session.issueFor(key)
}

function fieldId(key: string): string {
  const configured = fieldState(key).props.id
  return typeof configured === 'string' ? configured : `${session.formId}-field-${key}`
}

function fieldDisabled(key: string): boolean {
  const state = fieldState(key)
  return props.disabled === true || state.disabled || state.props.disabled === true
}

function fieldAriaInvalid(key: string): unknown {
  return issueFor(key) ? 'true' : fieldState(key).props['aria-invalid']
}

function fieldAriaRequired(key: string): unknown {
  return fieldState(key).required ? 'true' : fieldState(key).props['aria-required']
}

function fieldAriaDescribedBy(key: string): string | undefined {
  const authored = fieldState(key).props['aria-describedby']
  const errorId = issueFor(key) ? `${session.formId}-error-${key}` : undefined
  const values = [typeof authored === 'string' ? authored : undefined, errorId].filter((value): value is string => value !== undefined)
  return values.length > 0 ? [...new Set(values)].join(' ') : undefined
}

const formIssues = computed(() =>
  issues.value.filter((issue) => {
    const key = issue.path[0]
    return issue.path.length === 0 || typeof key !== 'string' || !session.visibleKeys.value.includes(key)
  })
)

function setControlValue(key: string, value: unknown): void {
  session.setControlValue(key, value)
}

async function submit(): Promise<void> {
  await session.submit()
}

function reset(): void {
  for (const key of session.controlErrorKeys()) {
    controlGenerations.set(key, (controlGenerations.get(key) ?? 0) + 1)
  }
  session.reset()
}

defineExpose({
  draft,
  dirty,
  submitting,
  submitPending,
  validating,
  inputPending,
  validate: session.validate,
  submit,
  reset,
  refresh: session.refresh,
})
</script>

<template>
  <form v-bind="nativeFormBindings" :id="session.formId" :novalidate="props.novalidate === '' ? true : (props.novalidate ?? true)" class="flex flex-col gap-5" @submit.prevent="submit">
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
        <div v-for="field in visibleFields" :key="field.key" class="is-form-field flex min-w-0 flex-col gap-2" :style="{ gridColumn: `span ${fieldSpan(field.key)} / span ${fieldSpan(field.key)}` }">
          <label :for="fieldId(field.key)" class="text-sm font-medium leading-5 text-on-surface">
            {{ fieldLabel(field.key) }}
            <span v-if="fieldState(field.key).required" class="text-error" aria-hidden="true">*</span>
          </label>

          <slot
            :name="`input:${field.key}`"
            :value="fieldValue(field.key)"
            :draft="draft"
            :field="{ ...field, label: fieldLabel(field.key) }"
            :set-value="(value: FormDraft<TInput>[TKeys]) => setSlotValue(field.key, value)"
            :error="issueFor(field.key)"
            :touched="session.touchedField(field.key)"
            :disabled="fieldDisabled(field.key)"
            :validating="session.validatingField(field.key)"
            :form-validating="validating"
          >
            <component
              :is="renderers.require(fieldRenderer(field.key))"
              :key="fieldComponentKey(field.key)"
              v-bind="fieldState(field.key).props"
              v-model="fieldModel(field.key).value"
              :id="fieldId(field.key)"
              :error="issueFor(field.key)"
              :required="fieldState(field.key).required"
              :disabled="fieldDisabled(field.key)"
              :aria-invalid="fieldAriaInvalid(field.key)"
              :aria-required="fieldAriaRequired(field.key)"
              :aria-describedby="fieldAriaDescribedBy(field.key)"
              @validation:touch="session.touch(field.key)"
              @validation:error="session.setControlError(field.key, $event)"
            />
          </slot>

          <p v-if="issueFor(field.key)" :id="`${session.formId}-error-${field.key}`" role="alert" class="text-sm leading-5 text-error">
            {{ issueFor(field.key) }}
          </p>
        </div>
      </div>

      <slot name="actions" :submit="submit" :reset="reset" :submitting="submitting" :submit-pending="submitPending" :validating="validating" :dirty="dirty" :input-pending="inputPending">
        <Button v-if="hasSubmit" type="submit" :disabled="props.disabled === true || loading || submitPending || submitting || inputPending">
          {{ submitting ? (props.submittingLabel ?? submitLabel) : submitLabel }}
        </Button>
      </slot>
    </template>
  </form>
</template>
