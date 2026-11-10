<script
  setup
  lang="ts"
  generic="
    TInput extends object = Record<string, unknown>,
    TOutput extends object = Record<string, unknown>,
    TResult = unknown,
    TKeys extends string = Extract<keyof TInput, string>,
    TContext extends object = Readonly<Record<string, unknown>>,
    TFields extends object = {}
  "
>
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, useSlots, watch } from 'vue'
import { onBeforeRouteLeave, useRouter, type RouteLocationRaw } from 'vue-router'
import { toast } from 'vue-sonner'
import type { AfterSubmitContext, FormExposed, FormViewProps, FormViewSlots, RecordLoadContext, RouteTarget, SubmitError } from '../../contracts'
import Form from '../core/Form.vue'
import type { FormProps } from '../../forms/props'
import { useFrameworkAdapters } from '../../adapters/projectAdapters'
import { useLoader, stableValue } from '../../query'
import { recordCacheKey, instanceIdentity } from '../core/useCoreData'
import Button from '../base/Button.vue'
import Card from '../base/Card.vue'
import Dialog from '../base/Dialog.vue'
import NavigationHeader from './NavigationHeader.vue'
import { useFrameworkUiDefaults } from './uiDefaults'
import { withCurrentQuery } from './routeQuery'

const props = withDefaults(defineProps<FormViewProps<TInput, TOutput, TResult, TKeys, TContext, TFields>>(), { defaultTo: undefined, backTo: undefined })
defineSlots<FormViewSlots<TInput, TOutput, TResult, TKeys, TContext, TFields>>()
const source = computed(() => ('resolve' in props.form ? props.form : undefined))
const owner = instanceIdentity('form-view')
const sourceEpoch = ref(0)
watch(
  () => JSON.stringify(stableValue([source.value?.resource, source.value?.id, source.value?.namespace, source.value?.searchParameters])),
  () => {
    sourceEpoch.value += 1
  },
  { flush: 'sync' }
)
const sourceKey = computed(() =>
  recordCacheKey(source.value?.resource ?? owner, source.value?.id, 'form', source.value ? `${source.value.namespace}.${owner}.${sourceEpoch.value}` : undefined, source.value?.searchParameters ?? {})
)
const reader = useLoader<RecordLoadContext, object | undefined>({
  key: sourceKey,
  context: computed(() => ({ id: source.value?.id, searchParameters: source.value?.searchParameters ?? {} })),
  load: computed(() => source.value?.load),
})
const resolved = shallowRef<{ record: object; form: FormProps<TInput, TOutput, TResult, TKeys, TContext, TFields> }>()
const resolutionError = shallowRef<SubmitError>()
const adapters = useFrameworkAdapters()
watch(
  () => JSON.stringify(sourceKey.value),
  () => {
    resolved.value = undefined
    resolutionError.value = undefined
  },
  { flush: 'sync' }
)
function resolveRecord(record: object | undefined) {
  if (!record || !source.value || resolved.value) return
  try {
    resolved.value = { record, form: source.value.resolve(record) }
    resolutionError.value = undefined
  } catch (error) {
    resolutionError.value = adapters.data.normalizeError(error)
  }
}
watch(reader.data, resolveRecord, { immediate: true })
const loadError = computed(() => reader.error.value ?? resolutionError.value)
const record = computed(() => resolved.value?.record)
const configuredForm = computed(() =>
  source.value ? resolved.value && { ...resolved.value.form, disabled: source.value.disabled ?? resolved.value.form.disabled } : 'resolve' in props.form ? undefined : props.form
)
const saved = shallowRef<{ result: TResult; values: Readonly<Record<string, unknown>>; original?: object }>()
const useDefaultCompletion = computed(() => props.completion !== undefined && props.afterSubmit === undefined && props.defaultTo !== false)
const form = computed(() => configuredForm.value && { ...configuredForm.value, novalidate: configuredForm.value.novalidate ?? true, completeOnSubmit: useDefaultCompletion.value })
const savedDestinations = computed(() => {
  if (!saved.value) return []
  const explicit = props.defaultTo
  if (explicit !== undefined && explicit !== false) {
    const target = typeof explicit === 'function' ? explicit(saved.value.result) : explicit
    return target === undefined ? [] : [target]
  }
  return props.completion?.destinations(saved.value.result, saved.value.values, saved.value.original) ?? []
})
watch(
  () => JSON.stringify(stableValue([sourceKey.value, props.form.resource, props.form.id, props.form.namespace, props.form.searchParameters])),
  () => {
    saved.value = undefined
  },
  { flush: 'sync' }
)
const emit = defineEmits<{
  (event: 'submitted', result: TResult, refreshError?: SubmitError): void
  (event: 'error', error: SubmitError): void
}>()
const slots = useSlots()
const router = useRouter()
const { submitLabel: defaultSubmitLabel } = useFrameworkUiDefaults()
const submitLabel = computed(() => form.value?.submitLabel ?? defaultSubmitLabel)
const submittingLabel = computed(() => form.value?.submittingLabel ?? submitLabel.value)
const hasSubmit = computed(() => typeof form.value?.submit === 'function')
const instance = shallowRef<FormExposed<TInput, TOutput, TResult, TContext> | null>(null)
const draft = computed(() => instance.value?.draft)
const dirty = computed(() => instance.value?.dirty ?? false)
const submitting = computed(() => instance.value?.submitting ?? false)
const submitPending = computed(() => instance.value?.submitPending ?? false)
const postWriteError = computed(() => instance.value?.postWriteError)
const validating = computed(() => instance.value?.validating ?? false)
const inputPending = computed(() => instance.value?.inputPending ?? false)
const discardDialogOpen = ref(false)
const allowNextLeave = ref(false)
let resolvePendingLeave: ((allow: boolean) => void) | undefined

const formSlotNames = () => Object.keys(slots).filter((name) => name === 'loading' || name === 'load-error' || name.startsWith('input:'))

function validate() {
  return instance.value?.validate()
}

function submit(options?: Parameters<FormExposed<TInput, TOutput, TResult, TContext>['submit']>[0]) {
  return instance.value?.submit(options)
}

function reset() {
  instance.value?.reset()
}

async function refresh(): Promise<void> {
  if (source.value && !postWriteError.value) {
    await reader.refresh()
    resolveRecord(reader.data.value)
  } else await instance.value?.refresh()
}

defineExpose({ record, draft, dirty, submitting, submitPending, postWriteError, validating, inputPending, validate, submit, reset, refresh })

function settlePendingLeave(allow: boolean) {
  const resolve = resolvePendingLeave
  resolvePendingLeave = undefined
  discardDialogOpen.value = false
  resolve?.(allow)
}

async function retryNavigation() {
  const target = savedDestinations.value[0]
  if (!target) return
  allowNextLeave.value = true
  try {
    const navigation = await router.replace(withCurrentQuery(target, router.currentRoute.value.query, router) as RouteLocationRaw)
    if (navigation) allowNextLeave.value = false
  } catch {
    allowNextLeave.value = false
  }
}

async function submitted(result: TResult, refreshError?: SubmitError) {
  if (useDefaultCompletion.value) {
    const values = instance.value?.submittedValues ?? {}
    saved.value = { result, values: values as Readonly<Record<string, unknown>>, original: record.value }
    const message = props.successMessage === undefined ? 'Changes saved.' : props.successMessage
    if (message && refreshError === undefined) toast.success(message)
    if (refreshError === undefined) emit('submitted', result)
    else emit('submitted', result, refreshError)
    await retryNavigation()
    return
  }
  if (refreshError === undefined) emit('submitted', result)
  else emit('submitted', result, refreshError)
  const successMessage = props.successMessage === undefined ? 'Changes saved.' : props.successMessage
  if (successMessage && refreshError === undefined) toast.success(successMessage)

  let handled = false
  const navigate = async (to: RouteTarget) => {
    handled = true
    allowNextLeave.value = true
    try {
      const navigation = await router.replace(to as RouteLocationRaw)
      if (navigation) allowNextLeave.value = false
    } catch (error) {
      allowNextLeave.value = false
      throw error
    }
  }
  try {
    const target = props.defaultTo
    const destination = target === false ? undefined : typeof target === 'function' ? target(result) : target
    const defaultTo = destination === undefined ? undefined : withCurrentQuery(destination, router.currentRoute.value.query, router)
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
  if (saved.value || !instance.value?.dirty) return true

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
    () => !saved.value && (instance.value?.dirty ?? false),
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
        <slot v-if="saved" name="saved" :result="saved.result" :values="saved.values" :retry-navigation="retryNavigation">
          <div class="flex flex-col gap-3" role="status">
            <p>Changes saved.</p>
            <Button v-if="savedDestinations.length" type="button" variant="text" @click="retryNavigation()">Continue</Button>
          </div>
        </slot>
        <template v-else-if="!form">
          <slot v-if="reader.loading.value" name="loading"><p role="status">Memuat…</p></slot>
          <slot v-else-if="loadError" name="load-error" :error="loadError" :refresh="refresh">
            <p role="alert">{{ loadError.message }}</p>
            <Button type="button" variant="text" @click="refresh()">Coba lagi</Button>
          </slot>
          <p v-else>Data tidak ditemukan.</p>
        </template>
        <slot v-else name="body" v-bind="{ form }">
          <Form ref="instance" v-bind="form" @submitted="submitted" @error="emit('error', $event)">
            <template v-for="name in formSlotNames()" #[name]="slotProps" :key="name">
              <slot :name="name" v-bind="slotProps ?? {}" />
            </template>
            <template #actions="actions">
              <slot name="actions" v-bind="{ ...actions, refresh }">
                <div class="is-form-view-controls flex flex-col gap-2 border-t border-outline-variant pt-5 sm:flex-row sm:justify-end">
                  <Button type="button" variant="text" class="w-full sm:w-auto" :disabled="instance?.submitting || instance?.validating" @click="router.back()">Cancel</Button>
                  <Button v-if="hasSubmit" type="submit" class="w-full sm:w-auto" :disabled="form.disabled === true || actions.submitPending || postWriteError !== undefined || actions.inputPending">{{
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
      <slot name="footer" :draft="draft" />
    </footer>
  </section>
</template>
