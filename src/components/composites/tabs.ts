import type { RouteLocationRaw } from 'vue-router'
import type remixiconTags from '../base/remixicon-tags'

export type TabIconName = (typeof remixiconTags)[number]

export interface TabsItem {
  value: string
  label: string
  icon?: TabIconName
  disabled?: boolean
  to?: never
}

export interface RoutedTabItem {
  to: RouteLocationRaw
  label: string
  icon?: TabIconName
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
