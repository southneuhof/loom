import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const inputsRoot = join(__dirname, '..')
const sourceRoot = join(inputsRoot, '..', '..')
const forbiddenImports = [
  ['@southneuhof/loom', 'components', 'composites'].join('/'),
  '../composites',
  './composites',
]

function collectFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry)
    if (statSync(path).isDirectory()) return collectFiles(path)
    return /\.(ts|vue)$/.test(path) ? [path] : []
  })
}

function importedSpecifiers(file: string): string[] {
  const source = readFileSync(file, 'utf8')
  return [...source.matchAll(/(?:import|export)\s+(?:[^'"]+\s+from\s+)?['"]([^'"]+)['"]/g)].map((match) => match[1])
}

describe('input component boundary', () => {
  it('keeps input components decoupled from composite workflows', () => {
    const offenders = collectFiles(inputsRoot)
      .filter((file) => importedSpecifiers(file).some((specifier) => forbiddenImports.some((importPath) => specifier.startsWith(importPath))))
      .map((file) => relative(sourceRoot, file))

    expect(offenders).toEqual([])
  })
})
