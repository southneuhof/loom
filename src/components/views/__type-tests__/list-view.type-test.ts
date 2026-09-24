import type { CollectionLoadContext, CollectionResult, RawSchema, TableProps } from '../../../contracts'
import type { ListFilters } from '../ListView.vue'
import ListView from '../ListView.vue'

type Role = { id: string; name: string }
type RoleQuery = { status?: 'active' | 'archived'; search?: string; page?: number; limit?: number }
type FilterInput = { state?: string }

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
  fields: { state: { label: 'State' } },
  defaults: { state: 'active' },
} satisfies ListFilters<RoleQuery, FilterInput>

ListView({ table, filters: transformedFilters })
ListView({ table: { ...table, reorderable: true } })

const invalidFilters = {
  schema: {
    _input: null as unknown as FilterInput,
    _output: null as unknown as { unrelated: string },
    parseAsync: async () => ({ unrelated: 'value' }),
  },
  fields: { state: {} },
}

// @ts-expect-error Filter schema output must be a partial table query.
const invalidDefinition: ListFilters<RoleQuery, FilterInput> = invalidFilters
void invalidDefinition

// @ts-expect-error ListView accepts table bags only under the table property.
ListView({ ...table, fields: { name: { label: 'Name' } } })
