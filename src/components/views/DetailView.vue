<script setup lang="ts" generic="TRecord extends object = Record<string, unknown>, TContext extends object = Readonly<Record<string, unknown>>">
import { computed, useSlots } from 'vue'
import type { DetailViewProps, DetailViewReadyProps } from '../../contracts'
import { useRecord } from '../core/useRecord'
import Detail from '../core/Detail.vue'
import Card from '../base/Card.vue'
import NavigationHeader from './NavigationHeader.vue'
import type { RouteLocationRaw } from 'vue-router'

const props = defineProps<DetailViewProps<TRecord, TContext>>()
const detail = computed(() => props.detail)
const reader = useRecord(() => detail.value)
const readyProps = computed<DetailViewReadyProps<TRecord, TContext> | undefined>(() => {
  const record = reader.record.value
  if (!record) return undefined
  const { load: _load, data: _data, ...configuration } = detail.value
  return { record, detail: { ...configuration, data: record } }
})
const defaultBackTo: RouteLocationRaw = { name: 'dashboard' }
const backTo = computed(() => props.backTo === false ? undefined : props.backTo ?? defaultBackTo)
const slots = useSlots()
const detailSlotNames = () => Object.keys(slots).filter((name) => name.startsWith('value:'))
</script>

<template>
  <section class="is-detail-view flex flex-col gap-2">
    <NavigationHeader :title="title ?? ''" :back-to="backTo">
      <template v-if="$slots.controls" #controls>
        <slot
          name="controls"
          :record="reader.record.value"
          :loading="reader.loading.value"
          :error="reader.error.value"
          :refresh="reader.refresh"
        />
      </template>
    </NavigationHeader>

    <slot v-if="!reader.record.value && reader.loading.value" name="loading">
      <p role="status" aria-live="polite">Memuat…</p>
    </slot>
    <slot v-else-if="!reader.record.value && reader.error.value" name="error" :error="reader.error.value" :refresh="reader.refresh">
      <p role="alert">{{ reader.error.value.message }}</p>
    </slot>
    <slot v-else-if="!readyProps" name="empty">
      <p>Data tidak ditemukan.</p>
    </slot>
    <template v-else>
      <slot v-if="reader.error.value" name="read-error" :error="reader.error.value" :refresh="reader.refresh">
        <p role="alert">{{ reader.error.value.message }}</p>
      </slot>
      <slot v-if="$slots.body" name="body" v-bind="readyProps" />
      <Card v-else variant="outlined" color="surfaceContainer" class="p-0">
        <div class="p-3 sm:p-4">
          <Detail v-bind="readyProps.detail">
            <template v-for="name in detailSlotNames()" #[name]="slotProps" :key="name">
              <slot :name="name" v-bind="slotProps ?? {}" />
            </template>
          </Detail>
        </div>
      </Card>
    </template>
  </section>
</template>
