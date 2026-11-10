import { getCurrentInstance } from 'vue'

export function formSessionHost(): { modelValuePresent: boolean } {
  const props = getCurrentInstance()?.vnode.props ?? {}
  for (const member of ['run', 'form']) {
    if (Object.hasOwn(props, member)) {
      throw new Error(`[loom][SURFACE_OPTION_INVALID] Form member "${member}" was removed; expected a flat Form prop bag.`)
    }
  }
  return { modelValuePresent: Object.hasOwn(props, 'modelValue') || Object.hasOwn(props, 'model-value') }
}
