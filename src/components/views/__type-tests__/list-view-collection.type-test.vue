<script setup lang="ts">
import ListView from '../ListView.vue'
import type { CollectionLoadContext, CollectionResult } from '../../../contracts'

type Role = { id: string; name: string }
type RoleQuery = { state?: 'active' | 'archived' }

const table = {
  fields: { name: { label: 'Name' } },
  run: async (_context: CollectionLoadContext<RoleQuery>): Promise<CollectionResult<Role>> => ({ data: [] }),
}
</script>

<template>
  <ListView v-bind="table">
    <template #collection="{ records, query, meta, loading, error, empty, refresh, updateQuery, actions }">
      <span>{{ records[0]?.name }}</span>
      <span>{{ query.state }}</span>
      <span>{{ meta?.total }} {{ loading }} {{ error?.message }} {{ empty }}</span>
      <button type="button" @click="refresh()">Refresh</button>
      <button type="button" @click="updateQuery({ page: 1 })">Page</button>
      <template v-if="actions">
        <RouterLink v-if="actions.createRoute" :to="actions.createRoute">Create</RouterLink>
        <button type="button" @click="actions.detailRoute?.(records[0]!)">View</button>
        <button type="button" @click="actions.updateRoute?.(records[0]!)">Edit</button>
        <span v-if="actions.can?.('delete', records[0]!)" @click="actions.deleteRecord?.(records[0]!)">Delete</span>
      </template>
    </template>
  </ListView>
</template>
