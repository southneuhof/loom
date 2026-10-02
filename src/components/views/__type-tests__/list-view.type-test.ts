import type { CollectionLoadContext, CollectionResult, FormDraft, QueryValues, RawSchema, TableProps } from '../../../contracts'
import type { ListFilters, ListViewProps } from '../../../contracts/views'
import ListView from '../ListView.vue'

type Role = { id: string; name: string }
type RoleQuery = { status?: 'active' | 'archived'; search?: string; page?: number; limit?: number }
type FilterInput = { state?: string }
type Assert<TValue extends true> = TValue
type Equal<TLeft, TRight> =
  (<T>() => T extends TLeft ? 1 : 2) extends <T>() => T extends TRight ? 1 : 2 ? ((<T>() => T extends TRight ? 1 : 2) extends <T>() => T extends TLeft ? 1 : 2 ? true : false) : false

const recordSchema: RawSchema<Role, Role> = {
  _input: null as unknown as Role,
  _output: null as unknown as Role,
  parseAsync: async (input: unknown) => input as Role,
}
const filterSchema: RawSchema<FilterInput, Pick<RoleQuery, 'status'>> = {
  _input: null as unknown as FilterInput,
  _output: null as unknown as Pick<RoleQuery, 'status'>,
  parseAsync: async (input: unknown) => ({ status: String((input as FilterInput).state) as RoleQuery['status'] }),
}
const table: TableProps<Role, RoleQuery> = {
  schema: recordSchema,
  columns: { name: { label: 'Name' } },
  query: { page: 1 },
  load: async (_context: CollectionLoadContext<RoleQuery>): Promise<CollectionResult<Role>> => ({ data: [] }),
}
const transformedFilters = {
  schema: filterSchema,
  fields: { state: { renderer: 'select', label: 'State', props: { data: [{ id: 'active', name: 'Active' }, { id: 'archived', name: 'Archived' }] } } },
  defaults: { state: 'active' },
  queryKeys: ['status'],
  toDraft: (query) => typeof query.status === 'string' ? { state: query.status } : {},
} satisfies ListFilters<RoleQuery, FilterInput>

ListView({ table, filters: transformedFilters })
ListView({ table: { ...table, reorderable: true } })
ListView({ table, actionLabels: { create: 'New Sale', view: 'Open Sale' } })

const identityWithoutDelete = { table, recordIdentity: (record: Role) => record.id }
type IdentityRequiresDelete = Assert<Equal<typeof identityWithoutDelete extends ListViewProps<Role, RoleQuery> ? true : false, false>>

const invalidFilters = {
  schema: {
    _input: null as unknown as FilterInput,
    _output: null as unknown as { unrelated: string },
    parseAsync: async () => ({ unrelated: 'value' }),
  },
  fields: { state: { renderer: 'text' } },
  queryKeys: ['status'],
  toDraft: (query: Readonly<QueryValues>) => typeof query.status === 'string' ? { state: query.status } : {},
}

// @ts-expect-error Filter schema output must be a partial table query.
const invalidDefinition: ListFilters<RoleQuery, FilterInput> = invalidFilters
void invalidDefinition

type InvalidQueryKeyFilters = Omit<typeof transformedFilters, 'queryKeys'> & { queryKeys: readonly ['missing'] }
type RejectsInvalidQueryKey = Assert<Equal<InvalidQueryKeyFilters extends ListFilters<RoleQuery, FilterInput> ? true : false, false>>
type InvalidDraftMapperFilters = Omit<typeof transformedFilters, 'toDraft'> & { toDraft: (query: Readonly<QueryValues>) => { state: number } }
type RejectsInvalidDraftMapper = Assert<Equal<InvalidDraftMapperFilters extends ListFilters<RoleQuery, FilterInput> ? true : false, false>>
type FilterDraftMapping = Assert<Equal<ListFilters<RoleQuery, FilterInput>['toDraft'], (query: Readonly<QueryValues>) => FormDraft<FilterInput>>>

// @ts-expect-error ListView accepts table bags only under the table property.
ListView({ ...table, fields: { name: { label: 'Name' } } })
