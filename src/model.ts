import * as v from 'valibot'

export type Surface = 'feed' | 'post' | 'profile' | 'search' | 'activity' | 'other'

export type PostAuthor = {
  pk: string
  username: string
  fullName: string
  bio: string
  isVerified: boolean
  isPrivate: boolean
  following: boolean
  followedBy: boolean
  country: string | null
}

export type Post = {
  code: string
  pk: string
  author: PostAuthor
  text: string
  links: string[]
  mentions: string[]
  language: string
  hasAiLabel: boolean
  isPaidPartnership: boolean
  isReply: boolean
  replyToUsername: string | null
  rootAuthorUsername: string | null
  counts: { likes: number; replies: number; reposts: number; quotes: number }
  takenAt: number
  selfReplyLinks: string[]
}

export const POSTS_EVENT = 'lint-roller:posts'
export const COUNTRY_REQUEST_EVENT = 'lint-roller:country-request'
export const COUNTRY_RESULT_EVENT = 'lint-roller:country-result'

export type CountryRequest = { pk: string }

export type CountryResult =
  | { pk: string; ok: true; name: string | null; visible: boolean }
  | { pk: string; ok: false; status: number | null; retryAfterMs: number | null }

export const LEVELS = ['light', 'balanced', 'strict'] as const
export type Level = (typeof LEVELS)[number]

export const ACTIONS = ['hide', 'tag'] as const
export type Action = (typeof ACTIONS)[number]

export const DISPLAYS = ['collapse', 'blur'] as const
export type Display = (typeof DISPLAYS)[number]

export const PRESET_IDS = [
  'affiliate-links',
  'engagement-bait',
  'copy-paste-replies',
  'ai-label',
  'generated-names',
  'strangers-in-replies',
] as const
export type PresetId = (typeof PRESET_IDS)[number]

export const LEVEL_PRESETS: Record<Level, readonly PresetId[]> = {
  light: ['affiliate-links'],
  balanced: ['affiliate-links', 'engagement-bait', 'copy-paste-replies'],
  strict: ['affiliate-links', 'engagement-bait', 'copy-paste-replies', 'ai-label', 'generated-names', 'strangers-in-replies'],
}

export const FIELDS = [
  'text',
  'links',
  'mentions',
  'language',
  'hasAiLabel',
  'isPaidPartnership',
  'isReply',
  'selfReplyLinks',
  'author.username',
  'author.fullName',
  'author.bio',
  'author.isVerified',
  'author.isPrivate',
  'author.following',
  'author.followedBy',
  'author.country',
  'counts.likes',
  'counts.replies',
  'counts.reposts',
  'counts.quotes',
] as const
export type Field = (typeof FIELDS)[number]

const MAX_PATTERN = 200

const Leaf = v.union([
  v.strictObject({ field: v.picklist(FIELDS), is: v.union([v.string(), v.number(), v.boolean()]) }),
  v.strictObject({ field: v.picklist(FIELDS), in: v.array(v.string()) }),
  v.strictObject({ field: v.picklist(FIELDS), matches: v.pipe(v.string(), v.maxLength(MAX_PATTERN)) }),
  v.strictObject({ field: v.picklist(FIELDS), contains_any: v.array(v.string()) }),
  v.strictObject({ field: v.picklist(FIELDS), host_in: v.array(v.string()) }),
  v.strictObject({ field: v.picklist(FIELDS), gt: v.number() }),
  v.strictObject({ field: v.picklist(FIELDS), lt: v.number() }),
])

export type Condition =
  | v.InferOutput<typeof Leaf>
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }

export const ConditionSchema: v.GenericSchema<Condition> = v.union([
  Leaf,
  v.strictObject({ all: v.array(v.lazy(() => ConditionSchema)) }),
  v.strictObject({ any: v.array(v.lazy(() => ConditionSchema)) }),
  v.strictObject({ not: v.lazy(() => ConditionSchema) }),
])

export const RuleSchema = v.strictObject({
  id: v.pipe(v.string(), v.minLength(1), v.maxLength(64)),
  weight: v.pipe(v.number(), v.minValue(0), v.maxValue(100)),
  when: ConditionSchema,
})
export type Rule = v.InferOutput<typeof RuleSchema>

const CountryCode = v.pipe(v.string(), v.trim(), v.toUpperCase(), v.regex(/^[A-Z]{2}$/))

const Handle = v.pipe(v.string(), v.trim(), v.toLowerCase(), v.regex(/^[a-z0-9._]{1,30}$/))

export const RuleFileSchema = v.strictObject({
  version: v.literal(1),
  threshold: v.optional(v.pipe(v.number(), v.minValue(1)), 3),
  presets: v.optional(v.array(v.picklist(PRESET_IDS)), () => [...LEVEL_PRESETS.balanced]),
  words: v.optional(v.array(v.pipe(v.string(), v.trim(), v.minLength(1))), []),
  hosts: v.optional(v.array(v.pipe(v.string(), v.trim(), v.toLowerCase(), v.minLength(1))), []),
  hiddenAccounts: v.optional(v.array(Handle), []),
  allowedAccounts: v.optional(v.array(Handle), []),
  rules: v.optional(v.array(RuleSchema), []),
  countries: v.optional(v.array(CountryCode), []),
  countryAction: v.optional(v.picklist(ACTIONS), 'hide'),
})
export type RuleFile = v.InferOutput<typeof RuleFileSchema>

export const SettingsSchema = v.strictObject({
  enabled: v.optional(v.boolean(), true),
  level: v.optional(v.picklist(LEVELS), 'balanced'),
  action: v.optional(v.picklist(ACTIONS), 'hide'),
  display: v.optional(v.picklist(DISPLAYS), 'collapse'),
  ruleFile: v.optional(RuleFileSchema, () => v.parse(RuleFileSchema, { version: 1 })),
})
export type Settings = v.InferOutput<typeof SettingsSchema>

export const defaultSettings = (): Settings => v.parse(SettingsSchema, {})

export type Reason =
  | { kind: 'preset'; id: PresetId }
  | { kind: 'rule'; id: string }
  | { kind: 'word'; word: string }
  | { kind: 'host'; host: string }
  | { kind: 'hidden-account' }
  | { kind: 'country'; country: string }

export type Verdict = { action: 'none' | Action; score: number; reasons: Reason[] }

export type Stats = { day: string; hidden: number; byReason: Record<string, number> }
