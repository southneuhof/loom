<script setup lang="ts" generic="TInput extends object = Record<string, unknown>, TOutput extends object = Record<string, unknown>, TResult = unknown">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRouter, type RouteLocationRaw } from 'vue-router'
import { toast } from 'vue-sonner'
import type { FormProps, MaybePromise, SubmitError } from '../../contracts'
import type { FormSubmissionContext } from './FormView.types'
import Form from '../core/Form.vue'
import Button from '../base/Button.vue'
import Card from '../base/Card.vue'
import Dialog from '../base/Dialog.vue'
import NavigationHeader from './NavigationHeader.vue'
import { useFrameworkUiDefaults } from './uiDefaults'

type FormViewProps<TInput extends object, TOutput extends object, TResult> = {
  form: FormProps<TInput, TOutput, TResult>
  title?: string
  description?: string
  backTo?: RouteLocationRaw
  defaultTo?: RouteLocationRaw | ((result: TResult) => RouteLocationRaw | undefined) | false
  afterSubmit?: (context: FormSubmissionContext<TResult>) => MaybePromise<void>
  successMessage?: string | false
  submitLabel?: string
  submittingLabel?: string
}

const props = defineProps<FormViewProps<TInput, TOutput, TResult>>()
const form = computed(() => props.form)
const emit = defineEmits<{
  (event: 'submitted', result: TResult): void
  (event: 'error', error: SubmitError): void
}>()
const router = useRouter()
const { submitLabel: defaultSubmitLabel } = useFrameworkUiDefaults()
const resolvedSubmitLabel = computed(() => props.submitLabel ?? defaultSubmitLabel)
const resolvedSubmittingLabel = computed(() => props.submittingLabel ?? resolvedSubmitLabel.value)
const instance = ref<{ submit: () => Promise<void>; reset: () => void; submitting: boolean; validating: boolean; dirty: boolean; inputPending: boolean } | null>(null)
const discardDialogOpen = ref(false)
const allowNextLeave = ref(false)
let resolvePendingLeave: ((allow: boolean) => void) | undefined

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
    const context: FormSubmissionContext<TResult> = {
      result,
      defaultTo,
      navigate,
      preventDefaultNavigation: () => { handled = true },
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
    { immediate: true },
  )
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', beforeUnload)
  settlePendingLeave(false)
})
</script>

<template>
  <section class="is-form-view flex flex-col gap-2">
    <NavigationHeader :title="title" :description="description" :back-to="backTo">
      <template v-if="$slots.header" #header><slot name="header" /></template>
      <template v-if="$slots.controls" #controls><slot name="controls" /></template>
    </NavigationHeader>

    <Card variant="outlined" color="surfaceContainer" class="p-0">
      <div class="p-5 sm:p-6">
        <slot name="body" v-bind="{ form }">
          <Form
            ref="instance"
            v-bind="form"
            @submitted="submitted"
            @error="emit('error', $event)"
          >
            <template v-for="(_, name) in $slots" #[name]="slotProps" :key="name">
              <slot :name="name" v-bind="slotProps ?? {}" />
            </template>
            <template #actions="actions">
              <slot
                name="form-actions"
                :submit="() => instance?.submit()"
                :reset="() => instance?.reset()"
                :input-pending="actions.inputPending"
              >
                <div class="is-form-view-controls flex flex-col gap-2 border-t border-outline-variant pt-5 sm:flex-row sm:justify-end">
                  <Button type="button" variant="text" class="w-full sm:w-auto" :disabled="instance?.submitting || instance?.validating" @click="router.back()">Cancel</Button>
                  <Button type="submit" class="w-full sm:w-auto" :disabled="instance?.submitting || instance?.validating || actions.inputPending">{{ instance?.submitting ? resolvedSubmittingLabel : resolvedSubmitLabel }}</Button>
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
