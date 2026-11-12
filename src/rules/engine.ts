import type { Action, Condition, Field, Post, PresetId, Reason, Rule, Settings, Verdict } from '../model'
import { hostMatches, linkHost } from './hosts'
import { PRESETS, type Preset } from './presets'

type CompiledCondition = (post: Post) => boolean

type CompiledRule = { id: string; weight: number; test: CompiledCondition }

export type CompiledRules = {
  enabled: boolean
  action: Action
  countries: Set<string>
  countryAction: Action
  threshold: number
  presets: Preset[]
  rules: CompiledRule[]
  words: string[]
  hosts: string[]
  hidden: Set<string>
  allowed: Set<string>
}

export type EvaluateContext = { copies: (post: Post) => number }

type FieldValue = string | number | boolean | string[]

function fieldValue(post: Post, field: Field): FieldValue {
  switch (field) {
    case 'author.username':
      return post.author.username
    case 'author.fullName':
      return post.author.fullName
    case 'author.bio':
      return post.author.bio
    case 'author.isVerified':
      return post.author.isVerified
    case 'author.isPrivate':
      return post.author.isPrivate
    case 'author.following':
      return post.author.following
    case 'author.followedBy':
      return post.author.followedBy
    case 'author.country':
      return post.author.country ?? ''
    case 'counts.likes':
      return post.counts.likes
    case 'counts.replies':
      return post.counts.replies
    case 'counts.reposts':
      return post.counts.reposts
    case 'counts.quotes':
      return post.counts.quotes
    default:
      return post[field]
  }
}

const strings = (value: FieldValue): string[] =>
  Array.isArray(value) ? value : typeof value === 'string' ? [value] : []

function compileCondition(condition: Condition): CompiledCondition | null {
  if ('all' in condition) {
    const parts = condition.all.map(compileCondition)
    if (parts.some((part) => part === null)) return null
    return (post) => parts.every((part) => part!(post))
  }
  if ('any' in condition) {
    const parts = condition.any.map(compileCondition)
    if (parts.some((part) => part === null)) return null
    return (post) => parts.some((part) => part!(post))
  }
  if ('not' in condition) {
    const inner = compileCondition(condition.not)
    return inner && ((post) => !inner(post))
  }
  const read = (post: Post) => fieldValue(post, condition.field)
  if ('is' in condition) return (post) => read(post) === condition.is
  if ('in' in condition) {
    const list = new Set(condition.in.map((item) => item.toLowerCase()))
    return (post) => strings(read(post)).some((item) => list.has(item.toLowerCase()))
  }
  if ('matches' in condition) {
    let pattern: RegExp
    try {
      pattern = new RegExp(condition.matches, 'iu')
    } catch {
      return null
    }
    return (post) => strings(read(post)).some((item) => pattern.test(item))
  }
  if ('contains_any' in condition) {
    const needles = condition.contains_any.map((needle) => needle.toLowerCase())
    return (post) =>
      strings(read(post)).some((item) => {
        const haystack = item.toLowerCase()
        return needles.some((needle) => haystack.includes(needle))
      })
  }
  if ('host_in' in condition) {
    const targets = condition.host_in.map((host) => host.toLowerCase())
    return (post) =>
      strings(read(post)).some((link) => {
        const host = linkHost(link)
        return host !== null && targets.some((target) => hostMatches(host, target))
      })
  }
  if ('gt' in condition) return (post) => Number(read(post)) > condition.gt
  return (post) => Number(read(post)) < condition.lt
}

function compileRule(rule: Rule): CompiledRule | null {
  const test = compileCondition(rule.when)
  return test && { id: rule.id, weight: rule.weight, test }
}

export function compileRules(settings: Settings): CompiledRules {
  const file = settings.ruleFile
  return {
    enabled: settings.enabled,
    action: settings.action,
    countries: new Set(file.countries),
    countryAction: file.countryAction,
    threshold: file.threshold,
    presets: [...new Set(file.presets)].map((id: PresetId) => PRESETS[id]),
    rules: file.rules.map(compileRule).filter((rule): rule is CompiledRule => rule !== null),
    words: file.words.map((word) => word.toLowerCase()),
    hosts: file.hosts.map((host) => host.toLowerCase()),
    hidden: new Set(file.hiddenAccounts),
    allowed: new Set(file.allowedAccounts),
  }
}

const KEEP: Verdict = { action: 'none', score: 0, reasons: [] }

export function evaluate(post: Post, rules: CompiledRules, ctx: EvaluateContext): Verdict {
  if (!rules.enabled) return KEEP
  const username = post.author.username.toLowerCase()
  if (rules.allowed.has(username) || post.author.following) return KEEP
  const decisive = (reason: Reason): Verdict => ({ action: rules.action, score: rules.threshold, reasons: [reason] })
  if (rules.hidden.has(username)) return decisive({ kind: 'hidden-account' })

  const text = post.text.toLowerCase()
  const word = rules.words.find((candidate) => text.includes(candidate))
  if (word !== undefined) return decisive({ kind: 'word', word })

  const hosts = [...post.links, ...post.selfReplyLinks].map(linkHost).filter((host): host is string => host !== null)
  const host = rules.hosts.find((target) => hosts.some((candidate) => hostMatches(candidate, target)))
  if (host !== undefined) return decisive({ kind: 'host', host })

  const country = post.author.country
  const countryMatch = country !== null && rules.countries.has(country)
  if (countryMatch && rules.countryAction === 'hide') return decisive({ kind: 'country', country })

  const reasons: Reason[] = countryMatch ? [{ kind: 'country', country }] : []
  let score = 0
  const presetCtx = { copies: rules.presets.some((preset) => preset.id === 'copy-paste-replies') ? ctx.copies(post) : 0 }
  for (const preset of rules.presets) {
    if (!preset.test(post, presetCtx)) continue
    score += preset.weight
    reasons.push({ kind: 'preset', id: preset.id })
  }
  for (const rule of rules.rules) {
    if (!rule.test(post)) continue
    score += rule.weight
    reasons.push({ kind: 'rule', id: rule.id })
  }
  const action = score >= rules.threshold ? rules.action : countryMatch ? 'tag' : 'none'
  return { action, score, reasons: action === 'none' ? [] : reasons }
}

const MIN_COPY_LENGTH = 12
const MAX_COPY_ENTRIES = 5000

export function normalizeCopyText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\p{P}\p{S}\p{Extended_Pictographic}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export class CopyTracker {
  #authors = new Map<string, Set<string>>()

  record(post: Post): number {
    const key = normalizeCopyText(post.text)
    if (key.length < MIN_COPY_LENGTH) return 0
    let authors = this.#authors.get(key)
    if (authors === undefined) {
      if (this.#authors.size >= MAX_COPY_ENTRIES) {
        const oldest = this.#authors.keys().next().value
        if (oldest !== undefined) this.#authors.delete(oldest)
      }
      authors = new Set()
      this.#authors.set(key, authors)
    }
    authors.add(post.author.pk)
    return authors.size
  }

  count(post: Post): number {
    const key = normalizeCopyText(post.text)
    return key.length < MIN_COPY_LENGTH ? 0 : (this.#authors.get(key)?.size ?? 0)
  }
}

export function reasonMessageKey(reason: Reason): string {
  switch (reason.kind) {
    case 'preset':
      return `reason_${reason.id.replaceAll('-', '_')}`
    case 'rule':
      return 'reason_rule'
    case 'word':
      return 'reason_word'
    case 'host':
      return 'reason_host'
    case 'hidden-account':
      return 'reason_hidden_account'
    case 'country':
      return 'reason_country'
  }
}
