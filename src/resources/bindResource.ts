import type { AccessAdapter, CollectionLoadContext, QueryNamespace, RecordIdentity, RecordLoadContext, ResourceOperation } from '../contracts'
import { invalidateResourceData } from '../query/client'
import { stableValue } from '../query/keys'
import { checkIdentityValue, isRecordIdentity } from './identity'
import { useResourceRuntime } from './runtime'
import { registerResourceAction } from './routeAccess'
import { isStandardRowOperation } from './operations'
import type {
  BoundCustomActions,
  BoundResource,
  IdentityRecord,
  ResourceCustomCommand,
  ResourceCustomHandle,
  ResourceCustomPermission,
  ResourceDefinitionInput,
  ResourceIdentityFunction,
  ResourceIdentityValue,
  ResourceBoundOperations,
  ResourcePermissions,
  ResourceRoute,
  ResourceStaticRoute,
} from './operations'
import type { RouteLocationRaw } from 'vue-router'

const standardOperations = ['list', 'create', 'detail', 'update', 'delete'] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function assertDeclaration(resourceKey: string, value: unknown): asserts value is Record<string, unknown> {
  if (!isRecord(value)) throw new Error('[loom][RESOURCE_IDENTITY_INVALID] Resource declaration must be an object.')
  if (typeof value.key !== 'string' || value.key.length === 0) throw new Error('[loom][RESOURCE_IDENTITY_INVALID] Resource key must be a nonempty string.')
  if (typeof value.identity !== 'function') throw new Error(`[loom][RESOURCE_IDENTITY_INVALID] Resource "${resourceKey}" needs an identity function.`)
  const supported = new Set(['key', 'identity', 'list', 'create', 'detail', 'update', 'delete', 'actions'])
  for (const member of Object.keys(value)) {
    if (!supported.has(member)) throw new Error(`[loom][SURFACE_OPTION_INVALID] Resource "${resourceKey}" member "${member}" is not supported.`)
  }
  if (value.actions !== undefined && !isRecord(value.actions)) throw new Error(`[loom][SURFACE_OPTION_INVALID] Resource "${resourceKey}" actions must be an object.`)
}

function assertPermission(resourceKey: string, operation: string, permission: unknown): asserts permission is string | null {
  if (permission === null) return
  if (typeof permission !== 'string' || permission.length === 0) {
    throw new Error(`[loom][SURFACE_OPTION_INVALID] Resource "${resourceKey}" operation "${operation}" needs a permission string or null.`)
  }
}

function assertOperation(resourceKey: string, operation: string, entry: unknown): asserts entry is Record<string, unknown> {
  if (!isRecord(entry)) throw new Error(`[loom][SURFACE_OPTION_INVALID] Resource "${resourceKey}" operation "${operation}" must be an object.`)
  assertPermission(resourceKey, operation, entry.permission)
  if (entry.visible !== undefined && typeof entry.visible !== 'function') {
    throw new Error(`[loom][SURFACE_OPTION_INVALID] Resource "${resourceKey}" operation "${operation}" visible must be a function.`)
  }
  if ((operation === 'list' && !isRecord(entry.table))
    || (operation === 'create' && !isRecord(entry.form))
    || (operation === 'detail' && typeof entry.detail !== 'function')
    || (operation === 'update' && typeof entry.form !== 'function')
    || (operation === 'delete' && typeof entry.run !== 'function')) {
    throw new Error(`[loom][SURFACE_OPTION_INVALID] Resource "${resourceKey}" operation "${operation}" is missing its operation member.`)
  }
}

function identityToken(value: RecordIdentity): string {
  return JSON.stringify(stableValue(value))
}

function snapshotIdentity<TIdentity extends RecordIdentity>(value: TIdentity): TIdentity {
  if (typeof value !== 'object') return value
  return Object.freeze({ ...value }) as TIdentity
}

function snapshotValue(value: unknown, seen = new Map<object, unknown>()): unknown {
  if (value instanceof Date) return new Date(value.getTime())
  if (Array.isArray(value)) {
    const existing = seen.get(value)
    if (existing) return existing
    const copy: unknown[] = []
    seen.set(value, copy)
    for (const item of value) copy.push(snapshotValue(item, seen))
    return Object.freeze(copy)
  }
  if (isRecord(value)) {
    const existing = seen.get(value)
    if (existing) return existing
    const copy: Record<string, unknown> = Object.create(Object.getPrototypeOf(value) === null ? null : Object.prototype)
    seen.set(value, copy)
    for (const [key, item] of Object.entries(value)) {
      Object.defineProperty(copy, key, {
        value: snapshotValue(item, seen),
        enumerable: true,
        writable: false,
        configurable: false,
      })
    }
    return Object.freeze(copy)
  }
  return value
}

function snapshotRecord<TRecord extends object>(record: TRecord): TRecord {
  const snapshot = snapshotValue(record)
  if (!isRecord(snapshot)) throw new Error('[loom][RESOURCE_IDENTITY_INVALID] Record context must be an object.')
  return snapshot as TRecord
}

function resolveIdentity<TIdentityFunction extends ResourceIdentityFunction>(
  resourceKey: string,
  identity: TIdentityFunction,
  record: IdentityRecord<TIdentityFunction>,
  operation: string,
): ResourceIdentityValue<TIdentityFunction> {
  const value = (identity as unknown as (value: IdentityRecord<TIdentityFunction>) => ResourceIdentityValue<TIdentityFunction>)(record)
  checkIdentityValue(resourceKey, operation, value)
  return value
}

function snapshotBinding<TIdentityFunction extends ResourceIdentityFunction>(
  resourceKey: string,
  identity: TIdentityFunction,
  binding: { id: ResourceIdentityValue<TIdentityFunction>; record?: IdentityRecord<TIdentityFunction> },
  operation: string,
): { id: ResourceIdentityValue<TIdentityFunction>; record?: IdentityRecord<TIdentityFunction> } {
  checkIdentityValue(resourceKey, operation, binding.id)
  const id = snapshotIdentity(binding.id)
  if (binding.record !== undefined) {
    const record = snapshotRecord(binding.record)
    const rowId = resolveIdentity(resourceKey, identity, record, operation)
    if (identityToken(rowId) !== identityToken(id)) {
      throw new Error(`[loom][RESOURCE_IDENTITY_INVALID] Resource "${resourceKey}" operation "${operation}" record identity conflicts with its bound id.`)
    }
    return Object.freeze({ id, record })
  }
  return Object.freeze({ id })
}

function snapshotRecordBinding<TIdentityFunction extends ResourceIdentityFunction>(
  resourceKey: string,
  identity: TIdentityFunction,
  record: IdentityRecord<TIdentityFunction>,
  operation: string,
): { id: ResourceIdentityValue<TIdentityFunction>; record: IdentityRecord<TIdentityFunction> } {
  const snapshot = snapshotRecord(record)
  const id = snapshotIdentity(resolveIdentity(resourceKey, identity, snapshot, operation))
  return Object.freeze({ id, record: snapshot })
}

function withoutMembers(value: object, members: readonly string[]): Record<string, unknown> {
  const result: Record<string, unknown> = { ...value }
  for (const member of members) delete result[member]
  return result
}

function sameIdentity(left: unknown, right: RecordIdentity): boolean {
  return isRecordIdentity(left) && identityToken(left) === identityToken(right)
}

function recordContext(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined
}

function bindRecordContext<TIdentity extends RecordIdentity, TContext extends { id?: unknown }>(
  resourceKey: string,
  operation: string,
  id: TIdentity,
  context: TContext,
): Omit<TContext, 'id'> & { id: TIdentity } {
  if (context.id !== undefined && !sameIdentity(context.id, id)) {
    throw new Error(`[loom][RESOURCE_IDENTITY_INVALID] Resource "${resourceKey}" operation "${operation}" loader identity conflicts with its binding.`)
  }
  return { ...context, id }
}

function routeTarget<TIdentity extends RecordIdentity>(route: ResourceRoute<TIdentity> | ResourceStaticRoute | undefined, id?: TIdentity): RouteLocationRaw | undefined {
  if (!route) return undefined
  if (typeof route.params === 'function') {
    if (id === undefined) return undefined
    return { name: route.name, params: route.params(id) } as RouteLocationRaw
  }
  return route.params ? { name: route.name, params: route.params } as RouteLocationRaw : { name: route.name } as RouteLocationRaw
}

function staticRouteTarget(route: ResourceStaticRoute | undefined): RouteLocationRaw | undefined {
  if (!route) return undefined
  return route.params ? { name: route.name, params: route.params } as RouteLocationRaw : { name: route.name } as RouteLocationRaw
}

function formTarget<TIdentityFunction extends ResourceIdentityFunction, TResult extends IdentityRecord<TIdentityFunction>>(
  resourceKey: string,
  identity: TIdentityFunction,
  declared: RouteLocationRaw | ((result: TResult) => RouteLocationRaw | undefined) | false | undefined,
  detailRoute: ResourceRoute<ResourceIdentityValue<TIdentityFunction>> | undefined,
  listRoute: ResourceStaticRoute | undefined,
): RouteLocationRaw | ((result: TResult) => RouteLocationRaw | undefined) | false | undefined {
  if (declared !== undefined) return declared
  if (detailRoute) return (result) => routeTarget(detailRoute, resolveIdentity(resourceKey, identity, result, 'navigation'))
  const target = staticRouteTarget(listRoute)
  return target
}

function permissionRequest(
  access: AccessAdapter,
  operation: ResourceOperation | string,
  permission: string | null,
  record?: object,
): boolean {
  const currentRecord = recordContext(record)
  return access.allows({
    operation,
    permission,
    ...(currentRecord ? { record: currentRecord } : {}),
  })
}

function standardAllowed<TRecord extends object>(
  access: AccessAdapter,
  operation: ResourceOperation,
  permission: string | null,
  visible: ((context: { record?: TRecord; access: AccessAdapter }) => boolean) | undefined,
  record?: TRecord,
): boolean {
  return permissionRequest(access, operation, permission, record)
    && (!visible || visible({ record, access }))
}

function assertAllowed<TRecord extends object>(
  resourceKey: string,
  access: AccessAdapter,
  operation: ResourceOperation,
  permission: string | null,
  visible: ((context: { record?: TRecord; access: AccessAdapter }) => boolean) | undefined,
  record?: TRecord,
): void {
  if (!standardAllowed(access, operation, permission, visible, record)) {
    throw new Error(`[loom] Resource "${resourceKey}" action "${operation}" is not allowed.`)
  }
}

function wrapCollectionLoad<TContext extends CollectionLoadContext, TResult>(
  resourceKey: string,
  permission: string | null,
  visible: ((context: { access: AccessAdapter }) => boolean) | undefined,
  load: (context: TContext) => TResult,
): (context: TContext) => Promise<Awaited<TResult>> {
  return async (context): Promise<Awaited<TResult>> => {
    const runtime = useResourceRuntime()
    assertAllowed(resourceKey, runtime.adapters.access, 'list', permission, visible)
    return await load(context)
  }
}

function wrapRecordLoad<TRecord extends object, TResult>(
  resourceKey: string,
  operation: 'detail' | 'update',
  permission: string | null,
  visible: ((context: { record?: TRecord; access: AccessAdapter }) => boolean) | undefined,
  id: RecordIdentity,
  record: TRecord | undefined,
  load: (context: RecordLoadContext) => TResult,
): (context: RecordLoadContext) => Promise<Awaited<TResult>> {
  return async (context): Promise<Awaited<TResult>> => {
    const runtime = useResourceRuntime()
    assertAllowed(resourceKey, runtime.adapters.access, operation, permission, visible, record)
    return await load(bindRecordContext(resourceKey, operation, id, context))
  }
}

type ResourcePostWriteCode = 'RESOURCE_RESULT_INVALID' | 'RESOURCE_POST_WRITE_INVALIDATION_FAILED'

class ResourcePostWriteError extends Error {
  readonly retryable = false
  readonly postWrite = true

  constructor(readonly code: ResourcePostWriteCode, readonly operation: string, message: string, readonly cause?: unknown) {
    super(message)
    this.name = 'ResourcePostWriteError'
  }
}

function postWriteError(resourceKey: string, operation: string, code: ResourcePostWriteCode, detail: string, cause?: unknown): ResourcePostWriteError {
  return new ResourcePostWriteError(
    code,
    operation,
    `[loom][${code}] The ${operation} write for resource "${resourceKey}" may have completed. ${detail}`,
    cause,
  )
}

async function invalidateAfterWrite(
  runtime: ReturnType<typeof useResourceRuntime>,
  resourceKey: string,
  operation: string,
  id?: RecordIdentity,
): Promise<void> {
  try {
    await invalidateResourceData(runtime.queryClient, { resource: resourceKey, ...(id === undefined ? {} : { id }) })
  } catch (error) {
    throw postWriteError(resourceKey, operation, 'RESOURCE_POST_WRITE_INVALIDATION_FAILED', 'Cache invalidation failed after the server accepted the write.', error)
  }
}

async function invalidateInvalidResult(
  runtime: ReturnType<typeof useResourceRuntime>,
  resourceKey: string,
  operation: string,
  id: RecordIdentity | undefined,
  detail: string,
): Promise<never> {
  let invalidationError: unknown
  try {
    await invalidateResourceData(runtime.queryClient, { resource: resourceKey, ...(id === undefined ? {} : { id }) })
  } catch (error) {
    invalidationError = error
  }
  throw postWriteError(
    resourceKey,
    operation,
    'RESOURCE_RESULT_INVALID',
    invalidationError === undefined ? detail : `${detail} Cache invalidation also failed.`,
    invalidationError,
  )
}

function resultIdentity<TIdentityFunction extends ResourceIdentityFunction>(
  resourceKey: string,
  identity: TIdentityFunction,
  result: unknown,
  operation: 'create' | 'update',
): ResourceIdentityValue<TIdentityFunction> | undefined {
  if (!isRecord(result)) return undefined
  try {
    return snapshotIdentity(resolveIdentity(resourceKey, identity, result as IdentityRecord<TIdentityFunction>, operation))
  } catch {
    return undefined
  }
}

function wrapSubmit<TIdentityFunction extends ResourceIdentityFunction, TRecord extends object, TSubmitInput extends object, TSubmitResult>(
  resourceKey: string,
  operation: 'create' | 'update',
  permission: string | null,
  visible: ((context: { record?: TRecord; access: AccessAdapter }) => boolean) | undefined,
  identity: TIdentityFunction,
  id: ResourceIdentityValue<TIdentityFunction> | undefined,
  record: TRecord | undefined,
  submit: (output: TSubmitInput) => TSubmitResult,
): (output: TSubmitInput) => Promise<Awaited<TSubmitResult>> {
  return async (output): Promise<Awaited<TSubmitResult>> => {
    const runtime = useResourceRuntime()
    assertAllowed(resourceKey, runtime.adapters.access, operation, permission, visible, operation === 'update' ? record : undefined)
    const result = await submit(output)
    const resultId = resultIdentity(resourceKey, identity, result, operation)
    if (resultId === undefined || (operation === 'update' && (id === undefined || !sameIdentity(resultId, id)))) {
      await invalidateInvalidResult(
        runtime,
        resourceKey,
        operation,
        operation === 'update' ? id : undefined,
        operation === 'update'
          ? 'The successful result has no valid identity for the bound record.'
          : 'The successful result has no valid resource identity.',
      )
    }
    await invalidateAfterWrite(runtime, resourceKey, operation, operation === 'update' ? id : undefined)
    return result
  }
}

function customPermission<TRun extends (...args: never[]) => unknown>(
  resourceKey: string,
  actionName: string,
  permission: ResourceCustomPermission<TRun>,
  args: Parameters<TRun>,
): string[] | null {
  const resolved = typeof permission === 'function' ? permission(...args) : permission
  if (resolved === null) return null
  if (typeof resolved === 'string' && resolved.length > 0) return [resolved]
  if (Array.isArray(resolved) && resolved.length > 0 && resolved.every((value) => typeof value === 'string' && value.length > 0)) return [...resolved]
  throw new Error(`[loom][SURFACE_OPTION_INVALID] Resource "${resourceKey}" action "${actionName}" permission must resolve to a nonempty string, a nonempty string array, or null.`)
}

function customRowAllows(actionName: string, record: object | undefined): boolean {
  if (!record || !isRecord(record) || !Object.hasOwn(record, 'allowedOperations')) return true
  return Array.isArray(record.allowedOperations)
    && record.allowedOperations.every((name: unknown) => typeof name === 'string' && name.length > 0)
    && record.allowedOperations.includes(actionName)
}

function customAllowed<TRun extends (...args: never[]) => unknown, TIdentity extends RecordIdentity, TRecord extends object>(
  resourceKey: string,
  actionName: string,
  access: AccessAdapter,
  action: ResourceCustomCommand<TRun, TIdentity, TRecord>,
  args: Parameters<TRun>,
  record?: TRecord,
): boolean {
  const permission = customPermission(resourceKey, actionName, action.permission, args)
  const requests = permission === null ? [null] : permission
  const allowed = requests.every((required) => access.allows({
    operation: actionName,
    permission: required,
    ...(record ? { record } : {}),
  }))
  return allowed
    && customRowAllows(actionName, record)
    && (!action.visible || action.visible({ record: recordContext(record) as TRecord | undefined, access }))
}

function customHandle<
  TRun extends (...args: never[]) => unknown,
  TIdentity extends RecordIdentity,
  TRecord extends object,
  TIdentityFunction extends ResourceIdentityFunction,
>(resourceKey: string, actionName: string, action: ResourceCustomCommand<TRun, TIdentity, TRecord>, identity: TIdentityFunction): ResourceCustomHandle<TRun, TIdentity, TRecord> {
  const route = action.route
  const createHandle = (record?: TRecord): ResourceCustomHandle<TRun, TIdentity, TRecord> => ({
    can: (...args) => {
      const runtime = useResourceRuntime()
      return customAllowed(resourceKey, actionName, runtime.adapters.access, action, args, record)
    },
    run: async (...args): Promise<Awaited<ReturnType<TRun>>> => {
      const runtime = useResourceRuntime()
      if (!customAllowed(resourceKey, actionName, runtime.adapters.access, action, args, record)) {
        throw new Error(`[loom] Resource "${resourceKey}" action "${actionName}" is not allowed.`)
      }
      const result = await action.run(...args)
      await invalidateAfterWrite(runtime, resourceKey, actionName)
      return result as Awaited<ReturnType<TRun>>
    },
    ...(route ? { route } : {}),
    withContext: (context) => {
      if (!isRecord(context) || !isRecord(context.record)) {
        throw new Error(`[loom][RESOURCE_IDENTITY_INVALID] Resource "${resourceKey}" action "${actionName}" context needs a record object.`)
      }
      const snapshot = snapshotRecord(context.record as TRecord)
      resolveIdentity(resourceKey, identity, snapshot as unknown as IdentityRecord<TIdentityFunction>, actionName)
      return createHandle(snapshot)
    },
  })

  return createHandle()
}

function registerRoute<TIdentity extends RecordIdentity>(
  resourceKey: string,
  operation: string,
  route: ResourceRoute<TIdentity> | ResourceStaticRoute | undefined,
  permission: string | null | readonly string[] | ((...args: never[]) => unknown),
): void {
  if (!route) return
  const permissions = Array.isArray(permission)
    ? [...permission]
    : typeof permission === 'string'
      ? [permission]
      : undefined
  registerResourceAction(route.name, {
    resourceKey,
    action: operation,
    permission: typeof permission === 'string' ? permission : null,
    ...(Array.isArray(permission) ? { permissions } : {}),
  })
}

export function bindResource<
  TIdentityFunction extends ResourceIdentityFunction,
  const TDefinition extends ResourceDefinitionInput<TIdentityFunction>,
>(definition: TDefinition): BoundResource<
  ResourceIdentityValue<TIdentityFunction>,
  TDefinition['key'],
  ResourcePermissions<TDefinition>,
  TDefinition extends { actions: infer TActions }
    ? BoundCustomActions<TActions, ResourceIdentityValue<TIdentityFunction>, IdentityRecord<TIdentityFunction>>
    : Record<never, never>,
  ResourceBoundOperations<TDefinition, TIdentityFunction>
> {
  const resourceKey = definition.key
  const identity = definition.identity
  assertDeclaration(resourceKey, definition)
  const permissions: Record<string, string | null> = {}
  const page: Record<string, unknown> = {
    key: resourceKey,
    permissions,
    invalidate: async (args?: { id?: ResourceIdentityValue<TIdentityFunction> }) => {
      if (args?.id !== undefined) checkIdentityValue(resourceKey, 'invalidate', args.id)
      const runtime = useResourceRuntime()
      await invalidateResourceData(runtime.queryClient, { resource: resourceKey, id: args?.id === undefined ? undefined : snapshotIdentity(args.id) })
    },
    actions: {},
  }

  for (const operation of standardOperations) {
    const declaration = Reflect.get(definition, operation)
    if (declaration === undefined) continue
    assertOperation(resourceKey, operation, declaration)
    permissions[operation] = declaration.permission
    registerRoute(resourceKey, operation, declaration.route, declaration.permission)
  }

  if (definition.list) {
    const declaration = definition.list
    const table = declaration.table
    const load = table.load
    const tableBag = {
      ...table,
      resource: resourceKey,
      namespace: table.namespace ?? resourceKey,
      load: wrapCollectionLoad(resourceKey, declaration.permission, declaration.visible, load),
    }
    const list = withoutMembers(declaration, ['permission', 'route', 'visible', 'table', 'can', 'deleteRecord'])
    list.table = tableBag
    if (declaration.createRoute === undefined && definition.create?.route) list.createRoute = staticRouteTarget(definition.create.route)
    const detailDeclaration = definition.detail
    if (declaration.detailRoute === undefined && detailDeclaration?.route) {
      list.detailRoute = (record: IdentityRecord<TIdentityFunction>) => {
        const binding = snapshotRecordBinding(resourceKey, identity, record, 'detail')
        const runtime = useResourceRuntime()
        return standardAllowed(runtime.adapters.access, 'detail', detailDeclaration.permission, detailDeclaration.visible, binding.record)
          ? routeTarget(detailDeclaration.route, binding.id)
          : undefined
      }
    } else if (typeof declaration.detailRoute === 'function') {
      const detailRoute = declaration.detailRoute
      list.detailRoute = (record: IdentityRecord<TIdentityFunction>) => {
        const binding = snapshotRecordBinding(resourceKey, identity, record, 'detail')
        if (detailDeclaration) {
          const runtime = useResourceRuntime()
          if (!standardAllowed(runtime.adapters.access, 'detail', detailDeclaration.permission, detailDeclaration.visible, binding.record)) return undefined
        }
        return detailRoute(binding.record)
      }
    }
    const updateDeclaration = definition.update
    if (declaration.updateRoute === undefined && updateDeclaration?.route) {
      list.updateRoute = (record: IdentityRecord<TIdentityFunction>) => {
        const binding = snapshotRecordBinding(resourceKey, identity, record, 'update')
        const runtime = useResourceRuntime()
        return standardAllowed(runtime.adapters.access, 'update', updateDeclaration.permission, updateDeclaration.visible, binding.record)
          ? routeTarget(updateDeclaration.route, binding.id)
          : undefined
      }
    } else if (typeof declaration.updateRoute === 'function') {
      const updateRoute = declaration.updateRoute
      list.updateRoute = (record: IdentityRecord<TIdentityFunction>) => {
        const binding = snapshotRecordBinding(resourceKey, identity, record, 'update')
        if (updateDeclaration) {
          const runtime = useResourceRuntime()
          if (!standardAllowed(runtime.adapters.access, 'update', updateDeclaration.permission, updateDeclaration.visible, binding.record)) return undefined
        }
        return updateRoute(binding.record)
      }
    }
    list.can = (operation: ResourceOperation, record?: IdentityRecord<TIdentityFunction>) => {
      const current = definition[operation]
      if (!current) return false
      const visible = 'visible' in current ? current.visible : undefined
      const row = record !== undefined && isStandardRowOperation(operation)
        ? snapshotRecordBinding(resourceKey, identity, record, operation).record
        : undefined
      return standardAllowed(useResourceRuntime().adapters.access, operation, current.permission, visible, row)
    }
    const deleteDeclaration = definition.delete
    if (deleteDeclaration) {
      list.deleteRecord = async (record: IdentityRecord<TIdentityFunction>) => {
        const binding = snapshotRecordBinding(resourceKey, identity, record, 'delete')
        const runtime = useResourceRuntime()
        assertAllowed(resourceKey, runtime.adapters.access, 'delete', deleteDeclaration.permission, deleteDeclaration.visible, binding.record)
        const result = await deleteDeclaration.run(binding.id)
        await invalidateAfterWrite(runtime, resourceKey, 'delete', binding.id)
        return result
      }
    }
    page.list = list
  }

  if (definition.create) {
    const declaration = definition.create
    const form = declaration.form
    const submit = form.submit
    const target = formTarget(
      resourceKey,
      identity,
      declaration.defaultTo,
      definition.detail?.route,
      definition.list?.route,
    )
    page.create = {
      ...withoutMembers(declaration, ['permission', 'route', 'visible', 'form']),
      ...(target !== undefined ? { defaultTo: target } : {}),
      form: {
        ...form,
        resource: resourceKey,
        namespace: form.namespace ?? `${resourceKey}.create`,
        submit: wrapSubmit(resourceKey, 'create', declaration.permission, declaration.visible, identity, undefined, undefined, submit),
      },
    }
  }

  if (definition.detail) {
    const declaration = definition.detail
    page.detail = (binding: { id: ResourceIdentityValue<TIdentityFunction>; record?: IdentityRecord<TIdentityFunction> }) => {
      const bound = snapshotBinding(resourceKey, identity, binding, 'detail')
      const primitive = declaration.detail(bound)
      const listRoute = definition.list?.route
      const backTo = declaration.backTo === undefined ? staticRouteTarget(listRoute) : declaration.backTo
      return {
        ...withoutMembers(declaration, ['permission', 'route', 'visible', 'detail']),
        ...(backTo !== undefined ? { backTo } : {}),
        detail: {
          ...primitive,
          id: bound.id,
          resource: resourceKey,
          namespace: primitive.namespace ?? `${resourceKey}.detail.${identityToken(bound.id)}`,
          load: wrapRecordLoad(resourceKey, 'detail', declaration.permission, declaration.visible, bound.id, bound.record, primitive.load),
        },
      }
    }
  }

  if (definition.update) {
    const declaration = definition.update
    page.update = (binding: { id: ResourceIdentityValue<TIdentityFunction>; record?: IdentityRecord<TIdentityFunction> }) => {
      const bound = snapshotBinding(resourceKey, identity, binding, 'update')
      const primitive = declaration.form(bound)
      const submit = primitive.submit
      const target = formTarget(
        resourceKey,
        identity,
        declaration.defaultTo,
        definition.detail?.route,
        definition.list?.route,
      )
      const form = {
        ...primitive,
        id: bound.id,
        resource: resourceKey,
        namespace: primitive.namespace ?? `${resourceKey}.update.${identityToken(bound.id)}`,
        submit: wrapSubmit(resourceKey, 'update', declaration.permission, declaration.visible, identity, bound.id, bound.record, submit),
        load: wrapRecordLoad(resourceKey, 'update', declaration.permission, declaration.visible, bound.id, bound.record, primitive.load),
      }
      return {
        ...withoutMembers(declaration, ['permission', 'route', 'visible', 'form']),
        ...(target !== undefined ? { defaultTo: target } : {}),
        form,
      }
    }
  }

  if (definition.delete) {
    const declaration = definition.delete
    page.delete = (binding: { id: ResourceIdentityValue<TIdentityFunction>; record?: IdentityRecord<TIdentityFunction> }) => {
      const bound = snapshotBinding(resourceKey, identity, binding, 'delete')
      return {
        can: () => standardAllowed(useResourceRuntime().adapters.access, 'delete', declaration.permission, declaration.visible, bound.record),
        route: declaration.route,
        run: async () => {
          const runtime = useResourceRuntime()
          assertAllowed(resourceKey, runtime.adapters.access, 'delete', declaration.permission, declaration.visible, bound.record)
          const result = await declaration.run(bound.id)
          await invalidateAfterWrite(runtime, resourceKey, 'delete', bound.id)
          return result
        },
      }
    }
  }

  if (definition.actions) {
    const actions: Record<string, unknown> = {}
    for (const [actionName, action] of Object.entries(definition.actions)) {
      if (standardOperations.includes(actionName as typeof standardOperations[number])) {
        throw new Error(`[loom][SURFACE_OPTION_INVALID] Resource "${resourceKey}" standard operation "${actionName}" belongs at the top level.`)
      }
      if (!isRecord(action) || typeof action.run !== 'function') {
        throw new Error(`[loom][SURFACE_OPTION_INVALID] Resource "${resourceKey}" action "${actionName}" needs a run function.`)
      }
      const permission = Reflect.get(action, 'permission')
      const route = Reflect.get(action, 'route') as ResourceRoute | undefined
      for (const member of Object.keys(action)) {
        if (!['run', 'permission', 'visible', 'route'].includes(member)) {
          throw new Error(`[loom][SURFACE_OPTION_INVALID] Resource "${resourceKey}" action "${actionName}" member "${member}" is not supported.`)
        }
      }
      if (typeof permission !== 'string' && !Array.isArray(permission) && typeof permission !== 'function' && permission !== null) {
        throw new Error(`[loom][SURFACE_OPTION_INVALID] Resource "${resourceKey}" action "${actionName}" needs a permission policy.`)
      }
      if (typeof permission === 'string' && permission.length === 0) throw new Error(`[loom][SURFACE_OPTION_INVALID] Resource "${resourceKey}" action "${actionName}" permission must not be empty.`)
      if (Array.isArray(permission) && (!permission.length || permission.some((value) => typeof value !== 'string' || value.length === 0))) {
        throw new Error(`[loom][SURFACE_OPTION_INVALID] Resource "${resourceKey}" action "${actionName}" needs nonempty permission strings.`)
      }
      if (typeof action.visible !== 'undefined' && typeof action.visible !== 'function') {
        throw new Error(`[loom][SURFACE_OPTION_INVALID] Resource "${resourceKey}" action "${actionName}" visible must be a function.`)
      }
      registerRoute(resourceKey, actionName, route, permission as string | null | readonly string[] | ((...args: never[]) => unknown))
      const command = customHandle(
        resourceKey,
        actionName,
        action as unknown as ResourceCustomCommand<(...args: never[]) => unknown, ResourceIdentityValue<TIdentityFunction>, IdentityRecord<TIdentityFunction>>,
        identity,
      )
      actions[actionName] = command
    }
    page.actions = actions
  }

  return page as unknown as BoundResource<
    ResourceIdentityValue<TIdentityFunction>,
    TDefinition['key'],
    ResourcePermissions<TDefinition>,
    TDefinition extends { actions: infer TActions }
      ? BoundCustomActions<TActions, ResourceIdentityValue<TIdentityFunction>, IdentityRecord<TIdentityFunction>>
      : Record<never, never>,
    ResourceBoundOperations<TDefinition, TIdentityFunction>
  >
}
