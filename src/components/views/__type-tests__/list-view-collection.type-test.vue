<script setup lang="ts">
import { z } from 'zod'
import ListView from '../ListView.vue'
import type { CollectionLoadContext, CollectionResult, TableProps } from '../../../contracts'

type Role = { id: string; name: string }
type RoleQuery = { state?: 'active' | 'archived' }

const table: TableProps<Role, RoleQuery> = {
  schema: z.object({ id: z.string(), name: z.string() }),
  columns: { name: { label: 'Name' } },
  query: { state: 'active' },
  load: async (_context: CollectionLoadContext<RoleQuery>): Promise<CollectionResult<Role>> => ({ data: [] }),
}
</script>

<template>
  <ListView :table="table">
    <template #collection="{ records, query, meta, loading, error, empty, refresh, updateQuery, actions }">
      <span>{{ records[0]?.name }}</span>
      <span>{{ query.state }}</span>
      <span>{{ meta?.total }} {{ loading }} {{ error?.message }} {{ empty }}</span>
      <button type="button" @click="refresh()">Refresh</button>
      <button type="button" @click="updateQuery({ page: 1 })">Page</button>
      <template v-if="actions">
        <RouterLink v-if="actions.createRoute" :to="actions.createRoute">Create</RouterLink>
        <button type="button" @click="typeof actions.detailRoute === 'function' && actions.detailRoute(records[0]!)">View</button>
        <button type="button" @click="typeof actions.updateRoute === 'function' && actions.updateRoute(records[0]!)">Edit</button>
        <span v-if="actions.can?.('delete', records[0]!)" @click="actions.deleteRecord?.(records[0]!)">Delete</span>
      </template>
    </template>
  </ListView>
</template>
