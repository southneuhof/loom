<script setup lang="ts" generic="TRecord extends object = Record<string, unknown>">
import { computed, useSlots } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import type { DetailProps } from '../../contracts'
import Detail from '../core/Detail.vue'
import Card from '../base/Card.vue'
import NavigationHeader from './NavigationHeader.vue'

const props = defineProps<{
  detail: DetailProps<TRecord>
  title?: string
  backTo?: RouteLocationRaw
}>()
const detail = computed(() => props.detail)
const slots = useSlots()
const detailSlots = computed(() => Object.entries(slots).filter(([name]) => name.startsWith('value:')))
</script>

<template>
  <section class="is-detail-view flex flex-col gap-2">
    <NavigationHeader :title="title ?? ''" :back-to="backTo ?? { name: 'dashboard' }">
      <template v-if="$slots.controls" #controls><slot name="controls" /></template>
    </NavigationHeader>

    <Card variant="outlined" color="surfaceContainer" class="p-0">
      <div class="p-3 sm:p-4">
        <Detail v-bind="detail">
          <template v-for="([name], index) in detailSlots" #[name]="slotProps" :key="index">
            <slot :name="name" v-bind="slotProps ?? {}" />
          </template>
        </Detail>
      </div>
    </Card>
  </section>
</template>
