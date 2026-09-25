import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod/v4'
import { defineForm } from '../defineForm'
import Form from '../../components/core/Form.vue'
import { flush, mountCore } from '../../components/core/__tests__/harness'

const mounted: Array<ReturnType<typeof mountCore>> = []

afterEach(() => {
  for (const view of mounted.splice(0)) view.unmount()
})

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
    expect(definition.fields.name.renderer).toBe('text')
    expect(definition.fields.name.props).toEqual({ placeholder: 'Name' })
    expect(definition.fields.name.span).toBe(2)
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
  })

  it('uses the same requiredness and runtime checks for constructed and plain definitions', async () => {
    const schema = z.object({ requiredName: z.string(), optionalName: z.string().optional() })
    const plain = {
      schema,
      fields: {
        requiredName: { renderer: 'text' },
        optionalName: { renderer: 'text' },
      },
    }
    const definedView = mountCore(Form, { ...defineForm(plain), modelValue: { requiredName: 'Ada' } })
    const plainView = mountCore(Form, { ...plain, modelValue: { requiredName: 'Ada' } })
    mounted.push(definedView, plainView)
    await flush()

    const requiredness = (view: ReturnType<typeof mountCore>) => view.all('input').map((input) => (input as HTMLInputElement).required)
    expect(requiredness(definedView)).toEqual([true, false])
    expect(requiredness(plainView)).toEqual(requiredness(definedView))
  })

  it('rejects invalid JavaScript definitions and bare validators', () => {
    const schema = z.object({ name: z.string() })
    const invalidProps = { schema, fields: { name: { renderer: 'text', props: { required: true } } } }
    const invalidBehavior = { schema, fields: { name: { renderer: 'text', behavior: { resetWhen: () => undefined } } } }
    const invalidValidator = { schema, fields: { name: { renderer: 'text' } }, validators: [() => undefined] }
    const unsafeFields = Object.create(null) as Record<string, unknown>
    unsafeFields.constructor = { renderer: 'text' }

    expect(() => Reflect.apply(defineForm, undefined, [null])).toThrow(
      '[loom][SURFACE_OPTION_INVALID] Form member "definition" must be an object.',
    )
    expect(() => Reflect.apply(defineForm, undefined, [{ fields: {} }])).toThrow(
      '[loom][FORM_SCHEMA_REQUIRED] Form requires a raw schema.',
    )
    expect(() => Reflect.apply(defineForm, undefined, [invalidProps])).toThrow(
      '[loom][SURFACE_OPTION_INVALID] Form field "name" member "props.required"',
    )
    expect(() => mountCore(Form, { ...invalidProps, modelValue: {} })).toThrow(
      '[loom][SURFACE_OPTION_INVALID] Form field "name" member "props.required"',
    )
    expect(() => Reflect.apply(defineForm, undefined, [invalidBehavior])).toThrow(
      '[loom][SURFACE_OPTION_INVALID] Form field "name" member "behavior.resetWhen"',
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
