<script setup lang="ts" generic="TInput extends object, TOutput extends object, TResult">
import { computed, getCurrentInstance, ref, useAttrs, useSlots } from 'vue'
import type { SchemaParseResult } from '../../contracts/schema'
import type { SubmitError } from '../../contracts/results'
import type { FormProps } from '../../forms/props'
import type { DialogFormCloseContext, DialogFormCloseReason, DialogFormProps } from '../../forms/props'
import Button from '../base/Button.vue'
import Dialog from '../base/Dialog.vue'
import Form from '../core/Form.vue'
import { useFrameworkUiDefaults } from '../views/uiDefaults'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<DialogFormProps<TInput, TOutput, TResult>>(), {
  closeOnSubmitted: true,
})
const emit = defineEmits<{
  (event: 'update:modelValue', value: Partial<TInput>): void
  (event: 'submitted', result: TResult): void
  (event: 'error', error: SubmitError): void
  (event: 'reset'): void
  (event: 'update:open', value: boolean): void
  (event: 'open'): void
  (event: 'close'): void
}>()

interface FormHandle {
  draft: Partial<TInput>
  dirty: boolean
  submitting: boolean
  validating: boolean
  inputPending: boolean
  validate: () => Promise<SchemaParseResult<TOutput>>
  submit: () => Promise<void>
  reset: () => void
  refresh: () => Promise<void>
}

const instance = getCurrentInstance()
const vnodeProps = instance?.vnode.props ?? {}
const attrs = useAttrs()
const slots = useSlots()
const form = ref<FormHandle | null>(null)
const localOpen = ref(false)
const checkingClose = ref(false)
const hasOpenModel = Object.hasOwn(vnodeProps, 'open')
const hasDraftModel = Object.hasOwn(vnodeProps, 'modelValue') || Object.hasOwn(vnodeProps, 'model-value')
const { submitLabel: defaultSubmitLabel } = useFrameworkUiDefaults()

const nativeFormAttrs = computed<Record<string, unknown>>(() => Object.fromEntries(
  Object.entries(attrs).filter(([key]) => key === 'name' || key === 'autocomplete' || key.startsWith('aria-') || key.startsWith('data-')),
))

function hasProp(name: string): boolean {
  const kebab = name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
  return Object.hasOwn(vnodeProps, name) || Object.hasOwn(vnodeProps, kebab)
}

function rejectRemovedProps(): void {
  for (const name of ['run', 'form']) {
    if (hasProp(name)) {
      throw new Error(`[loom][SURFACE_OPTION_INVALID] DialogForm member "${name}" was removed; expected a flat Form prop bag.`)
    }
  }
}

rejectRemovedProps()

const open = computed({
  get: () => hasOpenModel ? props.open === true : localOpen.value,
  set: (value: boolean) => {
    emit('update:open', value)
    if (!hasOpenModel) localOpen.value = value
  },
})

const formBindings = computed<FormProps<TInput, TOutput, TResult>>(() => {
  const shared = {
    schema: props.schema,
    fields: props.fields,
    ...(hasProp('labels') ? { labels: props.labels } : {}),
    ...(hasProp('validators') ? { validators: props.validators } : {}),
    ...(hasDraftModel ? { modelValue: props.modelValue } : {}),
    ...(hasProp('initialData') ? { initialData: props.initialData } : {}),
    ...(hasProp('load') ? { load: props.load } : {}),
    ...(hasProp('id') ? { id: props.id } : {}),
    ...(hasProp('resource') ? { resource: props.resource } : {}),
    ...(hasProp('namespace') ? { namespace: props.namespace } : {}),
    ...(hasProp('searchParameters') ? { searchParameters: props.searchParameters } : {}),
    ...(hasProp('context') ? { context: props.context } : {}),
    ...(hasProp('normalizeError') ? { normalizeError: props.normalizeError } : {}),
    ...(hasProp('disabled') ? { disabled: props.disabled } : {}),
    ...(hasProp('submitLabel') ? { submitLabel: props.submitLabel } : {}),
    ...(hasProp('submittingLabel') ? { submittingLabel: props.submittingLabel } : {}),
  }
  if (typeof props.submit === 'function') return { ...shared, submit: props.submit }
  if (hasDraftModel) return { ...shared, modelValue: props.modelValue }
  throw new Error('[loom][FORM_BINDING_REQUIRED] DialogForm requires a function-valued submit prop or a present modelValue prop.')
})

const forwardedFormProps = computed(() => ({ ...formBindings.value, ...nativeFormAttrs.value }))
const formSlotNames = computed(() => Object.keys(slots).filter((name) => name === 'loading' || name === 'load-error' || name.startsWith('input:')))
const dirty = computed(() => form.value?.dirty === true)
const submitting = computed(() => form.value?.submitting === true)
const validating = computed(() => form.value?.validating === true)
const inputPending = computed(() => form.value?.inputPending === true)
const draft = computed(() => form.value?.draft)
const submitLabel = computed(() => props.submitLabel ?? defaultSubmitLabel)
const submittingLabel = computed(() => props.submittingLabel ?? submitLabel.value)
const hasSubmit = computed(() => typeof props.submit === 'function')
const cancelDisabled = computed(() => props.disabled === true || submitting.value || validating.value || checkingClose.value)
const submitDisabled = computed(() => props.disabled === true || submitting.value || validating.value || inputPending.value)

async function requestClose(reason: DialogFormCloseReason): Promise<boolean> {
  if (submitting.value || validating.value || checkingClose.value) return false
  checkingClose.value = true
  try {
    const context: DialogFormCloseContext = {
      reason,
      dirty: dirty.value,
      submitting: submitting.value,
      validating: validating.value,
    }
    const approved = props.beforeClose ? await props.beforeClose(context) : true
    if (!approved) return false
    open.value = false
    return true
  } catch {
    return false
  } finally {
    checkingClose.value = false
  }
}

function setOpen(value: boolean): void {
  if (value) open.value = true
  else void requestClose('dismiss')
}

function handleDialogModel(value: boolean): void {
  if (value === open.value) return
  setOpen(value)
}

function handleSubmitted(result: TResult): void {
  emit('submitted', result)
  if (props.closeOnSubmitted !== false) open.value = false
}

function submit(): Promise<void> | undefined {
  return form.value?.submit()
}

function validate(): Promise<SchemaParseResult<TOutput>> | undefined {
  return form.value?.validate()
}

function reset(): void {
  form.value?.reset()
}

function refresh(): Promise<void> | undefined {
  return form.value?.refresh()
}

defineExpose({
  draft,
  dirty,
  submitting,
  validating,
  inputPending,
  checkingClose,
  validate,
  submit,
  reset,
  refresh,
  requestClose,
})
</script>

<template>
  <Dialog
    :model-value="open"
    :class="attrs.class"
    :style="attrs.style"
    @update:model-value="handleDialogModel"
    @open="emit('open')"
    @close="emit('close')"
  >
    <template #trigger="triggerProps">
      <slot name="trigger" v-bind="triggerProps" :set-open="setOpen" />
    </template>

    <template v-if="props.title || $slots.title" #title>
      <slot name="title" :request-close="requestClose">{{ props.title }}</slot>
    </template>

    <template v-if="props.description || $slots.description" #description>
      <slot name="description" :request-close="requestClose">{{ props.description }}</slot>
    </template>

    <template #content>
      <div class="flex flex-col gap-5">
        <slot name="header" :request-close="requestClose" />

        <Form
          v-if="open"
          ref="form"
          v-bind="forwardedFormProps"
          @update:model-value="emit('update:modelValue', $event)"
          @submitted="handleSubmitted"
          @error="emit('error', $event)"
          @reset="emit('reset')"
        >
          <template v-for="name in formSlotNames" :key="name" #[name]="slotProps">
            <slot :name="name" v-bind="slotProps" />
          </template>

          <template #actions="slotProps">
            <slot name="actions" v-bind="{ ...slotProps, requestClose }">
              <div class="flex flex-col gap-2 border-t border-outline-variant pt-5 sm:flex-row sm:justify-end">
                <Button type="button" variant="text" class="w-full sm:w-auto" :disabled="cancelDisabled" @click="requestClose('cancel')">
                  {{ props.cancelLabel ?? 'Cancel' }}
                </Button>
                <Button v-if="hasSubmit" type="submit" class="w-full sm:w-auto" :disabled="submitDisabled">
                  {{ submitting ? submittingLabel : submitLabel }}
                </Button>
              </div>
            </slot>
          </template>
        </Form>

        <slot name="footer" :request-close="requestClose" />
      </div>
    </template>
  </Dialog>
</template>
