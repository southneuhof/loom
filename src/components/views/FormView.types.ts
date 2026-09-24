import type { RouteLocationRaw } from 'vue-router'

export interface FormSubmissionContext<TResult> {
  result: TResult
  defaultTo: RouteLocationRaw | undefined
  navigate: (to: RouteLocationRaw) => Promise<void>
  preventDefaultNavigation: () => void
}
