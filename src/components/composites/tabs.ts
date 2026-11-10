import type { RouteLocationRaw } from 'vue-router'

export interface TabsItem {
  value: string
  label: string
  disabled?: boolean
  to?: never
}

export interface RoutedTabItem {
  to: RouteLocationRaw
  label: string
  permission?: string | null
  disabled?: boolean
  value?: never
}

interface TabsAppearance {
  label: string
  variant?: 'filled' | 'tonal'
  orientation?: 'horizontal' | 'vertical'
}

export type TabsProps = TabsAppearance & ({ items: readonly TabsItem[]; modelValue: string; record?: never } | { items: readonly RoutedTabItem[]; modelValue?: never; record?: object })
