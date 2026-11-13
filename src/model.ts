import * as v from 'valibot'

export interface PostAuthor {
  pk: string
  username: string
  fullName: string
  bio: string
  isVerified: boolean
  isPrivate: boolean
  following: boolean
  followedBy: boolean
  country: string | null
  ageMonths: number | null
  followers: number | null
  posts: number | null
}

export interface Post {
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
  counts: { likes: number, replies: number, reposts: number, quotes: number }
  takenAt: number
  selfReplyLinks: string[]
}

export const LEVELS = ['light', 'balanced', 'strict'] as const
export type Level = (typeof LEVELS)[number]

export const DISPLAYS = ['collapse', 'blur'] as const
export type Display = (typeof DISPLAYS)[number]

export const EFFECTS = ['hide', 'tag', 'score', 'allow'] as const
export type Effect = (typeof EFFECTS)[number]

export const TARGETS = ['all', 'posts', 'replies'] as const
export type Target = (typeof TARGETS)[number]

export const FIELDS = [
  'text',
  'links',
  'mentions',
  'language',
  'hasAiLabel',
  'isPaidPartnership',
  'isReply',
  'selfReplyLinks',
  'copies',
  'author.username',
  'author.fullName',
  'author.bio',
  'author.isVerified',
  'author.isPrivate',
  'author.following',
  'author.followedBy',
  'author.country',
  'author.ageMonths',
  'author.followers',
  'author.posts',
  'counts.likes',
  'counts.replies',
  'counts.reposts',
  'counts.quotes',
] as const
export type Field = (typeof FIELDS)[number]

export const ABOUT_FIELDS: readonly Field[] = ['author.country', 'author.ageMonths']

const MAX_PATTERN = 200

const FieldSchema = v.picklist(FIELDS)

const Leaf = v.union([
  v.strictObject({
    field: FieldSchema,
    is: v.union([
      v.string(),
      v.number(),
      v.boolean(),
    ]),
  }),
  v.strictObject({
    field: FieldSchema,
    in: v.array(v.string()),
  }),
  v.strictObject({
    field: FieldSchema,
    matches: v.pipe(v.string(), v.maxLength(MAX_PATTERN)),
  }),
  v.strictObject({
    field: FieldSchema,
    contains_any: v.array(v.string()),
  }),
  v.strictObject({
    field: FieldSchema,
    host_in: v.array(v.string()),
  }),
  v.strictObject({
    field: FieldSchema,
    gt: v.number(),
  }),
  v.strictObject({
    field: FieldSchema,
    lt: v.number(),
  }),
])
export type LeafCondition = v.InferOutput<typeof Leaf>

export type Condition = LeafCondition | { all: Condition[] } | { any: Condition[] } | { not: Condition }

const ConditionSchema: v.GenericSchema<Condition> = v.union([
  Leaf,
  v.strictObject({
    all: v.array(v.lazy(() => ConditionSchema)),
  }),
  v.strictObject({
    any: v.array(v.lazy(() => ConditionSchema)),
  }),
  v.strictObject({
    not: v.lazy(() => ConditionSchema),
  }),
])

export const RuleSchema = v.strictObject({
  id: v.pipe(v.string(), v.regex(/^[a-z0-9-]{1,64}$/)),
  name: v.optional(v.pipe(v.string(), v.maxLength(80)), ''),
  enabled: v.optional(v.boolean(), true),
  target: v.optional(v.picklist(TARGETS), 'all'),
  effect: v.optional(v.picklist(EFFECTS), 'score'),
  score: v.optional(v.pipe(v.number(), v.minValue(-100), v.maxValue(100)), 1),
  when: ConditionSchema,
})
export type Rule = v.InferOutput<typeof RuleSchema>

const Threshold = v.nullable(v.pipe(v.number(), v.minValue(1), v.maxValue(100)))

const OutcomeSchema = v.strictObject({ tagAt: Threshold, hideAt: Threshold })
export type Outcome = v.InferOutput<typeof OutcomeSchema>

const AFFILIATE_HOSTS = [
  'shopee.tw',
  'shopee.com',
  'shopee.sg',
  'shopee.com.my',
  'shopee.ph',
  'shopee.co.id',
  'shopee.vn',
  'shopee.co.th',
  'shopee.com.br',
  'shp.ee',
  'amzn.to',
  'amzn.asia',
  'a.co',
  'a.r10.to',
  'hb.afl.rakuten.co.jp',
  'af.moshimo.com',
  'momo.dm',
  's.click.aliexpress.com',
  's.click.taobao.com',
]

export const BAIT_PHRASES = [
  'comment +1',
  'comment "yes"',
  'drop a 🔥',
  'link in bio',
  'link in my bio',
  'dm me for',
  'dm me the word',
  '留言+1',
  '留言 +1',
  '私訊我',
  '私我拿',
  '想要的留言',
  '連結在留言',
  '連結放留言',
  '連結在首頁',
  'コメントで',
  'プロフのリンク',
  '固定ポストから',
]

const BUILT_IN_RULES = [
  {
    id: 'followed',
    effect: 'allow',
    when: { field: 'author.following', is: true },
  },
  {
    id: 'allowed-accounts',
    effect: 'allow',
    when: { field: 'author.username', in: [] },
  },
  {
    id: 'hidden-accounts',
    effect: 'hide',
    when: { field: 'author.username', in: [] },
  },
  {
    id: 'blocked-words',
    effect: 'hide',
    when: { field: 'text', contains_any: [] },
  },
  {
    id: 'blocked-sites',
    effect: 'hide',
    when: {
      any: [
        { field: 'links', host_in: [] },
        { field: 'selfReplyLinks', host_in: [] },
      ],
    },
  },
  {
    id: 'countries',
    effect: 'hide',
    when: { field: 'author.country', in: [] },
  },
  {
    id: 'new-accounts',
    enabled: false,
    effect: 'tag',
    when: { field: 'author.ageMonths', lt: 6 },
  },
  {
    id: 'few-followers',
    enabled: false,
    effect: 'score',
    score: 1,
    when: { field: 'author.followers', lt: 10 },
  },
  {
    id: 'few-posts',
    enabled: false,
    effect: 'score',
    score: 1,
    when: { field: 'author.posts', lt: 5 },
  },
  {
    id: 'affiliate-links',
    effect: 'score',
    score: 3,
    when: {
      any: [
        { field: 'links', host_in: AFFILIATE_HOSTS },
        { field: 'selfReplyLinks', host_in: AFFILIATE_HOSTS },
      ],
    },
  },
  {
    id: 'engagement-bait',
    effect: 'score',
    score: 3,
    when: { field: 'text', contains_any: BAIT_PHRASES },
  },
  {
    id: 'copy-paste-replies',
    target: 'replies',
    effect: 'score',
    score: 3,
    when: { field: 'copies', gt: 2 },
  },
  {
    id: 'ai-label',
    enabled: false,
    effect: 'score',
    score: 3,
    when: { field: 'hasAiLabel', is: true },
  },
  {
    id: 'generated-names',
    enabled: false,
    effect: 'score',
    score: 1,
    when: {
      all: [
        {
          any: [
            { field: 'author.username', matches: '^[a-z._]+\\d{4,}$' },
            { field: 'author.username', matches: '^[a-z0-9]+(?:[._][a-z0-9]+){2,}\\d+$' },
          ],
        },
        {
          not: { field: 'author.isVerified', is: true },
        },
      ],
    },
  },
  {
    id: 'strangers-in-replies',
    enabled: false,
    target: 'replies',
    effect: 'score',
    score: 1,
    when: {
      all: [
        { field: 'author.followedBy', is: false },
        {
          any: [
            { field: 'links', gt: 0 },
            { field: 'mentions', gt: 0 },
          ],
        },
      ],
    },
  },
] as const satisfies readonly v.InferInput<typeof RuleSchema>[]

export type BuiltInRuleId = (typeof BUILT_IN_RULES)[number]['id']

export const BUILT_IN_RULE_INPUTS: readonly v.InferInput<typeof RuleSchema>[] = BUILT_IN_RULES

export const BUILT_IN_IDS: readonly string[] = BUILT_IN_RULES.map(rule => rule.id)

export const LEVEL_RULES: Record<Level, readonly BuiltInRuleId[]> = {
  light: ['affiliate-links'],
  balanced: ['affiliate-links', 'engagement-bait', 'copy-paste-replies'],
  strict: [
    'affiliate-links',
    'engagement-bait',
    'copy-paste-replies',
    'ai-label',
    'generated-names',
    'strangers-in-replies',
  ],
}

export const LEVEL_TOGGLED: readonly BuiltInRuleId[] = [
  ...new Set(Object.values(LEVEL_RULES).flat()),
]

export const RuleFileSchema = v.strictObject({
  version: v.literal(1),
  scoring: v.optional(v.strictObject({ posts: OutcomeSchema, replies: OutcomeSchema }), () => ({
    posts: { tagAt: 2, hideAt: 3 },
    replies: { tagAt: 2, hideAt: 3 },
  })),
  rules: v.optional(v.array(RuleSchema), () => BUILT_IN_RULE_INPUTS.map(rule => structuredClone(rule))),
})
export type RuleFile = v.InferOutput<typeof RuleFileSchema>

export const SettingsSchema = v.strictObject({
  level: v.optional(v.picklist(LEVELS), 'balanced'),
  tagOnly: v.optional(v.boolean(), false),
  display: v.optional(v.picklist(DISPLAYS), 'collapse'),
  ruleFile: v.optional(RuleFileSchema, () => v.parse(RuleFileSchema, { version: 1 })),
})
export type Settings = v.InferOutput<typeof SettingsSchema>

export const defaultSettings = (): Settings => v.parse(SettingsSchema, {})

export interface Reason { id: string, name: string, effect: Effect }

export interface Verdict { action: 'none' | 'tag' | 'hide', score: number, reasons: Reason[] }

export interface Stats { day: string, hidden: number, tagged: number, byRule: Record<string, number> }
