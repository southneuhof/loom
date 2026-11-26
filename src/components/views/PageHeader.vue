<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRouter, type RouteLocationRaw } from 'vue-router'
import type { RouteTarget } from '../../contracts/views'
import Button from '../base/Button.vue'
import Card from '../base/Card.vue'
import Icon from '../base/Icon.vue'
import { useFrameworkUiDefaults } from './uiDefaults'
import { withCurrentQuery } from './routeQuery'

const props = defineProps<{
  title?: string
  description?: string
  backTo?: RouteTarget | 'history'
  backLabel?: string
}>()

const router = useRouter()
const backTarget = computed(() =>
  props.backTo === undefined || props.backTo === 'history'
    ? undefined
    : withCurrentQuery(props.backTo, router.currentRoute.value.query, router),
)
const { backLabel: defaultBackLabel } = useFrameworkUiDefaults()
const resolvedBackLabel = computed(() => props.backLabel ?? defaultBackLabel ?? 'Back')
</script>

<template>
  <Card variant="outlined" color="surfaceContainer" class="is-page-header gap-0 p-0">
    <header class="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">
      <div class="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
        <div class="flex min-w-0 items-center gap-3">
          <RouterLink v-if="backTarget" v-slot="{ href, navigate }" custom :to="backTarget as RouteLocationRaw">
            <Button type="button" kind="icon" variant="standard" :href="href" :ariaLabel="resolvedBackLabel" @click="navigate">
              <template #icon><Icon name="arrow-left" /></template>
            </Button>
          </RouterLink>
          <Button v-else-if="props.backTo === 'history'" type="button" kind="icon" variant="standard" :ariaLabel="resolvedBackLabel" @click="router.back()">
            <template #icon><Icon name="arrow-left" /></template>
          </Button>

          <slot name="header">
            <div class="min-w-0">
              <h1 v-if="title" class="text-lg font-semibold leading-6 tracking-tight text-on-surface">{{ title }}</h1>
              <p v-if="description" class="mt-1 text-sm leading-5 text-on-surface-variant">{{ description }}</p>
            </div>
          </slot>
        </div>

        <div v-if="$slots.toolbar" class="flex flex-wrap items-center gap-2">
          <slot name="toolbar" />
        </div>
      </div>

      <div v-if="$slots.controls" class="flex flex-wrap items-center justify-end gap-2">
        <slot name="controls" />
      </div>
    </header>

    <div v-if="$slots.subbar" class="border-t border-outline-variant px-5 py-3 sm:px-6">
      <slot name="subbar" />
    </div>
  </Card>
</template>
