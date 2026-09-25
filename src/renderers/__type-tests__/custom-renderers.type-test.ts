import type { FormRendererComponents, FormRendererProps } from '../formContracts'
import { defineForm } from '../../forms/defineForm'
import { createRendererRegistries } from '../registry'
import './test-renderers'
import { ratingInputForTests } from './test-renderers'
import { z } from 'zod'

const ratingOk: FormRendererProps<'rating'> = { max: 5, mode: 'stars' }
const ratingBad: FormRendererProps<'rating'> = {
  // @ts-expect-error RatingInput.max is numeric.
  max: 'high',
  mode: 'stars',
}
const ratingExtra: FormRendererProps<'rating'> = {
  // @ts-expect-error The component does not publish this prop.
  stars: 5,
  mode: 'stars',
}

const missingRequiredPropSchema = z.object({ rating: z.number() })
const missingRequiredProp = defineForm({
  schema: missingRequiredPropSchema,
  // @ts-expect-error RatingInput requires its mode prop.
  fields: { rating: { renderer: 'rating' } },
})

const numericSchema = z.object({ rating: z.number() })
const numericRatingForm = defineForm({
  schema: numericSchema,
  fields: { rating: { renderer: 'rating', props: { mode: 'stars' } } },
})
type RatingPropsUnion = { mode: 'stars' } | { mode?: never }
declare const ratingPropsUnion: RatingPropsUnion
const unionMissingRequiredProp = defineForm({
  schema: numericSchema,
  // @ts-expect-error Every props union branch must supply RatingInput.mode.
  fields: { rating: { renderer: 'rating', props: ratingPropsUnion } },
})

const stringSchema = z.object({ rating: z.string() })
const invalidStringRatingForm = defineForm({
  schema: stringSchema,
  // @ts-expect-error RatingInput emits a number.
  fields: { rating: { renderer: 'rating', props: { mode: 'stars' } } },
})

const testRegistries = createRendererRegistries({ form: { rating: ratingInputForTests } })
testRegistries.form.register('rating', ratingInputForTests)

// @ts-expect-error Custom renderers register under their declared key.
testRegistries.form.register('ratingMisspelled', ratingInputForTests)
// @ts-expect-error Custom renderer maps use their declared key.
createRendererRegistries({ form: { ratingMisspelled: ratingInputForTests } })

type Undeclared = 'unregistered-widget' extends keyof FormRendererComponents ? 'registered' : 'missing'
const undeclared: Undeclared = 'missing'

void [ratingOk, ratingBad, ratingExtra, missingRequiredProp, numericRatingForm, unionMissingRequiredProp, invalidStringRatingForm, undeclared]
