import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const sourceRoot = join(__dirname, '..')
const checkedTargets = ['utilities', 'components'].map((segment) => join(sourceRoot, segment))

function collectFiles(directory: string): string[] {
  if (!statSync(directory).isDirectory()) return [directory]
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry)
    if (statSync(path).isDirectory()) return collectFiles(path)
    return /\.(ts|tsx|vue)$/.test(path) ? [path] : []
  })
}

describe('service decoupling', () => {
  it('keeps utilities and components decoupled from configured services', () => {
    const offenders = checkedTargets
      .flatMap(collectFiles)
      .filter((file) => readFileSync(file, 'utf8').includes('@southneuhof/loom/services'))
      .map((file) => relative(sourceRoot, file))

    expect(offenders).toEqual([])
  })
})
