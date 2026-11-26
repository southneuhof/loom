import { inject, type InjectionKey } from 'vue'

export interface FrameworkUiDefaultsInput {
  locale?: string
  backLabel?: string
  submitLabel?: string
  loadingLabel?: string
  notFoundLabel?: string
  retryLabel?: string
  exportLabel?: string
  exportPdfLabel?: string
  exportXlsxLabel?: string
  addLabel?: string
  addRowLabel?: string
  editRowLabel?: string
  cancelLabel?: string
  confirmTitle?: string
  confirmMessage?: string
  removeLabel?: string
  expandLabel?: string
  collapseLabel?: string
}

export interface ResolvedFrameworkUiDefaults {
  locale: string
  backLabel?: string
  submitLabel: string
  loadingLabel: string
  notFoundLabel: string
  retryLabel: string
  exportLabel: string
  exportPdfLabel: string
  exportXlsxLabel: string
  addLabel: string
  addRowLabel: string
  editRowLabel: string
  cancelLabel: string
  confirmTitle: string
  confirmMessage: string
  removeLabel: string
  expandLabel: string
  collapseLabel: string
}

export const frameworkUiDefaultsKey: InjectionKey<ResolvedFrameworkUiDefaults> =
  Symbol.for('loom-ui-defaults')

export function resolveFrameworkUiDefaults(
  input: FrameworkUiDefaultsInput = {},
): ResolvedFrameworkUiDefaults {
  return {
    locale: input.locale ?? 'en-US',
    ...(input.backLabel === undefined ? {} : { backLabel: input.backLabel }),
    submitLabel: input.submitLabel ?? 'Submit',
    loadingLabel: input.loadingLabel ?? 'Loading…',
    notFoundLabel: input.notFoundLabel ?? 'Record not found.',
    retryLabel: input.retryLabel ?? 'Retry',
    exportLabel: input.exportLabel ?? 'Export',
    exportPdfLabel: input.exportPdfLabel ?? 'Export as PDF',
    exportXlsxLabel: input.exportXlsxLabel ?? 'Export as XLSX',
    addLabel: input.addLabel ?? 'Add',
    addRowLabel: input.addRowLabel ?? 'Add row',
    editRowLabel: input.editRowLabel ?? 'Edit row',
    cancelLabel: input.cancelLabel ?? 'Cancel',
    confirmTitle: input.confirmTitle ?? 'Are you sure you want to continue?',
    confirmMessage: input.confirmMessage ?? 'Select Continue to proceed.',
    removeLabel: input.removeLabel ?? 'Remove',
    expandLabel: input.expandLabel ?? 'Expand',
    collapseLabel: input.collapseLabel ?? 'Collapse',
  }
}

export function useFrameworkUiDefaults(): ResolvedFrameworkUiDefaults {
  return inject(frameworkUiDefaultsKey, undefined) ?? resolveFrameworkUiDefaults()
}
