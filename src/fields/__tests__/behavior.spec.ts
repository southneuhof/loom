import { describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, reactive } from 'vue'
import { createBehaviorRuntime } from '../behavior'
import { resolveFields } from '../resolve'
import type { FieldCatalog } from '../../contracts'

interface Draft extends Record<string, unknown> {
  is_accident?: boolean
  mode?: string
  cause?: string
  section_id?: string
  road_id?: string
  total?: number
  quantity?: number
  price?: number
}

function runtimeFor(catalog: FieldCatalog<Record<string, unknown>, Draft>, initial: Draft) {
  const draft = reactive(initial) as Draft
  const fields = resolveFields<Record<string, unknown>, Draft>({ fields: catalog, surface: 'form' })
  const scope = effectScope()
  const runtime = scope.run(() => createBehaviorRuntime<Draft>({ fields, draft }))!
  const write = (key: string, value: unknown) => {
    ;(draft as Record<string, unknown>)[key] = value
  }
  return { draft, runtime, scope, connect: () => scope.run(() => runtime.connect(write))! }
}

describe('field behavior', () => {
  it('toggles visibility when a dependency changes', async () => {
    const { draft, runtime, scope } = runtimeFor(
      { cause: { form: { behavior: { visible: ({ draft }) => draft.is_accident === true } } } },
      { is_accident: false },
    )

    expect(runtime.state('cause').value.visible).toBe(false)

    draft.is_accident = true
    await nextTick()

    expect(runtime.state('cause').value.visible).toBe(true)
    scope.stop()
  })

  it('re-tracks branch by branch instead of using a declared dependency list', async () => {
    const seen: string[][] = []
    const draft = reactive<Draft>({ mode: 'a', section_id: 'x', road_id: 'y' })
    const fields = resolveFields<Record<string, unknown>, Draft>({
      fields: {
        cause: {
          form: {
            behavior: {
              visible: ({ draft }) => (draft.mode === 'a' ? draft.section_id != null : draft.road_id != null),
            },
          },
        },
      },
      surface: 'form',
    })
    const scope = effectScope()
    const runtime = scope.run(() =>
      createBehaviorRuntime<Draft>({ fields, draft, onDependencies: (_key, dependencies) => seen.push([...dependencies]) }),
    )!

    expect(runtime.state('cause').value.visible).toBe(true)
    expect(seen.at(-1)).toEqual(['mode', 'section_id'])

    draft.mode = 'b'
    await nextTick()
    expect(runtime.state('cause').value.visible).toBe(true)
    expect(seen.at(-1)).toEqual(['mode', 'road_id'])

    // section_id is no longer a dependency, so changing it must not re-evaluate.
    const evaluations = seen.length
    draft.section_id = 'changed'
    await nextTick()
    void runtime.state('cause').value
    expect(seen.length).toBe(evaluations)
    scope.stop()
  })

  it('derives disabled state', async () => {
    const { draft, runtime, scope } = runtimeFor(
      { cause: { form: { behavior: { disabled: ({ draft }) => draft.mode === 'locked' } } } },
      { mode: 'open' },
    )

    expect(runtime.state('cause').value.disabled).toBe(false)
    draft.mode = 'locked'
    await nextTick()
    expect(runtime.state('cause').value.disabled).toBe(true)
    scope.stop()
  })

  it('shallow-merges behavior props over static props and keeps the reference stable', async () => {
    const { draft, runtime, scope } = runtimeFor(
      {
        cause: {
          form: {
            props: { placeholder: 'Sebab', clearable: true },
            behavior: { props: ({ draft }) => ({ placeholder: draft.mode === 'a' ? 'A' : 'B' }) },
          },
        },
      },
      { mode: 'a' },
    )

    const first = runtime.state('cause').value.props
    expect(first).toEqual({ placeholder: 'A', clearable: true })

    draft.section_id = 'unrelated'
    await nextTick()
    expect(runtime.state('cause').value.props).toBe(first)

    draft.mode = 'b'
    await nextTick()
    expect(runtime.state('cause').value.props).not.toBe(first)
    expect(runtime.state('cause').value.props.placeholder).toBe('B')
    scope.stop()
  })

  it('writes derived values into the draft and ignores user edits', async () => {
    const { draft, runtime, scope, connect } = runtimeFor(
      {
        quantity: {},
        price: {},
        total: { form: { behavior: { derived: ({ draft }) => (draft.quantity ?? 0) * (draft.price ?? 0) } } },
      },
      { quantity: 2, price: 3 },
    )
    connect()
    await nextTick()

    expect(draft.total).toBe(6)

    draft.total = 999
    await nextTick()
    expect(runtime.state('total').value.derived).toBe(6)

    draft.quantity = 4
    await nextTick()
    expect(draft.total).toBe(12)
    scope.stop()
  })

  it('cascades a derived value into another field visibility in one pass', async () => {
    const { draft, scope, runtime, connect } = runtimeFor(
      {
        quantity: {},
        total: { form: { behavior: { derived: ({ draft }) => (draft.quantity ?? 0) * 2 } } },
        cause: { form: { behavior: { visible: ({ draft }) => (draft.total ?? 0) > 4 } } },
      },
      { quantity: 1 },
    )
    connect()
    await nextTick()

    expect(runtime.state('cause').value.visible).toBe(false)

    draft.quantity = 3
    await nextTick()

    expect(draft.total).toBe(6)
    expect(runtime.state('cause').value.visible).toBe(true)
    scope.stop()
  })

  it('resets a field when the resetWhen identity changes', async () => {
    const { draft, scope, connect } = runtimeFor(
      {
        section_id: {},
        road_id: { form: { behavior: { resetWhen: ({ draft }) => draft.section_id } } },
      },
      { section_id: 'a', road_id: 'road-1' },
    )
    connect()
    await nextTick()

    expect(draft.road_id).toBe('road-1')

    draft.section_id = 'b'
    await nextTick()

    expect(draft.road_id).toBeUndefined()
    scope.stop()
  })

  it('removes hidden fields from the submitted draft', async () => {
    const { draft, runtime, scope } = runtimeFor(
      {
        mode: {},
        cause: { form: { behavior: { visible: ({ draft }) => draft.mode === 'a' } } },
      },
      { mode: 'a', cause: 'kept' },
    )

    expect(runtime.visibleDraft.value).toEqual({ mode: 'a', cause: 'kept' })

    draft.mode = 'b'
    await nextTick()

    expect(runtime.visibleDraft.value).toEqual({ mode: 'b' })
    expect(runtime.visibleKeys.value).toEqual(['mode'])
    scope.stop()
  })

  it('evaluates deterministically for equal drafts', () => {
    const first = runtimeFor({ cause: { form: { behavior: { visible: ({ draft }) => draft.mode === 'a' } } } }, { mode: 'a' })
    const second = runtimeFor({ cause: { form: { behavior: { visible: ({ draft }) => draft.mode === 'a' } } } }, { mode: 'a' })

    expect(first.runtime.state('cause').value).toEqual(second.runtime.state('cause').value)
    first.scope.stop()
    second.scope.stop()
  })

  it('rejects contradictory and non-function behavior declarations', () => {
    expect(() =>
      runtimeFor({ cause: { form: { behavior: { derived: () => 1, resetWhen: () => 1 } } } }, {}),
    ).toThrow('declares both behavior.derived and behavior.resetWhen')

    expect(() =>
      runtimeFor({ cause: { form: { behavior: { visible: true as unknown as () => boolean } } } }, {}),
    ).toThrow('must be a function')

    expect(() =>
      runtimeFor({ cause: { form: { behavior: { whenever: (() => true) as never } } } }, {}),
    ).toThrow('Unknown behavior option "whenever"')
  })

  it('refuses draft writes from inside behavior functions', () => {
    const { runtime, scope } = runtimeFor(
      {
        cause: {
          form: {
            behavior: {
              visible: ({ draft }) => {
                draft.mode = 'mutated'
                return true
              },
            },
          },
        },
      },
      { mode: 'a' },
    )

    expect(() => runtime.state('cause').value).toThrow('must be pure')
    scope.stop()
  })

  it('leaves fields without a behavior block visible and enabled', () => {
    const { runtime, scope } = runtimeFor({ mode: { form: { props: { placeholder: 'Mode' } } } }, { mode: 'a' })
    const state = runtime.state('mode').value

    expect(state).toEqual({ visible: true, disabled: false, props: { placeholder: 'Mode' } })
    scope.stop()
  })

  it('does not evaluate behavior for fields that never declare it', () => {
    const onDependencies = vi.fn()
    const draft = reactive<Draft>({ mode: 'a' })
    const fields = resolveFields<Record<string, unknown>, Draft>({ fields: { mode: {} }, surface: 'form' })
    const scope = effectScope()
    const runtime = scope.run(() => createBehaviorRuntime<Draft>({ fields, draft, onDependencies }))!

    void runtime.state('mode').value

    expect(onDependencies).not.toHaveBeenCalled()
    scope.stop()
  })

  it('projects atomic presentation and rejects value-effect cycles', async () => {
    const { draft, runtime, scope } = runtimeFor({
      mode: {},
      cause: { form: { renderer: 'text', props: { clearable: true }, behavior: { presentation: ({ draft }) => draft.mode === 'file' ? { renderer: 'file', label: 'Lampiran', props: null, span: 4 } : {} } } },
    }, { mode: 'text' })
    expect(runtime.state('cause').value.renderer).toBeUndefined()
    draft.mode = 'file'
    await nextTick()
    expect(runtime.state('cause').value).toMatchObject({ renderer: 'file', label: 'Lampiran', props: {}, span: 4 })
    scope.stop()

    const cycle = runtimeFor({ a: { form: { behavior: { derived: ({ draft }) => draft.b } } }, b: { form: { behavior: { derived: ({ draft }) => draft.a } } } }, {})
    expect(() => cycle.connect()).toThrow('Value-effect cycle: a -> b -> a')
    cycle.scope.stop()
  })

  it('resolves base props after dynamic presentation renderer selection', async () => {
    const draft = reactive<Draft>({ mode: 'lookup' })
    const fields = resolveFields<Record<string, unknown>, Draft>({
      fields: { value: { form: { renderer: 'text', props: { static: true }, behavior: {
        props: () => ({ behavior: true }),
        presentation: ({ draft }) => draft.mode === 'lookup' ? { renderer: 'lookup', props: { presentation: true } } : { props: null },
      } } } },
      surface: 'form',
    })
    const resolveBaseProps = vi.fn((_field, renderer) => ({ renderer, base: true, static: false }))
    const scope = effectScope()
    const runtime = scope.run(() => createBehaviorRuntime<Draft>({ fields, draft, resolveBaseProps }))!
    expect(runtime.state('value').value.props).toEqual({ renderer: 'lookup', base: true, static: false, behavior: true, presentation: true })
    draft.mode = 'clear'
    await nextTick()
    expect(runtime.state('value').value.props).toEqual({})
    expect(resolveBaseProps).toHaveBeenLastCalledWith(expect.anything(), 'text')
    scope.stop()
  })
})
