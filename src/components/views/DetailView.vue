<script setup lang="ts" generic="TRecord extends object = Record<string, unknown>">
import { computed, useSlots } from 'vue'
import type { DetailViewProps } from '../../contracts'
import Detail from '../core/Detail.vue'
import Card from '../base/Card.vue'
import NavigationHeader from './NavigationHeader.vue'
import type { RouteLocationRaw } from 'vue-router'

const props = defineProps<DetailViewProps<TRecord>>()
const detail = computed(() => props.detail)
const defaultBackTo: RouteLocationRaw = { name: 'dashboard' }
const backTo = computed(() => props.backTo === false ? undefined : props.backTo ?? defaultBackTo)
const slots = useSlots()
const detailSlotNames = () => Object.keys(slots).filter((name) => name === 'loading' || name === 'error' || name === 'empty' || name.startsWith('value:'))
</script>

<template>
  <section class="is-detail-view flex flex-col gap-2">
    <NavigationHeader :title="title ?? ''" :back-to="backTo">
      <template v-if="$slots.controls" #controls><slot name="controls" /></template>
    </NavigationHeader>

    <Card variant="outlined" color="surfaceContainer" class="p-0">
      <div class="p-3 sm:p-4">
        <Detail v-bind="detail">
          <template v-for="name in detailSlotNames()" #[name]="slotProps" :key="name">
            <slot :name="name" v-bind="slotProps ?? {}" />
          </template>
        </Detail>
      </div>
    </Card>
  </section>
</template>
