import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { preProcessFile } from 'typescript'
import { parse } from 'vue/compiler-sfc'
import { expect, it } from 'vitest'

const sourceRoot = join(__dirname, '..')
const packagePrefix = '@southneuhof/loom/'

function modules(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      return entry.name === '__tests__' || entry.name === '__type-tests__' ? [] : modules(path)
    }
    return /\.(ts|tsx|vue)$/.test(entry.name) ? [path] : []
  })
}

function importedPaths(file: string): string[] {
  const source = readFileSync(file, 'utf8')
  const descriptor = file.endsWith('.vue') ? parse(source).descriptor : undefined
  const scripts = descriptor
    ? [descriptor.script?.content ?? '', descriptor.scriptSetup?.content ?? '']
    : [source]
  return scripts.flatMap((script) => preProcessFile(script, true, true).importedFiles.map(({ fileName }) => {
    if (fileName.startsWith('.')) return relative(sourceRoot, resolve(dirname(file), fileName)).split(sep).join('/')
    return fileName.startsWith(packagePrefix) ? fileName.slice(packagePrefix.length) : fileName
  }))
}

it.each([
  {
    rule: 'keeps base components decoupled from framework and app layers',
    directories: ['components/base'],
    forbidden: ['adapters', 'runtime', 'services', 'router', 'components/composites', 'vue-router'],
  },
  {
    rule: 'keeps input components decoupled from composite workflows',
    directories: ['components/inputs'],
    forbidden: ['components/composites'],
  },
  {
    rule: 'keeps utilities and components decoupled from configured services',
    directories: ['utilities', 'components'],
    forbidden: ['services'],
  },
])('$rule', ({ directories, forbidden }) => {
  const violations = directories.flatMap((directory) => modules(join(sourceRoot, directory))).flatMap((file) =>
    importedPaths(file)
      .filter((path) => forbidden.some((prefix) => path === prefix || path.startsWith(prefix + '/')))
      .map((path) => `${relative(sourceRoot, file)} imports ${path}`),
  )
  expect(violations).toEqual([])
})
