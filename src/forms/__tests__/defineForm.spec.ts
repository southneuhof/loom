import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod/v4'
import { compileForm } from '../compileForm'
import { defineForm } from '../defineForm'

describe('defineForm', () => {
  it('snapshots enumerable configuration and preserves component props and callbacks', () => {
    const schema = z.object({ name: z.string(), status: z.string().optional() })
    const visible = vi.fn(() => true)
    const initialValue = vi.fn(() => 'Ada')
    const validate = vi.fn(() => undefined)
    const submit = vi.fn(async () => 'saved')
    const props = { placeholder: 'Name' }
    const behavior = { visible }
    const fields = {
      name: { renderer: 'text', props, span: 2, initialValue, behavior },
      status: { renderer: 'text' },
    }
    const labels = { name: 'Name' }
    const validator = { validate, triggers: ['blur'] as ('blur' | 'submit')[], path: ['name'] as (string | number)[] }
    const validators = [validator]
    const definition = defineForm({ schema, fields, labels, validators, submit })

    props.placeholder = 'Changed'
    labels.name = 'Changed'
    validator.triggers.push('submit')
    validator.path.push('status')

    expect(Object.keys(definition).sort()).toEqual(['fields', 'labels', 'schema', 'submit', 'validators'])
    expect(definition.schema).toBe(schema)
    expect(definition.fields).not.toBe(fields)
    expect(definition.fields.name).not.toBe(fields.name)
    expect(definition.fields.name.props).toEqual({ placeholder: 'Name' })
    expect(definition.fields.name.initialValue).toBe(initialValue)
    expect(definition.fields.name.behavior?.visible).toBe(visible)
    expect(definition.labels).toEqual({ name: 'Name' })
    expect(definition.validators?.[0]?.validate).toBe(validate)
    expect(definition.validators?.[0]?.triggers).toEqual(['blur'])
    expect(definition.validators?.[0]?.path).toEqual(['name'])
    expect(definition.submit).toBe(submit)
    expect(visible).not.toHaveBeenCalled()
    expect(initialValue).not.toHaveBeenCalled()
    expect(validate).not.toHaveBeenCalled()
    expect(submit).not.toHaveBeenCalled()

    const compiled = compileForm(definition)
    expect(compiled.definition).toBe(definition)
    expect(compiled.fields.map(({ key, renderer, required }) => ({ key, renderer, required }))).toEqual([
      { key: 'name', renderer: 'text', required: true },
      { key: 'status', renderer: 'text', required: false },
    ])
    expect(compiled.definition.fields.name.behavior?.visible).toBe(visible)
    expect(compiled.definition.labels).toBe(definition.labels)
    expect(compiled.definition.validators).toBe(definition.validators)
    expect(compiled.definition.submit).toBe(submit)
  })

  it('rejects invalid JavaScript definitions and bare validators', () => {
    const schema = z.object({ name: z.string() })
    const invalidProps = { schema, fields: { name: { renderer: 'text', props: { required: true } } } }
    const invalidValidator = { schema, fields: { name: { renderer: 'text' } }, validators: [() => undefined] }
    const unsafeFields = Object.create(null) as Record<string, unknown>
    unsafeFields.constructor = { renderer: 'text' }

    expect(() => Reflect.apply(defineForm, undefined, [invalidProps])).toThrow(
      '[loom][SURFACE_OPTION_INVALID] Form field "name" member "props.required"',
    )
    expect(() => Reflect.apply(defineForm, undefined, [invalidValidator])).toThrow(
      '[loom][SURFACE_OPTION_INVALID] Form member "validators[0]" must be a validator descriptor.',
    )
    expect(() => Reflect.apply(defineForm, undefined, [{ schema, fields: unsafeFields }])).toThrow(
      '[loom][SURFACE_OPTION_INVALID] Form field key "constructor"',
    )
    expect(() => Reflect.apply(defineForm, undefined, [{ schema, fields: { name: { renderer: 'text', source: { load: vi.fn() } } } }])).toThrow(
      '[loom][SURFACE_OPTION_INVALID] Form field "name" member "source" must be a FormInput member.',
    )
    expect(() => Reflect.apply(defineForm, undefined, [{ schema, fields: { name: {} } }])).toThrow(
      '[loom][INPUT_RENDERER_REQUIRED] Form field "name" needs an explicit renderer.',
    )
  })
})
