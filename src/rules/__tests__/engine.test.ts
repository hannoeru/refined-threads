import * as v from 'valibot'
import { describe, expect, it } from 'vitest'
import { LEVEL_PRESETS, type Level, type Rule, type Settings, SettingsSchema } from '../../model'
import { makePost } from '../../testing/post'
import { compileRules, CopyTracker, evaluate, type EvaluateContext, reasonMessageKey } from '../engine'

const settings = (ruleFile: Record<string, unknown> = {}, extra: Partial<Settings> = {}): Settings =>
  ({ ...v.parse(SettingsSchema, { ruleFile: { version: 1, ...ruleFile } }), ...extra })

const noCopies = { copies: () => 0 }

const verdict = (post = makePost(), file: Record<string, unknown> = {}, ctx: EvaluateContext = noCopies) =>
  evaluate(post, compileRules(settings(file)), ctx)

const ruleVerdict = (rule: Rule['when'], post = makePost()) =>
  verdict(post, { presets: [], rules: [{ id: 'mine', weight: 3, when: rule }] })

describe('evaluate short-circuits', () => {
  const affiliate = makePost({ links: ['https://shopee.tw/item/1'] })

  it('never hides when protection is off', () => {
    const rules = compileRules(settings({}, { enabled: false }))
    expect(evaluate(affiliate, rules, noCopies).action).toBe('none')
  })

  it('never hides allowed accounts or accounts you follow', () => {
    expect(verdict(affiliate, { allowedAccounts: ['someone'] }).action).toBe('none')
    expect(verdict(makePost({ links: affiliate.links, author: { following: true } })).action).toBe('none')
  })

  it('always hides hidden accounts, matching the handle case-insensitively', () => {
    const post = makePost({ author: { username: 'SpamBot' } })
    expect(verdict(post, { hiddenAccounts: ['spambot'] })).toEqual({
      action: 'hide',
      score: 3,
      reasons: [{ kind: 'hidden-account' }],
    })
  })

  it('hides a post with a blocked word or a link to a blocked site', () => {
    expect(verdict(makePost({ text: 'Buy CHEAP followers' }), { words: ['cheap followers'] }).reasons).toEqual([
      { kind: 'word', word: 'cheap followers' },
    ])
    expect(verdict(makePost({ selfReplyLinks: ['https://go.example.com/x'] }), { hosts: ['example.com'] }).reasons).toEqual([
      { kind: 'host', host: 'example.com' },
    ])
    expect(verdict(makePost({ links: ['https://notexample.com'] }), { hosts: ['example.com'] }).action).toBe('none')
  })
})

describe('presets', () => {
  const only = (preset: string, post: ReturnType<typeof makePost>, copies = 0) =>
    verdict(post, { presets: [preset], threshold: 1 }, { copies: () => copies })

  it('affiliate-links matches affiliate hosts in the post or in the author self-replies', () => {
    expect(only('affiliate-links', makePost({ links: ['https://s.shopee.tw/abc'] })).action).toBe('hide')
    expect(only('affiliate-links', makePost({ selfReplyLinks: ['https://amzn.to/xyz'] })).action).toBe('hide')
    expect(only('affiliate-links', makePost({ links: ['https://bit.ly/xyz'] })).action).toBe('none')
  })

  it('engagement-bait matches bait phrases in English, Chinese, and Japanese', () => {
    expect(only('engagement-bait', makePost({ text: 'Want it? Comment +1 below' })).action).toBe('hide')
    expect(only('engagement-bait', makePost({ text: '想要的留言+1 我私訊你' })).action).toBe('hide')
    expect(only('engagement-bait', makePost({ text: '詳細は固定ポストから' })).action).toBe('hide')
    expect(only('engagement-bait', makePost({ text: 'I left a comment on your post' })).action).toBe('none')
  })

  it('copy-paste-replies needs a reply seen from three or more authors', () => {
    expect(only('copy-paste-replies', makePost({ isReply: true }), 3).action).toBe('hide')
    expect(only('copy-paste-replies', makePost({ isReply: true }), 2).action).toBe('none')
    expect(only('copy-paste-replies', makePost({ isReply: false }), 5).action).toBe('none')
  })

  it('ai-label matches posts with an AI label', () => {
    expect(only('ai-label', makePost({ hasAiLabel: true })).action).toBe('hide')
  })

  it('generated-names matches number-tail handles but not verified accounts', () => {
    expect(only('generated-names', makePost({ author: { username: 'lucy_wang83921' } })).action).toBe('hide')
    expect(only('generated-names', makePost({ author: { username: 'amy.lin.shop.2024' } })).action).toBe('hide')
    expect(only('generated-names', makePost({ author: { username: 'lucy83921', isVerified: true } })).action).toBe('none')
    expect(only('generated-names', makePost({ author: { username: 'lucy_wang' } })).action).toBe('none')
  })

  it('strangers-in-replies matches replies with links or mentions from strangers', () => {
    expect(only('strangers-in-replies', makePost({ isReply: true, mentions: ['x'] })).action).toBe('hide')
    expect(only('strangers-in-replies', makePost({ isReply: true, mentions: ['x'], author: { followedBy: true } })).action).toBe('none')
    expect(only('strangers-in-replies', makePost({ isReply: true })).action).toBe('none')
  })
})

describe('levels', () => {
  const fixtures = {
    normal: makePost(),
    affiliate: makePost({ links: ['https://shopee.tw/x'] }),
    bait: makePost({ text: 'link in bio for the deal' }),
    copyPaste: makePost({ isReply: true, text: 'Great post, check my profile!' }),
    aiLabel: makePost({ hasAiLabel: true }),
    strangerGeneratedLink: makePost({ isReply: true, links: ['https://example.com'], author: { username: 'amy88812' } }),
  }
  const hidden = (level: Level) =>
    Object.entries(fixtures)
      .filter(([, post]) => verdict(post, { presets: LEVEL_PRESETS[level] }, { copies: (p) => (p === fixtures.copyPaste ? 3 : 1) }).action === 'hide')
      .map(([name]) => name)

  it('light hides only affiliate spam', () => {
    expect(hidden('light')).toEqual(['affiliate'])
  })

  it('balanced also hides bait and copy-paste replies', () => {
    expect(hidden('balanced')).toEqual(['affiliate', 'bait', 'copyPaste'])
  })

  it('strict also hides AI-labeled posts, and weak signals need to add up', () => {
    expect(hidden('strict')).toEqual(['affiliate', 'bait', 'copyPaste', 'aiLabel'])
    const weakPlusWeak = verdict(fixtures.strangerGeneratedLink, { presets: LEVEL_PRESETS.strict, threshold: 2 })
    expect(weakPlusWeak.reasons).toEqual([
      { kind: 'preset', id: 'generated-names' },
      { kind: 'preset', id: 'strangers-in-replies' },
    ])
    expect(weakPlusWeak.action).toBe('hide')
  })
})

describe('custom rule operators', () => {
  it('is, in, matches, contains_any, host_in, gt, and lt', () => {
    expect(ruleVerdict({ field: 'author.isVerified', is: true }, makePost({ author: { isVerified: true } })).action).toBe('hide')
    expect(ruleVerdict({ field: 'language', in: ['ZH'] }, makePost({ language: 'zh' })).action).toBe('hide')
    expect(ruleVerdict({ field: 'author.username', matches: '^bot_\\d+$' }, makePost({ author: { username: 'bot_12' } })).action).toBe('hide')
    expect(ruleVerdict({ field: 'mentions', contains_any: ['brand'] }, makePost({ mentions: ['bigbrand'] })).action).toBe('hide')
    expect(ruleVerdict({ field: 'links', host_in: ['example.org'] }, makePost({ links: ['https://a.example.org/'] })).action).toBe('hide')
    expect(ruleVerdict({ field: 'counts.likes', gt: 10 }, makePost({ counts: { likes: 11 } })).action).toBe('hide')
    expect(ruleVerdict({ field: 'counts.likes', lt: 10 }, makePost({ counts: { likes: 11 } })).action).toBe('none')
  })

  it('all, any, and not combine conditions', () => {
    const post = makePost({ text: 'free gift', author: { followedBy: false } })
    expect(
      ruleVerdict({ all: [{ field: 'text', contains_any: ['gift'] }, { not: { field: 'author.followedBy', is: true } }] }, post).action,
    ).toBe('hide')
    expect(ruleVerdict({ any: [{ field: 'text', contains_any: ['nope'] }, { field: 'text', contains_any: ['free'] }] }, post).action).toBe('hide')
    expect(ruleVerdict({ not: { field: 'text', contains_any: ['free'] } }, post).action).toBe('none')
  })

  it('ignores a rule whose pattern does not compile', () => {
    expect(ruleVerdict({ field: 'text', matches: '(' }).action).toBe('none')
  })

  it('adds custom rule weight to preset weight and reports both reasons', () => {
    const post = makePost({ isReply: true, mentions: ['x'] })
    const result = verdict(post, {
      presets: ['strangers-in-replies'],
      rules: [{ id: 'mine', weight: 2, when: { field: 'isReply', is: true } }],
    })
    expect(result).toEqual({
      action: 'hide',
      score: 3,
      reasons: [
        { kind: 'preset', id: 'strangers-in-replies' },
        { kind: 'rule', id: 'mine' },
      ],
    })
  })
})

describe('countries and actions', () => {
  const fromJapan = makePost({ author: { country: 'JP' } })

  it('blocks a post from a blocked country', () => {
    expect(verdict(fromJapan, { countries: ['jp'] })).toEqual({ action: 'hide', score: 3, reasons: [{ kind: 'country', country: 'JP' }] })
  })

  it('only tags a post from a blocked country when the country action is tag', () => {
    expect(verdict(fromJapan, { countries: ['JP'], countryAction: 'tag' })).toEqual({
      action: 'tag',
      score: 0,
      reasons: [{ kind: 'country', country: 'JP' }],
    })
  })

  it('still hides a tagged-country post that other signals hide, and lists both reasons', () => {
    const post = makePost({ links: ['https://shopee.tw/x'], author: { country: 'JP' } })
    expect(verdict(post, { countries: ['JP'], countryAction: 'tag' })).toEqual({
      action: 'hide',
      score: 3,
      reasons: [
        { kind: 'country', country: 'JP' },
        { kind: 'preset', id: 'affiliate-links' },
      ],
    })
  })

  it('does nothing while the country is unknown, or for other countries', () => {
    expect(verdict(makePost(), { countries: ['JP'] }).action).toBe('none')
    expect(verdict(makePost({ author: { country: 'TW' } }), { countries: ['JP'] }).action).toBe('none')
  })

  it('tags instead of hiding everything when the global action is tag', () => {
    const rules = compileRules({ ...settings({ countries: ['JP'] }), action: 'tag' })
    expect(evaluate(fromJapan, rules, noCopies).action).toBe('tag')
    expect(evaluate(makePost({ links: ['https://shopee.tw/x'] }), rules, noCopies).action).toBe('tag')
  })

  it('lets custom rules read the author country', () => {
    expect(ruleVerdict({ field: 'author.country', in: ['jp'] }, fromJapan).action).toBe('hide')
  })
})

describe('CopyTracker', () => {
  it('counts distinct authors that posted the same text, ignoring case, spacing, emoji, and punctuation', () => {
    const tracker = new CopyTracker()
    const text = 'Wow amazing!! Check my profile 🔥'
    expect(tracker.record(makePost({ text, author: { pk: 'a' } }))).toBe(1)
    expect(tracker.record(makePost({ text, author: { pk: 'a' } }))).toBe(1)
    expect(tracker.record(makePost({ text: 'wow   AMAZING check my profile', author: { pk: 'b' } }))).toBe(2)
    expect(tracker.record(makePost({ text, author: { pk: 'c' } }))).toBe(3)
    expect(tracker.count(makePost({ text }))).toBe(3)
  })

  it('ignores short texts', () => {
    const tracker = new CopyTracker()
    tracker.record(makePost({ text: 'nice', author: { pk: 'a' } }))
    expect(tracker.record(makePost({ text: 'nice', author: { pk: 'b' } }))).toBe(0)
  })
})

describe('reasonMessageKey', () => {
  it('maps reasons to locale keys', () => {
    expect(reasonMessageKey({ kind: 'preset', id: 'copy-paste-replies' })).toBe('reason_copy_paste_replies')
    expect(reasonMessageKey({ kind: 'hidden-account' })).toBe('reason_hidden_account')
  })
})
