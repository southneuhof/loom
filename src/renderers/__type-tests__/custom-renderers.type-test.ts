/**
 * Compile-time cases for augmented custom renderer keys.
 * Type-checked by the framework `type-check`; excluded from vitest by filename.
 */
import type { FormRendererComponents, FormRendererProps } from '../formContracts'
import { createRendererRegistries } from '../registry'
import './test-renderers'
import { ratingInputForTests } from './test-renderers'

// Correct custom props pass.
const ratingOk: FormRendererProps<'rating'> = { max: 5, extra: true }
void ratingOk

// Incorrect known custom props fail.
const ratingBad: FormRendererProps<'rating'> = {
  // @ts-expect-error RatingInput.max is number, not string
  max: 'high',
}
void ratingBad

// Extra custom props pass.
const ratingExtra: FormRendererProps<'rating'> = { stars: 5 }
void ratingExtra

// Registration under an undeclared spelling fails at the registry seam.
const testRegistries = createRendererRegistries({ form: { rating: ratingInputForTests } })
testRegistries.form.register('rating', ratingInputForTests)
// @ts-expect-error custom renderer must register under its declared key
testRegistries.form.register('ratingMisspelled', ratingInputForTests)
// @ts-expect-error custom renderer input must use its declared key
createRendererRegistries({ form: { ratingMisspelled: ratingInputForTests } })

type Undeclared = 'unregistered-widget' extends keyof FormRendererComponents ? 'registered' : 'missing'
const undeclared: Undeclared = 'missing'
void undeclared
