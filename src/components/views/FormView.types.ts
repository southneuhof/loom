import type { RecordIdentity } from '../../contracts'
import type { RouteLocationRaw } from 'vue-router'

export interface FormSubmissionContext<TRecord extends object, TIdentity extends RecordIdentity> {
  record: TRecord
  id: TIdentity
  operation: 'create' | 'update'
  defaultTo: RouteLocationRaw | undefined
  navigate: (to: RouteLocationRaw) => Promise<void>
  preventDefaultNavigation: () => void
}
