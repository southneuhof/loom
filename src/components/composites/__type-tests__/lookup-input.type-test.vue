<script setup lang="ts">
import { h } from 'vue'
import { z } from 'zod/v4'
import type { CollectionLoadContext, CollectionResult } from '../../../contracts'
import type { LookupInputProps } from '../form-inputs/lookupInput.types'
import { defineTable } from '../../../tables/defineTable'
import LookupInput from '../form-inputs/LookupInput.vue'

const schema = z.object({ id: z.string(), name: z.string() })
type Role = z.output<typeof schema>
const roles: Role[] = [{ id: 'one', name: 'Admin' }]
const table = defineTable({ schema, columns: { name: {} } })
const load = async (_context: CollectionLoadContext): Promise<CollectionResult<Role>> => ({ data: roles })

const staticLookup = h(LookupInput, { table, data: roles })
const loadedLookup = h(LookupInput, { table, load, namespace: 'role-lookup' })
// @ts-expect-error LookupInput requires one data source.
const missingSource = h(LookupInput, { table })
// @ts-expect-error LookupInput rejects simultaneous data and load sources.
const competingSources = h(LookupInput, { table, data: roles, load })
// @ts-expect-error LookupInput table definitions cannot own data.
const tableData: LookupInputProps<Role> = { table: { ...table, data: roles }, data: roles }
// @ts-expect-error LookupInput table definitions cannot own a loader.
const tableLoad: LookupInputProps<Role> = { table: { ...table, load }, data: roles }

void [staticLookup, loadedLookup, missingSource, competingSources, tableData, tableLoad]
</script>

<template>
  <LookupInput :table="table" :data="roles" />
</template>
