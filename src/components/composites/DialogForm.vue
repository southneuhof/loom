<script setup lang="ts" generic="TInput extends object, TOutput extends object, TResult, TKeys extends Extract<keyof TInput, string> = Extract<keyof TInput, string>">
import { computed, getCurrentInstance, onBeforeUnmount, onBeforeUpdate, ref, useAttrs, useSlots, watch } from 'vue'
import type { FormDraftSnapshot, FormExposed } from '../../contracts/forms'
import type { SchemaParseResult } from '../../contracts/schema'
import type { SubmitError } from '../../contracts/results'
import type { DialogFormCloseContext, DialogFormCloseReason, DialogFormProps, DialogFormSlots, FormProps } from '../../forms/props'
import Button from '../base/Button.vue'
import Dialog from '../base/Dialog.vue'
import Form from '../core/Form.vue'
import { useFrameworkUiDefaults } from '../views/uiDefaults'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<DialogFormProps<TInput, TOutput, TResult, TKeys>>(), {
  closeOnSubmitted: true,
})
defineSlots<DialogFormSlots<TInput, TKeys>>()
const emit = defineEmits<{
  (event: 'update:modelValue', value: FormDraftSnapshot<TInput>): void
  (event: 'submitted', result: TResult): void
  (event: 'error', error: SubmitError): void
  (event: 'reset'): void
  (event: 'update:open', value: boolean): void
  (event: 'open'): void
  (event: 'close'): void
}>()

const instance = getCurrentInstance()
const attrs = useAttrs()
const slots = useSlots()
const form = ref<FormExposed<TInput, TOutput> | null>(null)
const localOpen = ref(false)
const checkingClose = ref(false)
const propRevision = ref(0)
const formMountGeneration = ref(0)
const dialogGeneration = ref(0)
const hasOpenModel = ref(hasCurrentProp('open'))
const hasDraftModel = ref(hasCurrentProp('modelValue'))
let closeOwnership = 0
let submitGeneration = 0
const { submitLabel: defaultSubmitLabel } = useFrameworkUiDefaults()

const componentPropOptions = (Form as unknown as { props?: readonly string[] | Readonly<Record<string, unknown>> }).props
const formPropNames = Array.isArray(componentPropOptions) ? componentPropOptions : Object.keys(componentPropOptions ?? {})
const forwardedPropNames = formPropNames

function hasCurrentProp(name: string): boolean {
  const vnodeProps = instance?.vnode.props ?? {}
  const kebab = name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
  return Object.hasOwn(vnodeProps, name) || Object.hasOwn(vnodeProps, kebab)
}

function hasProp(name: string): boolean {
  propRevision.value
  return hasCurrentProp(name)
}

function propValue(name: string): unknown {
  const key = name.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase())
  return Reflect.get(props, key)
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
  get: () => (hasOpenModel.value ? props.open === true : localOpen.value),
  set: (value: boolean) => {
    emit('update:open', value)
    if (!hasOpenModel.value) localOpen.value = value
  },
})

const formBindings = computed<FormProps<TInput, TOutput, TResult, TKeys>>(() => {
  propRevision.value
  const bindings = Object.fromEntries(forwardedPropNames.filter((name) => name !== 'class' && name !== 'style' && hasCurrentProp(name)).map((name) => [name, propValue(name)]))
  if (typeof props.submit === 'function' || hasDraftModel.value) return bindings as FormProps<TInput, TOutput, TResult, TKeys>
  throw new Error('[loom][FORM_BINDING_REQUIRED] DialogForm requires a function-valued submit prop or a present modelValue prop.')
})

const nativeFormAttrs = computed<Record<string, unknown>>(() => {
  propRevision.value
  return Object.fromEntries(Object.entries(attrs).filter(([name]) => name.startsWith('data-')))
})
const forwardedFormProps = computed<FormProps<TInput, TOutput, TResult, TKeys>>(
  () =>
    ({
      ...formBindings.value,
      ...nativeFormAttrs.value,
    }) as FormProps<TInput, TOutput, TResult, TKeys>
)
const formSlotNames = () => Object.keys(slots).filter((name) => name === 'loading' || name === 'load-error' || name.startsWith('input:'))
const dirty = computed(() => form.value?.dirty === true)
const submitting = computed(() => form.value?.submitting === true)
const submitPending = computed(() => form.value?.submitPending === true)
const validating = computed(() => form.value?.validating === true)
const inputPending = computed(() => form.value?.inputPending === true)
const draft = computed(() => form.value?.draft)
const submitLabel = computed(() => props.submitLabel ?? defaultSubmitLabel)
const submittingLabel = computed(() => props.submittingLabel ?? submitLabel.value)
const hasSubmit = computed(() => typeof props.submit === 'function')
const cancelDisabled = computed(() => props.disabled === true || submitting.value || submitPending.value || validating.value || checkingClose.value)
const submitDisabled = computed(() => props.disabled === true || submitting.value || submitPending.value || validating.value || inputPending.value || checkingClose.value)

watch(open, (value, previous) => {
  if (value === previous) return
  dialogGeneration.value += 1
  closeOwnership += 1
  checkingClose.value = false
})

onBeforeUpdate(() => {
  propRevision.value += 1

  const nextOpenPresence = hasCurrentProp('open')
  if (nextOpenPresence !== hasOpenModel.value) hasOpenModel.value = nextOpenPresence

  const nextDraftPresence = hasCurrentProp('modelValue')
  if (nextDraftPresence !== hasDraftModel.value) {
    hasDraftModel.value = nextDraftPresence
    formMountGeneration.value += 1
  }
})

onBeforeUnmount(() => {
  dialogGeneration.value += 1
  closeOwnership += 1
  checkingClose.value = false
})

async function requestClose(reason: DialogFormCloseReason): Promise<boolean> {
  if (!open.value || submitting.value || submitPending.value || validating.value || checkingClose.value) return false
  const generation = dialogGeneration.value
  const submittingGeneration = submitGeneration
  const owner = form.value
  const ownership = ++closeOwnership
  checkingClose.value = true
  try {
    const context: DialogFormCloseContext = {
      reason,
      dirty: dirty.value,
      submitting: submitting.value,
      validating: validating.value,
    }
    const approved = props.beforeClose ? await props.beforeClose(context) : true
    if (
      !approved ||
      ownership !== closeOwnership ||
      generation !== dialogGeneration.value ||
      !open.value ||
      form.value !== owner ||
      submittingGeneration !== submitGeneration ||
      submitting.value ||
      submitPending.value ||
      validating.value
    )
      return false
    open.value = false
    return true
  } catch {
    return false
  } finally {
    if (ownership === closeOwnership) checkingClose.value = false
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

function handleSubmitted(result: TResult, generation: number): void {
  if (generation !== dialogGeneration.value || !open.value) return
  emit('submitted', result)
  if (props.closeOnSubmitted !== false) open.value = false
}

function submit(): Promise<void> | undefined {
  submitGeneration += 1
  return form.value?.submit()
}

function noteSubmit(): void {
  submitGeneration += 1
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
  submitPending,
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
  <Dialog :model-value="open" :class="props.class" :style="props.style" @update:model-value="handleDialogModel" @open="emit('open')" @close="emit('close')">
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
          :key="formMountGeneration"
          ref="form"
          v-bind="forwardedFormProps"
          @submit.capture="noteSubmit"
          @update:model-value="emit('update:modelValue', $event)"
          @submitted="handleSubmitted($event, dialogGeneration)"
          @error="emit('error', $event)"
          @reset="emit('reset')"
        >
          <template v-for="name in formSlotNames()" :key="name" #[name]="slotProps">
            <slot :name="name" v-bind="slotProps" />
          </template>

          <template #actions="slotProps">
            <slot name="actions" v-bind="{ ...slotProps, submit, requestClose }">
              <div class="flex flex-col gap-2 border-t border-outline-variant pt-5 sm:flex-row sm:justify-end">
                <Button type="button" variant="text" class="w-full sm:w-auto" :disabled="cancelDisabled" @click="requestClose('cancel')">
                  {{ props.cancelLabel ?? 'Cancel' }}
                </Button>
                <Button v-if="hasSubmit" type="submit" class="w-full sm:w-auto" :disabled="submitDisabled || slotProps.submitPending || slotProps.inputPending">
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
