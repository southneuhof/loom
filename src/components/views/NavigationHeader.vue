<script setup lang="ts">
/**
 * Shared record navigation chrome.
 *
 * `backTo` renders a router link. Without it, the back control uses browser
 * history. `header` replaces title/description; `controls` adds page actions.
 */
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
  backTo?: RouteTarget
  backLabel?: string
}>()

const router = useRouter()
const backTarget = computed(() => props.backTo === undefined ? undefined : withCurrentQuery(props.backTo, router.currentRoute.value.query, router))
const { backLabel: defaultBackLabel } = useFrameworkUiDefaults()
</script>

<template>
  <Card variant="outlined" color="surfaceContainer" class="is-navigation-header gap-0 p-0">
    <header class="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">
      <div class="flex min-w-0 items-center gap-3">
        <RouterLink v-if="backTarget" v-slot="{ href, navigate }" custom :to="backTarget as RouteLocationRaw">
          <Button kind="icon" variant="standard" :href="href" :ariaLabel="backLabel ?? defaultBackLabel ?? 'Back'" @click="navigate">
            <template #icon><Icon name="arrow-left" /></template>
          </Button>
        </RouterLink>
        <Button v-else kind="icon" variant="standard" :ariaLabel="backLabel ?? defaultBackLabel ?? 'Back'" @click="router.back()">
          <template #icon><Icon name="arrow-left" /></template>
        </Button>

        <slot name="header">
          <div class="min-w-0">
            <h1 v-if="title" class="text-lg font-semibold leading-6 tracking-tight text-on-surface">{{ title }}</h1>
            <p v-if="description" class="mt-1 text-sm leading-5 text-on-surface-variant">{{ description }}</p>
          </div>
        </slot>
      </div>

      <div v-if="$slots.controls" class="flex flex-wrap items-center gap-2">
        <slot name="controls" />
      </div>
    </header>
  </Card>
</template>
