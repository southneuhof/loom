import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('MultiLocationInput operation forwarding', () => {
  it('forwards operations to nested inputs', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/composites/form-inputs/MultiLocationInput.vue'), 'utf8')
    expect(source.match(/:operations="operations"/g)).toHaveLength(2)
  })
})
