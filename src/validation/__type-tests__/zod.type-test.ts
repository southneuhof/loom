import { z } from 'zod/v3'
import { z as z4 } from 'zod/v4'
import { fromZod } from '../zod'
import type { ValidationSchema } from '../../contracts'

const classic = fromZod(z.object({ name: z.string() }))
const classicSchema: ValidationSchema<{ name: string }> = classic
void classicSchema

const classicTransformed = fromZod(
  z.object({ name: z.string() }).transform(({ name }) => ({ length: name.length })),
)
const classicTransformedSchema: ValidationSchema<{ length: number }> = classicTransformed
void classicTransformedSchema

const v4 = fromZod(z4.object({ active: z4.boolean() }))
const v4Schema: ValidationSchema<{ active: boolean }> = v4
void v4Schema

const v4Transformed = fromZod(
  z4.object({ ids: z4.array(z4.object({ id: z4.string() })) })
    .transform(({ ids }) => ids.map(({ id }) => id)),
)
const v4TransformedSchema: ValidationSchema<string[]> = v4Transformed
void v4TransformedSchema

// @ts-expect-error fromZod accepts a schema, not a caller-supplied output type.
fromZod<{ name: string }>(z.object({ name: z.string() }))
