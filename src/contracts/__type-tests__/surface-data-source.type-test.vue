<script setup lang="ts">
import type { CollectionLoadContext, CollectionResult, RawSchema, RecordLoadContext, RecordResult } from '..'
import { defineResource } from '../../resources/defineResource'
import Collection from '../../components/core/Collection.vue'
import Detail from '../../components/core/Detail.vue'
import Table from '../../components/core/Table.vue'
import TableContent from '../../components/core/TableContent.vue'
import TreeTable from '../../components/core/TreeTable.vue'

type Row = { id: string; name: string }
type Query = { page: number; search?: string }

const row: Row = { id: 'one', name: 'One' }
const emptyRows: Row[] = []
const emptyInput: object = {}
const schema: RawSchema<object, Row> = {
  _input: emptyInput,
  _output: row,
  parseAsync: async () => row,
}
const columns = { name: { read: (record: Row) => record.name } }
const fields = { name: { read: (record: Row) => record.name } }
const loadRows = async ({ query }: CollectionLoadContext<Query>): Promise<CollectionResult<Row>> => {
  const page: number = query.page
  void page
  return { data: [] }
}
const loadRow = async ({ id }: RecordLoadContext): Promise<RecordResult<Row>> => ({ id: String(id), name: 'One' })
const children = (_record: Row): readonly Row[] => []
const resource = defineResource({
  key: 'surface-data-source-vue',
  identity: (record: Row) => record.id,
  list: {
    permission: null,
    table: { schema, columns, load: loadRows },
  },
  detail: {
    permission: null,
    detail: () => ({ schema, fields, load: loadRow }),
  },
})
const resourceTable = resource.list.table
const spreadResourceTable = { ...resourceTable }
const resourceDetail = resource.detail({ id: row.id }).detail
const spreadResourceDetail = { ...resourceDetail }
</script>

<template>
  <Collection :data="emptyRows" :query="{ page: 1 }" />
  <Collection :load="loadRows" />
  <Table :schema="schema" :columns="columns" :data="emptyRows" />
  <Table :schema="schema" :columns="columns" :load="loadRows" />
  <TreeTable :schema="schema" :columns="columns" :data="emptyRows" :children="children" tree-column="name" />
  <TreeTable :schema="schema" :columns="columns" :load="loadRows" :children="children" tree-column="name" />
  <Detail :schema="schema" :fields="fields" :data="row" />
  <Detail :schema="schema" :fields="fields" :load="loadRow" />
  <Table v-bind="resourceTable" />
  <Table v-bind="spreadResourceTable" />
  <Detail v-bind="resourceDetail" />
  <Detail v-bind="spreadResourceDetail" />
  <TableContent :schema="schema" :columns="columns" :records="emptyRows" :loading="false" :empty="true" :query="{ page: 1 }" />
</template>
