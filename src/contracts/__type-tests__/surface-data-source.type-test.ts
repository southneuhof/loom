import type {
  CollectionLoadContext,
  CollectionProps,
  CollectionResult,
  DetailProps,
  RawSchema,
  RecordLoadContext,
  RecordResult,
  TableContentProps,
  TableProps,
  TreeTableProps,
} from '..'
import { defineResource } from '../../resources/defineResource'

type Row = { id: string; name: string }
type Query = { page: number; search?: string }
type Assert<TValue extends true> = TValue
type Equal<TLeft, TRight> =
  (<T>() => TLeft extends T ? 1 : 2) extends <T>() => TRight extends T ? 1 : 2
    ? ((<T>() => TRight extends T ? 1 : 2) extends <T>() => TLeft extends T ? 1 : 2 ? true : false)
    : false

const row: Row = { id: 'one', name: 'One' }
const emptyInput: object = {}
const schema: RawSchema<object, Row> = {
  _input: emptyInput,
  _output: row,
  parseAsync: async () => row,
}
const columns = { name: { read: (record: Row) => record.name } }
const loadRows = async ({ query }: CollectionLoadContext<Query>): Promise<CollectionResult<Row>> => {
  const page: number = query.page
  void page
  return { data: [] }
}
const loadRow = async ({ id }: RecordLoadContext): Promise<RecordResult<Row>> => ({ id: String(id), name: 'One' })

const controlledCollection: CollectionProps<Row, Query> = { data: [], query: { page: 1 } }
const loadedCollection: CollectionProps<Row, Query> = { load: loadRows }
const spreadDataSource: { data: Row[] } = { data: [] }
const spreadCollection: CollectionProps<Row, Query> = { ...spreadDataSource }
const controlledTable: TableProps<Row, Query> = { schema, columns, data: [] }
const loadedTable: TableProps<Row, Query> = { schema, columns, load: loadRows }
const loadedTableBase = { schema, columns, query: { page: 1 } }
const spreadLoadedTable: TableProps<Row, Query> = { ...loadedTableBase, load: loadRows }
const controlledTreeTable: TreeTableProps<Row, Query> = {
  schema,
  columns,
  data: [],
  children: () => [],
  treeColumn: 'name',
}
const loadedTreeTable: TreeTableProps<Row, Query> = {
  schema,
  columns,
  load: loadRows,
  children: () => [],
  treeColumn: 'name',
}
const controlledDetail: DetailProps<Row> = { schema, fields: { name: {} }, data: row }
const loadedDetail: DetailProps<Row> = { schema, fields: { name: {} }, load: loadRow }
const loadedContent: TableContentProps<Row, Query> = {
  schema,
  columns,
  records: [],
  loading: false,
  empty: true,
  query: { page: 1 },
}

const resource = defineResource({
  key: 'surface-data-source',
  identity: (record: Row) => record.id,
  list: {
    permission: null,
    table: { schema, columns, load: loadRows },
  },
  detail: {
    permission: null,
    detail: () => ({ schema, fields: { name: {} }, load: loadRow }),
  },
})
const extractedTable: TableProps<Row, Query> = resource.list.table
const spreadExtractedTable: TableProps<Row, Query> = { ...resource.list.table }
const extractedDetail: DetailProps<Row> = resource.detail({ id: row.id }).detail
const spreadExtractedDetail: DetailProps<Row> = { ...resource.detail({ id: row.id }).detail }
const resourceQuery: Query = { page: 1 }
const extractedLoad: Promise<CollectionResult<Row>> = resource.list.table.load({ query: resourceQuery, searchParameters: {} })
const detailLoad: Promise<Row | undefined> = resource.detail({ id: row.id }).detail.load({ id: row.id, searchParameters: {} })
type ExtractedQueryIsPreserved = Assert<Equal<Parameters<typeof resource.list.table.load>[0]['query'], Query>>

void [
  controlledCollection,
  loadedCollection,
  spreadCollection,
  controlledTable,
  loadedTable,
  spreadLoadedTable,
  controlledTreeTable,
  loadedTreeTable,
  controlledDetail,
  loadedDetail,
  loadedContent,
  extractedTable,
  spreadExtractedTable,
  extractedDetail,
  spreadExtractedDetail,
  extractedLoad,
  detailLoad,
]
