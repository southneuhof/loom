import { z } from 'zod'
import { defineResource } from '../../resources/defineResource'
import { defineForm } from '../../forms/defineForm'
import type { FormRendererProps } from '../formContracts'

const schema = z.object({ name: z.string(), latitude: z.number().nullable(), longitude: z.number().nullable() })
const operations: FormRendererProps<'location'>['operations'] = {
  autocomplete: () => [],
  detail: () => ({ lat: 0, lng: 0 }),
  mapConfig: () => ({ apiKey: '' }),
}

export const pinDraft = defineForm({
  schema,
  fields: {
    name: { renderer: 'text' },
    location: {
      renderer: 'location',
      props: { operations },
      binding: {
        keys: ['latitude', 'longitude'],
        read: ({ latitude, longitude }) => (latitude == null || longitude == null ? null : { lat: latitude, lng: longitude }),
        write: ({ lat, lng }) => ({ latitude: lat, longitude: lng }),
      },
    },
  },
})

export const pinForm = defineForm({
  ...pinDraft,
  submit: (values) => ({ name: values.name, latitude: values.latitude, longitude: values.longitude }),
})

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
type Assert<T extends true> = T
export const bindingKeys: readonly ['latitude', 'longitude'] = pinForm.fields.location.binding.keys
export type BindingWriteValue = Assert<Equal<Parameters<typeof pinForm.fields.location.binding.write>[0], { lat: number; lng: number }>>
export type BindingReadValues = Assert<Equal<Parameters<typeof pinForm.fields.location.binding.read>[0]['latitude'], number | null | undefined>>

export const pins = defineResource({
  key: 'binding-pins',
  identity: (record: { id: string }) => record.id,
  update: {
    permission: null,
    form: ({ id }) => ({
      ...defineForm({ ...pinDraft, submit: (values) => ({ id: String(id), ...values }) }),
      load: () => ({ name: 'Harbor', latitude: 0, longitude: 0 }),
    }),
  },
})
