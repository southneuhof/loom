/**
 * Compile-time tests for the field catalog. Type-checked by the framework
 * `type-check`; excluded from vitest by filename.
 */
import { resolveFields } from '../../fields'
import type { FieldDefinition } from '../index'
import type { FrameworkFieldDefaultsInput } from '../../fields'
import { createInputPropsRegistry } from '../../renderers/inputProps'

interface Incident {
  incident_name: string
  rel_section_id: string
  is_accident: boolean
}

interface IncidentDraft {
  incident_name: string
  section_id: string
  is_accident: boolean
}

const incidentFields = {
  incident_name: {
    label: 'Nama Insiden',
    table: { sortable: true },
    form: { renderer: 'text' },
  },
  section_id: {
    label: 'Ruas',
    display: { read: (record: Incident) => record.rel_section_id },
    form: { write: (value: unknown) => value },
  },
  secret: {
    table: false,
    detail: false,
  },
} satisfies Record<string, FieldDefinition<Incident, IncidentDraft>>

/* Catalog keys stay literal. */
type IncidentFieldKey = keyof typeof incidentFields
const knownKey: IncidentFieldKey = 'incident_name'
void knownKey
// @ts-expect-error unknown catalog key
const unknownKey: IncidentFieldKey = 'not_a_field'
void unknownKey

/* `display.read` sees the record type; `form.write` sees the control value. */
const readsRecord: NonNullable<FieldDefinition<Incident, IncidentDraft>['display']>['read'] = (record) => record.rel_section_id
void readsRecord
const invalidRead = {
  section_id: {
    display: {
      // @ts-expect-error the record has no `section_id` property
      read: (record: Incident) => record.section_id,
    },
  },
} satisfies Record<string, FieldDefinition<Incident, IncidentDraft>>
void invalidRead

const invalidTopLevelRead = {
  incident_name: {
    // @ts-expect-error display access belongs under display.read
    read: (record: Incident) => record.incident_name,
  },
} satisfies Record<string, FieldDefinition<Incident, IncidentDraft>>
void invalidTopLevelRead

const invalidTopLevelWrite = {
  incident_name: {
    // @ts-expect-error submit conversion belongs under form.write
    write: (value: string) => value,
  },
} satisfies Record<string, FieldDefinition<Incident, IncidentDraft>>
void invalidTopLevelWrite

/* Projections may be excluded with `false`, but not with an arbitrary value. */
const excluded = { secret: { table: false } } satisfies Record<string, FieldDefinition<Incident>>
void excluded
const invalidProjection = {
  secret: {
    // @ts-expect-error a projection is either config or false
    table: 'hidden',
  },
} satisfies Record<string, FieldDefinition<Incident>>
void invalidProjection

/* Widget selection is `renderer` on every surface. */
const renderers = {
  incident_name: { table: { renderer: 'chip' }, detail: { renderer: 'chip' }, form: { renderer: 'text' } },
} satisfies Record<string, FieldDefinition<Incident>>
void renderers
const invalidRenderer = {
  incident_name: {
    // @ts-expect-error `type` is not a field-config key
    form: { type: 'text' },
  },
} satisfies Record<string, FieldDefinition<Incident>>
void invalidRenderer

const lookup = {
  incident_name: { form: { renderer: 'lookup', source: { resource: 'sections' } } },
} satisfies Record<string, FieldDefinition<Incident>>
void lookup
const invalidSource = {
  incident_name: {
    // @ts-expect-error source is only authored for form projections
    table: { source: { resource: 'sections' } },
  },
} satisfies Record<string, FieldDefinition<Incident>>
void invalidSource

/* Behavior lives on the form projection only and accepts functions only. */
const behavior = {
  incident_name: { form: { behavior: { visible: ({ draft }) => draft.is_accident } } },
} satisfies Record<string, FieldDefinition<Incident, IncidentDraft>>
void behavior
const invalidTableBehavior = {
  incident_name: {
    // @ts-expect-error behavior is a form concept; table carries none
    table: { behavior: { visible: () => true } },
  },
} satisfies Record<string, FieldDefinition<Incident, IncidentDraft>>
void invalidTableBehavior
const invalidConstantBehavior = {
  incident_name: {
    form: {
      // @ts-expect-error constants belong in the static projection
      behavior: { visible: true },
    },
  },
} satisfies Record<string, FieldDefinition<Incident, IncidentDraft>>
void invalidConstantBehavior

/* Resolution returns ordered surface fields. */
const tableFields = resolveFields({ fields: incidentFields, surface: 'table', keys: ['incident_name'] })
const firstLabel: string = tableFields[0].label
void firstLabel

const keyedDefaults: FrameworkFieldDefaultsInput = { fields: { incident_name: { form: { source: { resource: 'x' }, props: { required: true } } } } }
void keyedDefaults
const surfaceDefaults: FrameworkFieldDefaultsInput = { shared: { renderer: 'text' } }
void surfaceDefaults
// @ts-expect-error uniform renderer props belong in inputProps, not fieldDefaults
const invalidSurfaceDefaults: FrameworkFieldDefaultsInput = { form: { props: { dense: true } } }
void invalidSurfaceDefaults

const invalidInputWriter = createInputPropsRegistry({
  number: {
    // @ts-expect-error input registrations cannot declare submit writers
    write: (value: unknown) => value,
  },
})
void invalidInputWriter
