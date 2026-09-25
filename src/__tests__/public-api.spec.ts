import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import * as framework from '../index'

const requireFromPackage = createRequire(resolve(process.cwd(), 'package.json'))

/**
 * Locks the 2.0 public surface after the clean break.
 *
 * Release policy (decided 2026-07-26, verified before deletion): the package
 * has no consumers outside this monorepo — its `exports` map points at raw
 * `src` and it carries no `publishConfig`, and the private registry could not
 * be queried without credentials — so the legacy CRUD surface was removed
 * outright under a major version bump rather than deprecated.
 */
const removedRuntimeExports = [
  ['resolve', 'Fields'].join(''),
  ['to', 'Catalog'].join(''),
  ['from', 'Zod'].join(''),
  ['define', 'ActionResource'].join(''),
  ['select', 'Schema'].join(''),
  ['validate', 'Draft'].join(''),
  ['resolve', 'FrameworkFieldDefaults'].join(''),
  ['use', 'FrameworkFieldDefaults'].join(''),
  ['framework', 'FieldDefaults', 'Key'].join(''),
  ['create', 'BehaviorRuntime'].join(''),
  'standardControls',
  'controlsAt',
  'resolveCRUDOperations',
  'useCRUDOperations',
  'defaultCRUDListOnExport',
  'defaultCRUDDetailOnExport',
  ['define', 'Schema'].join(''),
  ['createHono', 'ResourceOperations'].join(''),
  'useFrameworkDefaults',
  'useFrameworkRuntime',
  'mergeModelConfig',
  'getInputComponentRegistry',
  'createInputPropsRegistry',
  'adaptVModelInput',
  'controlledInput',
]

const currentExports = [
  'FrameworkPlugin',
  'defineForm',
  'defineTable',
  'defineDetail',
  'defineResource',
  'Table',
  'TreeTable',
  'Detail',
  'Form',
  'DialogForm',
  'ListView',
  'DetailView',
  'FormView',
  'useLoader',
  'useAssetAdapter',
  'useNamespacedQuery',
  'createFrameworkQueryClient',
  'invalidateResourceData',
  'createRendererRegistries',
  'createRendererRegistry',
  'resolveFrameworkAdapters',
]

describe('public API surface', () => {
  it('exports the resource, core, and shell surface', () => {
    for (const name of currentExports) expect(framework, `missing export: ${name}`).toHaveProperty(name)
  })

  it('no longer exports the retired CRUD surface', () => {
    for (const name of removedRuntimeExports) expect(framework, `unexpected export: ${name}`).not.toHaveProperty(name)
  })

  it('removes legacy configuration source paths', () => {
    for (const path of [
      ['src', 'fields'].join('/'),
      ['src', 'validation'].join('/'),
      ['src', 'contracts', 'fields.ts'].join('/'),
      ['src', 'contracts', 'validation.ts'].join('/'),
      ['src', 'resources', 'actionResource.ts'].join('/'),
      ['src', 'hono'].join('/'),
      'src/adapters/defaults.ts',
      'src/runtime.ts',
      'src/runtimeDefaults.ts',
      'src/model-config',
      'src/components/composites/Table.vue',
      'src/components/composites/Detail.vue',
      'src/components/composites/Form.vue',
      'src/components/composites/Tree',
      'src/renderers/inputProps.ts',
    ]) {
      expect(existsSync(resolve(process.cwd(), path)), `unexpected path: ${path}`).toBe(false)
    }
  })

  it('removes the framework Hono integration', () => {
    expect(() => requireFromPackage.resolve('@southneuhof/loom/hono')).toThrow(/Package subpath/)
  })
})
