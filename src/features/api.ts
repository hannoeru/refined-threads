import type { Post } from '../model'
import type { LookupNeeds, ProfileData } from '../profile/lookups'
import type { WhenVisible } from './services/visible'

export type OptionSpec
  = | { type: 'boolean', default: boolean }
    | { type: 'select', default: string, choices: readonly string[] }
    | { type: 'number', default: number, min: number, max: number }
    | { type: 'text', default: string, maxLength?: number }

export type OptionSpecs = Record<string, OptionSpec>

export type OptionValues<Specs extends OptionSpecs> = {
  [Key in keyof Specs]: Specs[Key] extends { type: 'boolean' }
    ? boolean
    : Specs[Key] extends { type: 'number' }
      ? number
      : Specs[Key] extends { type: 'select', choices: readonly (infer Choice)[] }
        ? Choice
        : string
}

export interface PostStream {
  get: (code: string) => Post | undefined
  subscribe: (listener: (posts: Post[]) => void, signal: AbortSignal) => void
}

export interface AccountLookups {
  data: (pk: string) => ProfileData
  want: (pk: string, username: string, needs: LookupNeeds) => void
  loading: (pk: string) => boolean
  subscribe: (listener: (pk: string) => void, signal: AbortSignal) => void
}

export interface FeatureContext<Options> {
  signal: AbortSignal
  options: Options
  document: Document
  posts: PostStream
  lookups: AccountLookups
  observe: <E extends Element>(selector: string, callback: (element: E) => void) => void
  whenVisible: WhenVisible
  addStyle: (css: string) => void
  t: (key: string, substitutions?: string[]) => string
}

export interface Feature<Specs extends OptionSpecs = OptionSpecs> {
  id: string
  enabledByDefault: boolean
  options: Specs
  shortcuts?: Record<string, string>
  include?: (url: URL) => boolean
  // eslint-disable-next-line ts/method-signature-style -- the registry holds features with different option types, which needs method parameter bivariance
  init(ctx: FeatureContext<OptionValues<Specs>>): void | Promise<void>
}

export function defineFeature<Specs extends OptionSpecs = Record<never, never>>(feature: {
  id: string
  enabledByDefault: boolean
  options?: Specs
  shortcuts?: Record<string, string>
  include?: (url: URL) => boolean
  init: (ctx: FeatureContext<OptionValues<Specs>>) => void | Promise<void>
}): Feature<Specs> {
  return { ...feature, options: feature.options ?? ({} as Specs) }
}

export function resolveOption(spec: OptionSpec, value: unknown): boolean | number | string {
  switch (spec.type) {
    case 'boolean':
      return typeof value === 'boolean'
        ? value
        : spec.default
    case 'select':
      return typeof value === 'string' && spec.choices.includes(value)
        ? value
        : spec.default
    case 'number':
      return typeof value === 'number' && Number.isFinite(value) && value >= spec.min && value <= spec.max
        ? value
        : spec.default
    case 'text':
      return typeof value === 'string' && value.length <= (spec.maxLength ?? 500)
        ? value
        : spec.default
  }
}

export function resolveOptions<Specs extends OptionSpecs>(specs: Specs, stored: Record<string, unknown> | undefined): OptionValues<Specs> {
  return Object.fromEntries(Object.entries(specs).map(([key, spec]) => [
    key,
    resolveOption(spec, stored?.[key]),
  ])) as OptionValues<Specs>
}

export const featureKey = (id: string, suffix: string) => `feature_${id.replaceAll('-', '_')}_${suffix}`
