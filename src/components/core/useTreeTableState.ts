import { computed, getCurrentInstance, onBeforeUpdate, ref, shallowRef, toRaw } from 'vue'
import type { TreePresentationOptions } from '../../contracts'

export interface TreeTableIndex<TRecord extends object> {
  branchKeys: readonly string[]
  parentKeys: ReadonlyMap<string, string | null>
  childrenFor: (record: TRecord) => readonly TRecord[]
  keyFor: (record: TRecord) => string
  ancestorsFor: (key: string) => readonly string[]
}

function optionError(detail: string): never {
  throw new Error(`[loom][SURFACE_OPTION_INVALID] TreeTable ${detail}`)
}

function hasVNodeProp(instance: ReturnType<typeof getCurrentInstance>, camel: string, kebab: string): boolean {
  const props = instance?.vnode.props ?? {}
  return Object.hasOwn(props, camel) || Object.hasOwn(props, kebab)
}

export function buildTreeTableIndex<TRecord extends object>(
  records: readonly TRecord[],
  rowKey: TreePresentationOptions<TRecord>['rowKey'],
  getChildren: TreePresentationOptions<TRecord>['children']
): TreeTableIndex<TRecord> {
  if (!Array.isArray(records)) optionError('records must be an array.')

  const seenObjects = new Set<object>()
  const seenKeys = new Set<string>()
  const keysByRecord = new Map<object, string>()
  const childrenByRecord = new Map<object, readonly TRecord[]>()
  const parentKeys = new Map<string, string | null>()
  const branchKeys: string[] = []
  const stack: { record: TRecord; parentKey: string | null }[] = []
  for (let index = records.length - 1; index >= 0; index -= 1) {
    stack.push({ record: records[index]!, parentKey: null })
  }

  while (stack.length > 0) {
    const item = stack.pop()!
    const input = item.record
    if (!input || typeof input !== 'object') optionError('records and children must contain objects.')
    const record = toRaw(input)
    if (seenObjects.has(record)) optionError('children contain a cycle or a repeated record reference.')
    seenObjects.add(record)

    const keyValue = typeof rowKey === 'function' ? rowKey(record) : Reflect.get(record, rowKey)
    if (typeof keyValue !== 'string' && typeof keyValue !== 'number') {
      optionError(`rowKey must resolve to a string or number for every record (tree column key ${String(rowKey)}).`)
    }
    const key = String(keyValue)
    if (key.length === 0) optionError('rowKey must resolve to a nonempty key for every record.')
    if (seenKeys.has(key)) optionError(`rowKey values must be unique after normalization; duplicate key "${key}".`)
    seenKeys.add(key)
    keysByRecord.set(record, key)
    parentKeys.set(key, item.parentKey)

    const children = getChildren(record)
    if (!Array.isArray(children)) optionError(`children for key "${key}" must return an array.`)
    childrenByRecord.set(record, children)
    if (children.length > 0) branchKeys.push(key)
    for (let index = children.length - 1; index >= 0; index -= 1) {
      stack.push({ record: children[index]!, parentKey: key })
    }
  }

  return {
    branchKeys,
    parentKeys,
    childrenFor(record) {
      const original = toRaw(record)
      const children = childrenByRecord.get(original)
      if (!children) return []
      return children
    },
    keyFor(record) {
      const key = keysByRecord.get(toRaw(record))
      if (key === undefined) optionError('rowKey could not be resolved for a rendered record.')
      return key
    },
    ancestorsFor(key) {
      const ancestors: string[] = []
      let parent = parentKeys.get(key) ?? null
      while (parent !== null) {
        ancestors.unshift(parent)
        parent = parentKeys.get(parent) ?? null
      }
      return ancestors
    },
  }
}

export function useTreeTableState<TRecord extends object>(props: TreePresentationOptions<TRecord>) {
  const instance = getCurrentInstance()
  const hasControlledKeys = ref(hasVNodeProp(instance, 'expandedKeys', 'expanded-keys'))
  const hasDefaultKeys = ref(hasVNodeProp(instance, 'defaultExpandedKeys', 'default-expanded-keys'))
  const internalKeys = shallowRef<string[]>([...(props.defaultExpandedKeys ?? [])])

  function validateExpansionProps() {
    if (hasControlledKeys.value && hasDefaultKeys.value) {
      optionError('cannot receive both expandedKeys and defaultExpandedKeys.')
    }
  }

  validateExpansionProps()
  onBeforeUpdate(() => {
    hasControlledKeys.value = hasVNodeProp(instance, 'expandedKeys', 'expanded-keys')
    hasDefaultKeys.value = hasVNodeProp(instance, 'defaultExpandedKeys', 'default-expanded-keys')
    validateExpansionProps()
  })

  const expandedKeys = computed<readonly string[]>(() => {
    return hasControlledKeys.value ? (props.expandedKeys ?? []) : internalKeys.value
  })

  function setExpandedKeys(next: readonly string[]) {
    const unique = [...new Set(next)]
    const emitted = [...unique]
    if (!hasControlledKeys.value) internalKeys.value = emitted
    return emitted
  }

  return { expandedKeys, setExpandedKeys, internalKeys }
}
