import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const stylesheets = [
  resolve(process.cwd(), 'src/styles/framework.css'),
  resolve(process.cwd(), '../../apps/web/src/assets/main.css'),
]

function themeBlock(path: string) {
  const css = readFileSync(path, 'utf8')
  return css.match(/\.dp__theme_light,\s*\.dp__theme_dark\s*\{(?<body>[^}]+)\}/)?.groups?.body ?? ''
}

describe('datepicker theme', () => {
  it.each(stylesheets)('%s maps both Vue Datepicker themes to application design tokens', (path) => {
    const block = themeBlock(path)
    expect(block).not.toBe('')
    expect(block).toContain('--dp-background-color: rgb(var(--md-sys-color-surface-container))')
    expect(block).toContain('--dp-text-color: rgb(var(--md-sys-color-on-surface))')
    expect(block).toContain('--dp-primary-color: rgb(var(--md-sys-color-primary))')
    expect(block).toContain('--dp-primary-text-color: rgb(var(--md-sys-color-on-primary))')
    expect(block).toContain('--dp-border-color: rgb(var(--md-sys-color-outline)')
    expect(block).toContain('--dp-icon-color: rgb(var(--md-sys-color-on-surface-variant))')
    expect(block).toContain('--dp-danger-color: rgb(var(--md-sys-color-error))')
    expect(block).toContain('--dp-highlight-color: rgb(var(--md-sys-color-primary)')
  })

  it.each(stylesheets)('%s contains no hard-coded color literals', (path) => {
    const block = themeBlock(path)
    expect(block).not.toMatch(/#[\da-f]{3,8}\b/i)
    expect(block).not.toMatch(/rgba?\(\s*\d/)
  })
})
