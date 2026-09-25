<script
  setup
  lang="ts"
  generic="
    TInput extends object = Record<string, unknown>,
    TOutput extends object = Record<string, unknown>,
    TResult = unknown,
    TKeys extends Extract<keyof TInput, string> = Extract<keyof TInput, string>
  "
>
import { computed, onBeforeUnmount, onMounted, ref, useSlots, watch } from 'vue'
import { onBeforeRouteLeave, useRouter, type RouteLocationRaw } from 'vue-router'
import { toast } from 'vue-sonner'
import type { AfterSubmitContext, FormExposed, FormViewProps, FormViewSlots, SubmitError } from '../../contracts'
import Form from '../core/Form.vue'
import Button from '../base/Button.vue'
import Card from '../base/Card.vue'
import Dialog from '../base/Dialog.vue'
import NavigationHeader from './NavigationHeader.vue'
import { useFrameworkUiDefaults } from './uiDefaults'

const props = defineProps<FormViewProps<TInput, TOutput, TResult, TKeys>>()
defineSlots<FormViewSlots<TInput, TOutput, TResult, TKeys>>()
const form = computed(() => props.form)
const emit = defineEmits<{
  (event: 'submitted', result: TResult): void
  (event: 'error', error: SubmitError): void
}>()
const slots = useSlots()
const router = useRouter()
const { submitLabel: defaultSubmitLabel } = useFrameworkUiDefaults()
const submitLabel = computed(() => props.form.submitLabel ?? defaultSubmitLabel)
const submittingLabel = computed(() => props.form.submittingLabel ?? submitLabel.value)
const hasSubmit = computed(() => typeof props.form.submit === 'function')
const instance = ref<FormExposed<TInput, TOutput> | null>(null)
const draft = computed(() => instance.value?.draft)
const dirty = computed(() => instance.value?.dirty ?? false)
const submitting = computed(() => instance.value?.submitting ?? false)
const submitPending = computed(() => instance.value?.submitPending ?? false)
const validating = computed(() => instance.value?.validating ?? false)
const inputPending = computed(() => instance.value?.inputPending ?? false)
const discardDialogOpen = ref(false)
const allowNextLeave = ref(false)
let resolvePendingLeave: ((allow: boolean) => void) | undefined

const formSlotNames = () => Object.keys(slots).filter((name) => name === 'loading' || name === 'load-error' || name.startsWith('input:'))

function validate() {
  return instance.value?.validate()
}

function submit() {
  return instance.value?.submit()
}

function reset() {
  instance.value?.reset()
}

function refresh() {
  return instance.value?.refresh()
}

defineExpose({ draft, dirty, submitting, submitPending, validating, inputPending, validate, submit, reset, refresh })

function settlePendingLeave(allow: boolean) {
  const resolve = resolvePendingLeave
  resolvePendingLeave = undefined
  discardDialogOpen.value = false
  resolve?.(allow)
}

async function submitted(result: TResult) {
  emit('submitted', result)
  const successMessage = props.successMessage === undefined ? 'Changes saved.' : props.successMessage
  if (successMessage) toast.success(successMessage)

  let handled = false
  const navigate = async (to: RouteLocationRaw) => {
    handled = true
    allowNextLeave.value = true
    try {
      const navigation = await router.replace(to)
      if (navigation) allowNextLeave.value = false
    } catch (error) {
      allowNextLeave.value = false
      throw error
    }
  }
  try {
    const target = props.defaultTo
    const defaultTo = target === false ? undefined : typeof target === 'function' ? target(result) : target
    const context: AfterSubmitContext<TResult> = {
      result,
      defaultTo,
      navigate,
      preventDefaultNavigation: () => {
        handled = true
      },
    }
    await props.afterSubmit?.(context)
    if (!handled && context.defaultTo) await navigate(context.defaultTo)
  } catch {
    toast.error('Changes saved, but the next action could not be completed.')
  }
}

onBeforeRouteLeave(() => {
  if (allowNextLeave.value) {
    allowNextLeave.value = false
    return true
  }
  if (!instance.value?.dirty) return true

  discardDialogOpen.value = true
  return new Promise<boolean>((resolve) => {
    resolvePendingLeave = resolve
  })
})

function beforeUnload(event: BeforeUnloadEvent) {
  event.preventDefault()
  event.returnValue = ''
}

onMounted(() => {
  watch(
    () => instance.value?.dirty ?? false,
    (dirty) => {
      if (dirty) window.addEventListener('beforeunload', beforeUnload)
      else window.removeEventListener('beforeunload', beforeUnload)
    },
    { immediate: true }
  )
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', beforeUnload)
  settlePendingLeave(false)
})
</script>

<template>
  <section class="is-form-view flex flex-col gap-2">
    <NavigationHeader :title="title" :description="description" :back-to="backTo === false ? undefined : backTo">
      <template v-if="$slots.header" #header><slot name="header" /></template>
      <template v-if="$slots.controls" #controls><slot name="controls" /></template>
    </NavigationHeader>

    <Card variant="outlined" color="surfaceContainer" class="p-0">
      <div class="p-5 sm:p-6">
        <slot name="body" v-bind="{ form }">
          <Form ref="instance" v-bind="form" @submitted="submitted" @error="emit('error', $event)">
            <template v-for="name in formSlotNames()" #[name]="slotProps" :key="name">
              <slot :name="name" v-bind="slotProps ?? {}" />
            </template>
            <template #actions="actions">
              <slot name="actions" v-bind="actions">
                <div class="is-form-view-controls flex flex-col gap-2 border-t border-outline-variant pt-5 sm:flex-row sm:justify-end">
                  <Button type="button" variant="text" class="w-full sm:w-auto" :disabled="instance?.submitting || instance?.validating" @click="router.back()">Cancel</Button>
                  <Button v-if="hasSubmit" type="submit" class="w-full sm:w-auto" :disabled="form.disabled === true || actions.submitPending || actions.inputPending">{{
                    instance?.submitting ? submittingLabel : submitLabel
                  }}</Button>
                </div>
              </slot>
            </template>
          </Form>
        </slot>
      </div>
    </Card>

    <Dialog v-model="discardDialogOpen" @close="settlePendingLeave(false)">
      <template #trigger><button type="button" class="sr-only" aria-hidden="true" tabindex="-1">Open discard changes dialog</button></template>
      <template #title>Discard unsaved changes?</template>
      <template #description>You have unsaved changes. If you leave now, they will be lost.</template>
      <template #footer>
        <Button type="button" variant="text" @click="settlePendingLeave(false)">Stay</Button>
        <Button type="button" color="error" @click="settlePendingLeave(true)">Discard changes</Button>
      </template>
    </Dialog>

    <footer>
      <slot name="footer" />
    </footer>
  </section>
</template>
