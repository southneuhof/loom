import FormView from '../FormView.vue'
import type { FormProps } from '../../../contracts'
import { h } from 'vue'

const fields = { name: { label: 'Name' } }
const action = {
  fields,
  run: async (input: { name: string }) => ({ id: '1', name: input.name }),
}

h(FormView, { ...action })
h(FormView, { ...action, id: '1', load: async () => ({ name: 'Admin' }) })
h(FormView, { formProps: { fields, submit: async () => undefined } satisfies FormProps })

// @ts-expect-error FormView no longer accepts the old raw prop name.
h(FormView, { form: { fields, submit: async () => undefined } })
