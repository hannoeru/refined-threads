import { describe, expect, it } from 'vitest'
import { defaultSettings, type Level, type Rule, type Settings } from '../../model'
import { makePost } from '../../testing/post'
import { addAccount, applyLevel, writeList } from '../edit'
import { compileRules, CopyTracker, evaluate, type EvaluateContext } from '../engine'

type Post = ReturnType<typeof makePost>

const noCopies: EvaluateContext = { copies: () => 0 }

const run = (post: Post, settings: Settings = defaultSettings(), ctx = noCopies) => evaluate(post, compileRules(settings), ctx)

const withRules = (rules: Partial<Rule>[], patch: Partial<Settings> = {}): Settings => {
  const settings = defaultSettings()
  settings.ruleFile.rules = rules.map((rule, index) => ({
    id: `r${index}`,
    name: '',
    enabled: true,
    target: 'all',
    effect: 'score',
    score: 1,
    when: { field: 'isReply', is: true },
    ...rule,
  }))
  return { ...settings, ...patch }
}

const ids = (post: Post, settings: Settings, ctx = noCopies) => run(post, settings, ctx).reasons.map((reason) => reason.id)

describe('default settings', () => {
  it('keep normal posts and posts from people you follow', () => {
    expect(run(makePost()).action).toBe('none')
    expect(run(makePost({ links: ['https://shopee.tw/x'], author: { following: true } })).action).toBe('none')
  })

  it('hide affiliate spam, engagement bait, and copy-paste replies', () => {
    expect(ids(makePost({ selfReplyLinks: ['https://s.shopee.tw/abc'] }), defaultSettings())).toEqual(['affiliate-links'])
    expect(run(makePost({ text: '想要的留言+1 我私訊你' })).action).toBe('hide')
    expect(run(makePost({ text: '詳細は固定ポストから' })).action).toBe('hide')
    expect(run(makePost({ isReply: true, text: 'Nice! Check my profile' }), defaultSettings(), { copies: () => 3 }).action).toBe('hide')
    expect(run(makePost({ isReply: false, text: 'Nice! Check my profile' }), defaultSettings(), { copies: () => 3 }).action).toBe('none')
  })
})

describe('list rules', () => {
  const settingsWith = (id: Parameters<typeof writeList>[1], values: string[]) => {
    const settings = defaultSettings()
    settings.ruleFile = writeList(settings.ruleFile, id, values)
    return settings
  }

  it('hide posts from hidden accounts, with blocked words, or with links to blocked sites', () => {
    expect(run(makePost({ author: { username: 'spambot' } }), settingsWith('hidden-accounts', ['spambot'])).action).toBe('hide')
    expect(run(makePost({ text: 'Buy CHEAP followers' }), settingsWith('blocked-words', ['cheap followers'])).action).toBe('hide')
    expect(run(makePost({ selfReplyLinks: ['https://go.example.com/x'] }), settingsWith('blocked-sites', ['example.com'])).action).toBe('hide')
    expect(run(makePost({ links: ['https://notexample.com'] }), settingsWith('blocked-sites', ['example.com'])).action).toBe('none')
  })

  it('never act on allowed accounts, even when other rules match', () => {
    const settings = defaultSettings()
    settings.ruleFile = addAccount(settings.ruleFile, 'hidden-accounts', 'amy')
    settings.ruleFile = addAccount(settings.ruleFile, 'allowed-accounts', 'amy')
    expect(run(makePost({ author: { username: 'amy' }, links: ['https://shopee.tw/x'] }), settings).action).toBe('none')
  })

  it('hide posts from blocked countries once the country is known', () => {
    const settings = settingsWith('countries', ['JP'])
    expect(run(makePost({ author: { country: 'JP' } }), settings).action).toBe('hide')
    expect(run(makePost({ author: { country: null } }), settings).action).toBe('none')
    expect(run(makePost({ author: { country: 'TW' } }), settings).action).toBe('none')
  })
})

describe('effects, targets, and scoring', () => {
  it('a tag rule tags without hiding, and lists the rule as the reason', () => {
    const settings = withRules([{ id: 'young', name: 'Young account', effect: 'tag', when: { field: 'author.ageMonths', lt: 6 } }])
    expect(run(makePost({ author: { ageMonths: 2 } }), settings)).toEqual({
      action: 'tag',
      score: 0,
      reasons: [{ id: 'young', name: 'Young account', effect: 'tag' }],
    })
    expect(run(makePost({ author: { ageMonths: null } }), settings).action).toBe('none')
  })

  it('scores add up, and posts and replies use their own thresholds', () => {
    const settings = withRules([
      { id: 'few-followers', score: 1, when: { field: 'author.followers', lt: 10 } },
      { id: 'few-posts', score: 1, when: { field: 'author.posts', lt: 5 } },
    ])
    settings.ruleFile.scoring = { posts: { tagAt: 2, hideAt: null }, replies: { tagAt: 1, hideAt: 2 } }
    const weak = { author: { followers: 3, posts: 1 } }
    expect(run(makePost(weak), settings)).toMatchObject({ action: 'tag', score: 2 })
    expect(run(makePost({ ...weak, isReply: true }), settings)).toMatchObject({ action: 'hide', score: 2 })
    expect(run(makePost({ author: { followers: 3, posts: 50 }, isReply: true }), settings)).toMatchObject({ action: 'tag', score: 1 })
  })

  it('a negative score lowers the total', () => {
    const settings = withRules([
      { id: 'bad', score: 3, when: { field: 'text', contains_any: ['deal'] } },
      { id: 'trusted', score: -2, when: { field: 'author.isVerified', is: true } },
    ])
    expect(run(makePost({ text: 'deal', author: { isVerified: true } }), settings)).toMatchObject({ action: 'none', score: 1 })
  })

  it('a rule for replies ignores posts, and a rule for posts ignores replies', () => {
    const settings = withRules([
      { id: 'replies-only', target: 'replies', effect: 'hide', when: { field: 'text', contains_any: ['x'] } },
      { id: 'posts-only', target: 'posts', effect: 'tag', when: { field: 'text', contains_any: ['x'] } },
    ])
    expect(ids(makePost({ text: 'x', isReply: true }), settings)).toEqual(['replies-only'])
    expect(ids(makePost({ text: 'x', isReply: false }), settings)).toEqual(['posts-only'])
  })

  it('tag-only mode turns every hide into a tag', () => {
    const settings = withRules([{ effect: 'hide', when: { field: 'text', contains_any: ['x'] } }], { tagOnly: true })
    expect(run(makePost({ text: 'x' }), settings).action).toBe('tag')
  })

  it('disabled rules and rules with an invalid pattern do nothing', () => {
    expect(run(makePost({ text: 'x' }), withRules([{ enabled: false, effect: 'hide', when: { field: 'text', contains_any: ['x'] } }])).action).toBe('none')
    expect(run(makePost(), withRules([{ effect: 'hide', when: { field: 'text', matches: '(' } }])).action).toBe('none')
  })
})

describe('operators', () => {
  const hit = (when: Rule['when'], post: Post) => run(post, withRules([{ effect: 'hide', when }])).action === 'hide'

  it('is, in, matches, contains_any, host_in, gt, and lt', () => {
    expect(hit({ field: 'author.isVerified', is: true }, makePost({ author: { isVerified: true } }))).toBe(true)
    expect(hit({ field: 'language', in: ['ZH'] }, makePost({ language: 'zh' }))).toBe(true)
    expect(hit({ field: 'author.username', matches: '^bot_\\d+$' }, makePost({ author: { username: 'bot_12' } }))).toBe(true)
    expect(hit({ field: 'mentions', contains_any: ['brand'] }, makePost({ mentions: ['bigbrand'] }))).toBe(true)
    expect(hit({ field: 'links', host_in: ['example.org'] }, makePost({ links: ['https://a.example.org/'] }))).toBe(true)
    expect(hit({ field: 'counts.likes', gt: 10 }, makePost({ counts: { likes: 11 } }))).toBe(true)
    expect(hit({ field: 'counts.likes', lt: 10 }, makePost({ counts: { likes: 11 } }))).toBe(false)
    expect(hit({ field: 'links', gt: 1 }, makePost({ links: ['https://a.com', 'https://b.com'] }))).toBe(true)
  })

  it('all, any, and not combine conditions', () => {
    const post = makePost({ text: 'free gift' })
    expect(hit({ all: [{ field: 'text', contains_any: ['gift'] }, { not: { field: 'author.followedBy', is: true } }] }, post)).toBe(true)
    expect(hit({ any: [{ field: 'text', contains_any: ['nope'] }, { field: 'text', contains_any: ['free'] }] }, post)).toBe(true)
    expect(hit({ not: { field: 'text', contains_any: ['free'] } }, post)).toBe(false)
  })
})

describe('levels', () => {
  const fixtures = {
    normal: makePost(),
    affiliate: makePost({ links: ['https://shopee.tw/x'] }),
    bait: makePost({ text: 'link in bio for the deal' }),
    copyPaste: makePost({ isReply: true, text: 'Great post, check my profile!' }),
    aiLabel: makePost({ hasAiLabel: true }),
    strangerReply: makePost({ isReply: true, links: ['https://example.com'], author: { username: 'amy88812' } }),
  }
  const hidden = (level: Level) => {
    const settings = { ...defaultSettings(), level, ruleFile: applyLevel(defaultSettings().ruleFile, level) }
    const ctx: EvaluateContext = { copies: (post) => (post === fixtures.copyPaste ? 3 : 1) }
    return Object.entries(fixtures)
      .filter(([, post]) => run(post, settings, ctx).action === 'hide')
      .map(([name]) => name)
  }

  it('light hides only affiliate spam', () => {
    expect(hidden('light')).toEqual(['affiliate'])
  })

  it('balanced also hides bait and copy-paste replies', () => {
    expect(hidden('balanced')).toEqual(['affiliate', 'bait', 'copyPaste'])
  })

  it('strict also hides AI-labeled posts and replies where weak signals add up', () => {
    expect(hidden('strict')).toEqual(['affiliate', 'bait', 'copyPaste', 'aiLabel'])
    const settings = { ...defaultSettings(), ruleFile: applyLevel(defaultSettings().ruleFile, 'strict') }
    expect(ids(fixtures.strangerReply, settings)).toEqual(['generated-names', 'strangers-in-replies'])
    expect(run(fixtures.strangerReply, settings).action).toBe('tag')
  })
})

describe('lookup needs', () => {
  it('asks for no account lookups with default settings', () => {
    expect(compileRules(defaultSettings()).needs).toEqual({ about: false, profile: false, copies: true })
  })

  it('asks for account lookups only when an enabled rule can match', () => {
    const settings = defaultSettings()
    settings.ruleFile = writeList(settings.ruleFile, 'countries', ['JP'])
    expect(compileRules(settings).needs.about).toBe(true)
    settings.ruleFile.rules.find((rule) => rule.id === 'few-posts')!.enabled = true
    expect(compileRules(settings).needs.profile).toBe(true)
  })

  it('skips rules with an empty list, but keeps not-rules around them', () => {
    const settings = withRules([
      { id: 'empty', effect: 'hide', when: { field: 'text', contains_any: [] } },
      { id: 'not-empty', effect: 'tag', when: { not: { field: 'text', contains_any: [] } } },
    ])
    expect(compileRules(settings).rules.map((rule) => rule.id)).toEqual(['not-empty'])
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
