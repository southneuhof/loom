import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('LocationInput operation boundary', () => {
  it('uses neutral operations and cancellation', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/composites/form-inputs/LocationInput.vue'), 'utf8')
    expect(source).toContain('LocationOperations')
    expect(source).toContain('AbortController')
    expect(source).not.toMatch(/place_id|structured_formatting|useFrameworkRuntime/)
  })
})
