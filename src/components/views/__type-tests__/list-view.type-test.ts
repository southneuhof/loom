import ListView from '../ListView.vue'
import type { CollectionLoadContext, CollectionResult } from '../../../contracts'

type Role = { id: string; name: string }
type RoleQuery = { state?: 'active' | 'archived' }

const roles = {
  run: async (_context: CollectionLoadContext<RoleQuery>): Promise<CollectionResult<Role>> => ({ data: [] }),
  fields: { name: { label: 'Name' } },
  namespace: 'roles',
  searchParameters: {},
}

ListView({
  ...roles,
  filters: { fields: { state: { label: 'State' } } },
})

ListView({
  ...roles,
  reorderable: true,
  rowKey: 'id',
})
