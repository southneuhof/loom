import type { AccessAdapter, CollectionLoadContext, QueryNamespace, RecordIdentity, RecordLoadContext, ResourceOperation } from '../contracts'
import { invalidateResourceData } from '../query/client'
import { stableValue } from '../query/keys'
import { checkIdentityValue, isRecordIdentity } from './identity'
import { useResourceOperationRuntime } from './runtime'
import { registerResourceAction } from './routeAccess'
import { isStandardRowOperation } from './operations'
import type {
  BoundResource,
  IdentityRecord,
  ResourceCustomContext,
  ResourceCustomCommand,
  ResourceCustomHandle,
  ResourceCustomPermission,
  ResourceDefinitionInput,
  ResourceIdentityFunction,
  ResourceIdentityValue,
  ResourceRoute,
  ResourceStaticRoute,
} from './operations'
import type { RouteLocationRaw } from 'vue-router'

const standardOperations = ['list', 'create', 'detail', 'update', 'delete'] as const
const customContextRecordKey = 'record'

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
  const members: Record<string, readonly string[]> = {
    list: ['permission', 'route', 'title', 'description', 'visible', 'table'],
    create: ['permission', 'route', 'title', 'description', 'visible', 'defaultTo', 'successMessage', 'form'],
    detail: ['permission', 'route', 'title', 'backTo', 'visible', 'detail'],
    update: ['permission', 'route', 'title', 'description', 'visible', 'defaultTo', 'successMessage', 'form'],
    delete: ['permission', 'route', 'visible', 'run'],
  }
  for (const member of Object.keys(entry)) {
    if (!members[operation]?.includes(member)) {
      throw new Error(`[loom][SURFACE_OPTION_INVALID] Resource "${resourceKey}" operation "${operation}" member "${member}" is not supported.`)
    }
  }
}

function identityToken(value: RecordIdentity): string {
  return JSON.stringify(stableValue(value))
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

function assertBinding<TIdentityFunction extends ResourceIdentityFunction>(
  resourceKey: string,
  identity: TIdentityFunction,
  binding: { id: ResourceIdentityValue<TIdentityFunction>; record?: IdentityRecord<TIdentityFunction> },
  operation: string,
): void {
  checkIdentityValue(resourceKey, operation, binding.id)
  if (binding.record !== undefined) {
    const rowId = resolveIdentity(resourceKey, identity, binding.record, operation)
    if (identityToken(rowId) !== identityToken(binding.id)) {
      throw new Error(`[loom][RESOURCE_IDENTITY_INVALID] Resource "${resourceKey}" operation "${operation}" record identity conflicts with its bound id.`)
    }
  }
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
): ((result: TResult) => RouteLocationRaw | undefined) | undefined {
  if (declared === false) return undefined
  if (declared !== undefined) return typeof declared === 'function' ? declared : () => declared
  if (detailRoute) return (result) => routeTarget(detailRoute, resolveIdentity(resourceKey, identity, result, 'navigation'))
  const target = staticRouteTarget(listRoute)
  return target ? () => target : undefined
}

function permissionRequest(
  access: AccessAdapter,
  operation: ResourceOperation | string,
  permission: string | null,
  record?: object,
): boolean {
  if (permission === null) return true
  const currentRecord = recordContext(record)
  return access.allows({
    operation,
    permission,
    ...(currentRecord && isStandardRowOperation(operation) ? { record: currentRecord } : {}),
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
    const runtime = useResourceOperationRuntime()
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
    const runtime = useResourceOperationRuntime()
    assertAllowed(resourceKey, runtime.adapters.access, operation, permission, visible, record)
    return await load(bindRecordContext(resourceKey, operation, id, context))
  }
}

function wrapSubmit<TRecord extends object, TSubmitInput extends object, TSubmitResult>(
  resourceKey: string,
  operation: 'create' | 'update',
  permission: string | null,
  visible: ((context: { record?: TRecord; access: AccessAdapter }) => boolean) | undefined,
  id: RecordIdentity | undefined,
  record: TRecord | undefined,
  submit: (output: TSubmitInput) => TSubmitResult,
): (output: TSubmitInput) => Promise<Awaited<TSubmitResult>> {
  return async (output): Promise<Awaited<TSubmitResult>> => {
    const runtime = useResourceOperationRuntime()
    assertAllowed(resourceKey, runtime.adapters.access, operation, permission, visible, operation === 'update' ? record : undefined)
    const result = await submit(output)
    await invalidateResourceData(runtime.queryClient, { resource: resourceKey, ...(id === undefined ? {} : { id }) })
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

function rowContext(value: unknown): value is { record: Record<string, unknown> } {
  return isRecord(value) && isRecord(value[customContextRecordKey])
}

function splitCustomContext<TRun extends (...args: never[]) => unknown, TRecord extends object>(
  args: [...Parameters<TRun>, context?: ResourceCustomContext<TRecord>],
  runLength: number,
): { args: Parameters<TRun>; record?: Record<string, unknown> } {
  const last = args[args.length - 1]
  if (args.length > runLength && rowContext(last)) return { args: args.slice(0, -1) as unknown as Parameters<TRun>, record: last.record }
  return { args: args as unknown as Parameters<TRun> }
}

function customRowAllows(actionName: string, record: Record<string, unknown> | undefined): boolean {
  if (!record || record.allowedOperations === undefined) return true
  return Array.isArray(record.allowedOperations) && record.allowedOperations.includes(actionName)
}

function customAllowed<TRun extends (...args: never[]) => unknown, TIdentity extends RecordIdentity, TRecord extends object>(
  resourceKey: string,
  actionName: string,
  access: AccessAdapter,
  action: ResourceCustomCommand<TRun, TIdentity>,
  args: [...Parameters<TRun>, context?: ResourceCustomContext<TRecord>],
): boolean {
  const { args: runArgs, record } = splitCustomContext<TRun, TRecord>(args, action.run.length)
  const permission = customPermission(resourceKey, actionName, action.permission, runArgs)
  const allowed = permission === null
    || permission.every((required) => access.allows({ operation: actionName, permission: required }))
  return allowed
    && customRowAllows(actionName, record)
    && (!action.visible || action.visible({ record: recordContext(record), access }))
}

function customHandle<
  TRun extends (...args: never[]) => unknown,
  TIdentity extends RecordIdentity,
  TRecord extends object,
>(resourceKey: string, actionName: string, action: ResourceCustomCommand<TRun, TIdentity>): ResourceCustomHandle<TRun, TIdentity, TRecord> {
  const route = action.route
  const can = (...args: [...Parameters<TRun>, context?: ResourceCustomContext<TRecord>]) => {
    const runtime = useResourceOperationRuntime()
    return customAllowed(resourceKey, actionName, runtime.adapters.access, action, args)
  }
  const run = async (...args: [...Parameters<TRun>, context?: ResourceCustomContext<TRecord>]): Promise<Awaited<ReturnType<TRun>>> => {
    const runtime = useResourceOperationRuntime()
    if (!customAllowed(resourceKey, actionName, runtime.adapters.access, action, args)) {
      throw new Error(`[loom] Resource "${resourceKey}" action "${actionName}" is not allowed.`)
    }
    const { args: runArgs } = splitCustomContext<TRun, TRecord>(args, action.run.length)
    const invoke = action.run as (...values: Parameters<TRun>) => ReturnType<TRun>
    const result = await invoke(...runArgs)
    await invalidateResourceData(runtime.queryClient, { resource: resourceKey })
    return result
  }
  return { run, can, ...(route ? { route } : {}) }
}

function registerRoute(
  resourceKey: string,
  operation: string,
  route: ResourceRoute | ResourceStaticRoute | undefined,
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
>(definition: TDefinition): BoundResource<TDefinition, TIdentityFunction> {
  const resourceKey = definition.key
  const identity = definition.identity
  assertDeclaration(resourceKey, definition)
  const permissions: Record<string, string | null> = {}
  const page: Record<string, unknown> = {
    key: resourceKey,
    permissions,
    invalidate: async (args?: { id?: ResourceIdentityValue<TIdentityFunction> }) => {
      if (args?.id !== undefined) checkIdentityValue(resourceKey, 'invalidate', args.id)
      const runtime = useResourceOperationRuntime()
      await invalidateResourceData(runtime.queryClient, { resource: resourceKey, id: args?.id })
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
    const list: Record<string, unknown> = {
      title: declaration.title,
      description: declaration.description,
      table: tableBag,
    }

    if (definition.create?.route) {
      list.createRoute = staticRouteTarget(definition.create.route)
    }
    const detailDeclaration = definition.detail
    if (detailDeclaration?.route) {
      list.detailRoute = (record: IdentityRecord<TIdentityFunction>) => {
        const id = resolveIdentity(resourceKey, identity, record, 'detail')
        return standardAllowed(useResourceOperationRuntime().adapters.access, 'detail', detailDeclaration.permission, detailDeclaration.visible, record)
          ? routeTarget(detailDeclaration.route, id)
          : undefined
      }
    }
    const updateDeclaration = definition.update
    if (updateDeclaration?.route) {
      list.updateRoute = (record: IdentityRecord<TIdentityFunction>) => {
        const id = resolveIdentity(resourceKey, identity, record, 'update')
        return standardAllowed(useResourceOperationRuntime().adapters.access, 'update', updateDeclaration.permission, updateDeclaration.visible, record)
          ? routeTarget(updateDeclaration.route, id)
          : undefined
      }
    }
    list.can = (operation: ResourceOperation, record?: IdentityRecord<TIdentityFunction>) => {
      const current = definition[operation]
      if (!current) return false
      const visible = 'visible' in current ? current.visible : undefined
      return standardAllowed(useResourceOperationRuntime().adapters.access, operation, current.permission, visible, record)
    }
    const deleteDeclaration = definition.delete
    if (deleteDeclaration) {
      list.deleteRecord = async (record: IdentityRecord<TIdentityFunction>) => {
        const id = resolveIdentity(resourceKey, identity, record, 'delete')
        const runtime = useResourceOperationRuntime()
        assertAllowed(resourceKey, runtime.adapters.access, 'delete', deleteDeclaration.permission, deleteDeclaration.visible, record)
        const result = await deleteDeclaration.run(id)
        await invalidateResourceData(runtime.queryClient, { resource: resourceKey, id })
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
      title: declaration.title,
      description: declaration.description,
      ...(target ? { defaultTo: target } : {}),
      ...(declaration.successMessage !== undefined ? { successMessage: declaration.successMessage } : {}),
      form: {
        ...form,
        resource: resourceKey,
        namespace: form.namespace ?? `${resourceKey}.create`,
        submit: wrapSubmit(resourceKey, 'create', declaration.permission, declaration.visible, undefined, undefined, submit),
      },
    }
  }

  if (definition.detail) {
    const declaration = definition.detail
    page.detail = (binding: { id: ResourceIdentityValue<TIdentityFunction>; record?: IdentityRecord<TIdentityFunction> }) => {
      assertBinding(resourceKey, identity, binding, 'detail')
      const primitive = declaration.detail(binding)
      const listRoute = definition.list?.route
      const backTo = declaration.backTo
        ?? staticRouteTarget(listRoute)
      const record = binding.record
      return {
        title: declaration.title,
        ...(backTo ? { backTo } : {}),
        detail: {
          ...primitive,
          id: binding.id,
          resource: resourceKey,
          namespace: primitive.namespace ?? `${resourceKey}.detail.${identityToken(binding.id)}`,
          load: wrapRecordLoad(resourceKey, 'detail', declaration.permission, declaration.visible, binding.id, record, primitive.load),
        },
      }
    }
  }

  if (definition.update) {
    const declaration = definition.update
    page.update = (binding: { id: ResourceIdentityValue<TIdentityFunction>; record?: IdentityRecord<TIdentityFunction> }) => {
      assertBinding(resourceKey, identity, binding, 'update')
      const primitive = declaration.form(binding)
      const submit = primitive.submit
      const record = binding.record
      const target = formTarget(
        resourceKey,
        identity,
        declaration.defaultTo,
        definition.detail?.route,
        definition.list?.route,
      )
      const form = {
        ...primitive,
        id: binding.id,
        resource: resourceKey,
        namespace: primitive.namespace ?? `${resourceKey}.update.${identityToken(binding.id)}`,
        submit: wrapSubmit(resourceKey, 'update', declaration.permission, declaration.visible, binding.id, record, submit),
        load: wrapRecordLoad(resourceKey, 'update', declaration.permission, declaration.visible, binding.id, record, primitive.load),
      }
      return {
        title: declaration.title,
        description: declaration.description,
        ...(target ? { defaultTo: target } : {}),
        ...(declaration.successMessage !== undefined ? { successMessage: declaration.successMessage } : {}),
        form,
      }
    }
  }

  if (definition.delete) {
    const declaration = definition.delete
    page.delete = (binding: { id: ResourceIdentityValue<TIdentityFunction>; record?: IdentityRecord<TIdentityFunction> }) => {
      assertBinding(resourceKey, identity, binding, 'delete')
      const record = binding.record
      return {
        can: () => standardAllowed(useResourceOperationRuntime().adapters.access, 'delete', declaration.permission, declaration.visible, record),
        route: declaration.route,
        run: async () => {
          const runtime = useResourceOperationRuntime()
          assertAllowed(resourceKey, runtime.adapters.access, 'delete', declaration.permission, declaration.visible, record)
          const result = await declaration.run(binding.id)
          await invalidateResourceData(runtime.queryClient, { resource: resourceKey, id: binding.id })
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
      const command = customHandle(resourceKey, actionName, action as unknown as ResourceCustomCommand)
      actions[actionName] = command
    }
    page.actions = actions
  }

  return page as unknown as BoundResource<TDefinition, TIdentityFunction>
}
