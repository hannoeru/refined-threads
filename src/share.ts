import * as v from 'valibot'
import { BAIT_PHRASES, type Rule, RuleFileSchema, type Settings, SettingsSchema } from './model'

export const SHARE_FORMAT = 'refined-threads-settings'

export const SharedFileSchema = v.strictObject({
  format: v.literal(SHARE_FORMAT),
  name: v.optional(v.pipe(v.string(), v.maxLength(80)), ''),
  description: v.optional(v.pipe(v.string(), v.maxLength(500)), ''),
  settings: v.optional(v.partial(v.omit(SettingsSchema, ['enabled'])), {}),
})
export type SharedFile = v.InferOutput<typeof SharedFileSchema>

export function exportSettings(settings: Settings, name = '', description = ''): string {
  const { enabled: _enabled, ...shared } = settings
  const file: SharedFile = { format: SHARE_FORMAT, name, description, settings: shared }
  return `${JSON.stringify(file, null, 2)}\n`
}

export type ImportResult = { ok: true; file: SharedFile } | { ok: false; errors: string[] }

export function readSharedFile(text: string): ImportResult {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return { ok: false, errors: ['not-json'] }
  }
  const result = v.safeParse(SharedFileSchema, json)
  if (result.success) return { ok: true, file: result.output }
  return {
    ok: false,
    errors: result.issues.map((issue) => `${v.getDotPath(issue) ?? '(root)'}: ${issue.message}`),
  }
}

export function replaceWith(current: Settings, file: SharedFile): Settings {
  return v.parse(SettingsSchema, { ...file.settings, enabled: current.enabled })
}

export function mergeInto(current: Settings, file: SharedFile): Settings {
  const incoming = file.settings.ruleFile?.rules ?? []
  const byId = new Map<string, Rule>(current.ruleFile.rules.map((rule) => [rule.id, rule]))
  for (const rule of incoming) byId.set(rule.id, rule)
  return v.parse(SettingsSchema, {
    ...current,
    tagOnly: file.settings.tagOnly ?? current.tagOnly,
    ruleFile: { ...current.ruleFile, rules: [...byId.values()] },
  })
}

const rules = (list: v.InferInput<typeof RuleFileSchema>['rules']): SharedFile['settings'] => ({
  ruleFile: v.parse(RuleFileSchema, { version: 1, rules: list }),
})

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
            { field: 'links', host_in: ['shopee.tw', 'shp.ee', 'amzn.to', 'a.co', 'a.r10.to', 'momo.dm', 's.click.aliexpress.com'] },
            { field: 'selfReplyLinks', host_in: ['shopee.tw', 'shp.ee', 'amzn.to', 'a.co', 'a.r10.to', 'momo.dm', 's.click.aliexpress.com'] },
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
    settings: rules([{ id: 'engagement-bait', effect: 'hide', when: { field: 'text', contains_any: BAIT_PHRASES } }]),
  },
  {
    id: 'new-and-empty',
    format: SHARE_FORMAT,
    name: 'preset_new_accounts_name',
    description: 'preset_new_accounts_description',
    settings: rules([
      { id: 'new-accounts', effect: 'score', score: 1, when: { field: 'author.ageMonths', lt: 6 } },
      { id: 'few-followers', effect: 'score', score: 1, when: { field: 'author.followers', lt: 10 } },
      { id: 'few-posts', effect: 'score', score: 1, when: { field: 'author.posts', lt: 5 } },
    ]),
  },
  {
    id: 'reply-guard',
    format: SHARE_FORMAT,
    name: 'preset_reply_guard_name',
    description: 'preset_reply_guard_description',
    settings: rules([
      { id: 'copy-paste-replies', target: 'replies', effect: 'hide', when: { field: 'copies', gt: 2 } },
      {
        id: 'strangers-in-replies',
        target: 'replies',
        effect: 'score',
        score: 1,
        when: { all: [{ field: 'author.followedBy', is: false }, { any: [{ field: 'links', gt: 0 }, { field: 'mentions', gt: 0 }] }] },
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
