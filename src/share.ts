import type { StoredFeatures } from './features/state'
import type { Rule, RuleFile, Settings } from './model'
import type { ListRuleId } from './rules/edit'
import * as v from 'valibot'
import { BAIT_PHRASES, defaultSettings, RuleFileSchema, SettingsSchema } from './model'
import { applyLevel, isListRule, readList, writeList } from './rules/edit'

const SHARE_FORMAT = 'refined-threads-settings'

const SharedFileSchema = v.strictObject({
  format: v.literal(SHARE_FORMAT),
  name: v.optional(v.pipe(v.string(), v.maxLength(80)), ''),
  description: v.optional(v.pipe(v.string(), v.maxLength(500)), ''),
  features: v.optional(v.record(v.string(), v.strictObject({
    enabled: v.optional(v.boolean()),
    options: v.optional(v.record(v.string(), v.unknown())),
  }))),
  settings: v.optional(v.partial(SettingsSchema), {}),
})
export type SharedFile = v.InferOutput<typeof SharedFileSchema>
type SharedFileInput = v.InferInput<typeof SharedFileSchema>

export interface Config { settings: Settings, features: StoredFeatures }
export type ImportMode = 'replace' | 'merge'

const isList = (rule: Rule) => isListRule(rule.id)

export const SHARE_PARTS = [
  {
    id: 'features',
    label: 'share_part_features',
    description: 'share_part_features_description',
  },
  {
    id: 'protection',
    label: 'share_part_protection',
    description: 'share_part_protection_description',
  },
  {
    id: 'lists',
    label: 'share_part_lists',
    description: 'share_part_lists_description',
  },
  {
    id: 'rules',
    label: 'share_part_rules',
    description: 'share_part_rules_description',
  },
] as const
export type SharePart = (typeof SHARE_PARTS)[number]['id']
export const ALL_PARTS: readonly SharePart[] = SHARE_PARTS.map(part => part.id)

const PROTECTION_KEYS = ['level', 'tagOnly', 'display'] as const

function partOfRule(rule: Rule): SharePart {
  return isList(rule)
    ? 'lists'
    : 'rules'
}

export function partsOf(file: SharedFile): SharePart[] {
  const rules = file.settings.ruleFile?.rules ?? []
  const present: Record<SharePart, boolean> = {
    features: file.features !== undefined,
    protection: PROTECTION_KEYS.some(key => file.settings[key] !== undefined),
    lists: rules.some(isList),
    rules: rules.some(rule => !isList(rule)),
  }
  return ALL_PARTS.filter(part => present[part])
}

export function sharedFile(config: Config, parts: readonly SharePart[], name = ''): SharedFileInput {
  const { settings } = config
  const rules = settings.ruleFile.rules.filter(rule => parts.includes(partOfRule(rule)))
  return {
    format: SHARE_FORMAT,
    name,
    description: '',
    ...(parts.includes('features') && { features: config.features }),
    settings: {
      ...(parts.includes('protection') && {
        level: settings.level,
        tagOnly: settings.tagOnly,
        display: settings.display,
      }),
      ...(rules.length > 0 && {
        ruleFile: {
          version: 1,
          ...(parts.includes('rules') && { scoring: settings.ruleFile.scoring }),
          rules,
        },
      }),
    },
  }
}

export function exportSettings(config: Config, parts: readonly SharePart[] = ALL_PARTS, name = ''): string {
  return `${JSON.stringify(sharedFile(config, parts, name), null, 2)}\n`
}

function mergeList(mine: Rule | undefined, theirs: Rule): Rule {
  if (!mine)
    return theirs
  const id = theirs.id as ListRuleId
  const file = (rule: Rule): RuleFile => ({
    version: 1,
    scoring: defaultSettings().ruleFile.scoring,
    rules: [rule],
  })
  return writeList(file(theirs), id, [
    ...readList(file(mine), id),
    ...readList(file(theirs), id),
  ]).rules[0]!
}

function applyRules(current: RuleFile, incoming: RuleFile, chosen: readonly SharePart[], mode: ImportMode): RuleFile {
  const picked = incoming.rules.filter(rule => chosen.includes(partOfRule(rule)))
  if (mode === 'replace') {
    return {
      ...current,
      scoring: chosen.includes('rules')
        ? incoming.scoring
        : current.scoring,
      rules: [
        ...picked,
        ...current.rules.filter(rule => !chosen.includes(partOfRule(rule))),
      ],
    }
  }
  const byId = new Map<string, Rule>(current.rules.map(rule => [rule.id, rule]))
  for (const rule of picked) {
    byId.set(rule.id, isList(rule)
      ? mergeList(byId.get(rule.id), rule)
      : rule)
  }
  return {
    ...current,
    rules: [
      ...byId.values(),
    ],
  }
}

export function applyShared(current: Config, file: SharedFile, parts: readonly SharePart[], mode: ImportMode): Config {
  const chosen = partsOf(file).filter(part => parts.includes(part))
  const fallback = mode === 'replace'
    ? defaultSettings()
    : current.settings
  let settings: Settings = { ...current.settings }
  if (chosen.includes('protection')) {
    for (const key of PROTECTION_KEYS) Object.assign(settings, { [key]: file.settings[key] ?? fallback[key] })
  }
  if (file.settings.ruleFile && (chosen.includes('lists') || chosen.includes('rules')))
    settings.ruleFile = applyRules(current.settings.ruleFile, file.settings.ruleFile, chosen, mode)
  if (chosen.includes('protection') && !chosen.includes('rules')) {
    settings = {
      ...settings,
      ruleFile: applyLevel(settings.ruleFile, settings.level),
    }
  }
  const features = !chosen.includes('features') || !file.features
    ? current.features
    : mode === 'replace'
      ? file.features
      : {
          ...current.features,
          ...file.features,
        }
  return {
    settings: v.parse(SettingsSchema, settings),
    features,
  }
}

export type ImportResult = { ok: true, file: SharedFile } | { ok: false, errors: string[] }

function validate(json: unknown): ImportResult {
  const result = v.safeParse(SharedFileSchema, json)
  if (result.success)
    return { ok: true, file: result.output }
  return {
    ok: false,
    errors: result.issues.map(issue => `${v.getDotPath(issue) ?? '(root)'}: ${issue.message}`),
  }
}

export function readSharedFile(text: string): ImportResult {
  try {
    return validate(JSON.parse(text))
  }
  catch {
    return {
      ok: false,
      errors: ['not-json'],
    }
  }
}

const LINK_BASE = 'https://www.threads.com/'
// Settings in storage.sync are at most about 100 KB, so a larger payload is not a settings link.
const MAX_LINK_TEXT = 1_000_000

export const OPEN_SHARED_MESSAGE = 'refined-threads:open-shared'
export const OpenSharedSchema = v.strictObject({
  type: v.literal(OPEN_SHARED_MESSAGE),
  payload: v.pipe(v.string(), v.regex(/^[\w-]+$/)),
})

export function linkPayload(hash: string): string | null {
  return /^#refined-threads=([\w-]+)$/.exec(hash)?.[1] ?? null
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text.replaceAll('-', '+').replaceAll('_', '/'))
  return Uint8Array.from(binary, char => char.charCodeAt(0))
}

export async function shareLink(file: SharedFileInput): Promise<string> {
  const stream = new Blob([
    JSON.stringify(file),
  ]).stream().pipeThrough(new CompressionStream('deflate-raw'))
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer())
  return `${LINK_BASE}#refined-threads=${toBase64Url(bytes)}`
}

async function inflate(payload: string): Promise<string> {
  const reader = new Blob([
    fromBase64Url(payload),
  ]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
    size += chunk.value.length
    if (size > MAX_LINK_TEXT) {
      await reader.cancel()
      throw new Error('too large')
    }
    chunks.push(chunk.value)
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(await new Blob(chunks as BlobPart[]).arrayBuffer())
}

export async function readSharedLink(payload: string): Promise<ImportResult> {
  let json: unknown
  try {
    json = JSON.parse(await inflate(payload))
  }
  catch {
    return {
      ok: false,
      errors: ['not-link'],
    }
  }
  return validate(json)
}

function rules(list: v.InferInput<typeof RuleFileSchema>['rules']): SharedFile['settings'] {
  return {
    ruleFile: v.parse(RuleFileSchema, { version: 1, rules: list }),
  }
}

export const PRESET_FILES: readonly (SharedFile & { id: string })[] = [
  {
    id: 'affiliate-spam',
    format: SHARE_FORMAT,
    name: 'preset_affiliate_name',
    description: 'preset_affiliate_description',
    settings: rules([
      {
        id: 'affiliate-links',
        effect: 'hide',
        when: {
          any: [
            {
              field: 'links',
              host_in: [
                'shopee.tw',
                'shp.ee',
                'amzn.to',
                'a.co',
                'a.r10.to',
                'momo.dm',
                's.click.aliexpress.com',
              ],
            },
            {
              field: 'selfReplyLinks',
              host_in: [
                'shopee.tw',
                'shp.ee',
                'amzn.to',
                'a.co',
                'a.r10.to',
                'momo.dm',
                's.click.aliexpress.com',
              ],
            },
          ],
        },
      },
    ]),
  },
  {
    id: 'engagement-bait',
    format: SHARE_FORMAT,
    name: 'preset_bait_name',
    description: 'preset_bait_description',
    settings: rules([
      {
        id: 'engagement-bait',
        effect: 'hide',
        when: { field: 'text', contains_any: BAIT_PHRASES },
      },
    ]),
  },
  {
    id: 'new-and-empty',
    format: SHARE_FORMAT,
    name: 'preset_new_accounts_name',
    description: 'preset_new_accounts_description',
    settings: rules([
      {
        id: 'new-accounts',
        effect: 'score',
        score: 1,
        when: { field: 'author.ageMonths', lt: 6 },
      },
      {
        id: 'few-followers',
        effect: 'score',
        score: 1,
        when: { field: 'author.followers', lt: 10 },
      },
      {
        id: 'few-posts',
        effect: 'score',
        score: 1,
        when: { field: 'author.posts', lt: 5 },
      },
    ]),
  },
  {
    id: 'reply-guard',
    format: SHARE_FORMAT,
    name: 'preset_reply_guard_name',
    description: 'preset_reply_guard_description',
    settings: rules([
      {
        id: 'copy-paste-replies',
        target: 'replies',
        effect: 'hide',
        when: { field: 'copies', gt: 2 },
      },
      {
        id: 'strangers-in-replies',
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
    ]),
  },
  {
    id: 'test-mode',
    format: SHARE_FORMAT,
    name: 'preset_test_mode_name',
    description: 'preset_test_mode_description',
    settings: { tagOnly: true },
  },
]
