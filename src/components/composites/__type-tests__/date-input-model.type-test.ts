import { z } from 'zod/v4'
import { defineForm } from '../../../forms/defineForm'

const mismatchedDate = defineForm({
  schema: z.object({ scheduledAt: z.date() }),
  // @ts-expect-error DateInput emits a string model and cannot bind to a Date input schema.
  fields: { scheduledAt: { renderer: 'date' } },
})

const scheduledAtForm = defineForm({
  schema: z.object({ scheduledAt: z.string().nullable() }).transform(({ scheduledAt }) => ({
    scheduledAt: scheduledAt === null ? undefined : new Date(`${scheduledAt}T00:00:00.000Z`),
  })),
  fields: { scheduledAt: { renderer: 'date' } },
})

void [mismatchedDate, scheduledAtForm]
