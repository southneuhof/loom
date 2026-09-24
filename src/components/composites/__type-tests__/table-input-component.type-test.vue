<script setup lang="ts">
import { ref } from 'vue'
import { z } from 'zod/v4'
import { defineForm } from '../../../forms/defineForm'
import { defineTable } from '../../../tables/defineTable'
import TableInput from '../form-inputs/TableInput.vue'
import type { TableInputForm, TableInputTable } from '../form-inputs/tableInput.types'

const rowSchema = z.object({ id: z.string(), name: z.string() })
const inputSchema = z.object({ id: z.string().default('new'), label: z.string() }).transform(({ id, label }) => ({ id, name: label }))
type Row = z.output<typeof rowSchema>
type Input = z.input<typeof inputSchema>

const table: TableInputTable<Row> = defineTable({ schema: rowSchema, columns: { name: {} } })
const form: TableInputForm<Input, Row> = defineForm({ schema: inputSchema, fields: { label: { renderer: 'text' } } })
const rows = ref<Row[]>([])
const toDraft = (row: Row): Partial<Input> => ({ id: row.id, label: row.name })
</script>

<template>
  <TableInput v-model="rows" :table="table" :form="form" :to-draft="toDraft" />
</template>
