import type { Condition, Field, LeafCondition, Outcome, Post, Reason, Rule, Settings, Verdict } from '../model'
import type { LookupNeeds } from '../profile/lookups'
import {
  ABOUT_FIELDS,

} from '../model'
import { hostMatches, linkHost } from './hosts'

type Test = (post: Post, ctx: EvaluateContext) => boolean

type CompiledRule = Reason & { target: Rule['target'], score: number, test: Test }

export interface CompiledRules {
  tagOnly: boolean
  scoring: { posts: Outcome, replies: Outcome }
  rules: CompiledRule[]
  needs: LookupNeeds & { copies: boolean }
}

export interface EvaluateContext { copies: (post: Post) => number }

type FieldValue = string | number | boolean | string[] | null

function fieldValue(post: Post, field: Field, ctx: EvaluateContext): FieldValue {
  if (field === 'copies')
    return ctx.copies(post)
  if (field.startsWith('author.'))
    return post.author[field.slice(7) as keyof Post['author']]
  if (field.startsWith('counts.'))
    return post.counts[field.slice(7) as keyof Post['counts']]
  return post[field as Exclude<Field, `author.${string}` | `counts.${string}` | 'copies'>] as FieldValue
}

function strings(value: FieldValue): string[] {
  return Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? [value]
      : []
}

function numeric(value: FieldValue): number | null {
  return Array.isArray(value)
    ? value.length
    : typeof value === 'number'
      ? value
      : null
}

function fieldsOf(condition: Condition): Field[] {
  if ('all' in condition)
    return condition.all.flatMap(fieldsOf)
  if ('any' in condition)
    return condition.any.flatMap(fieldsOf)
  if ('not' in condition)
    return fieldsOf(condition.not)
  return [condition.field]
}

function neverMatches(condition: Condition): boolean {
  if ('all' in condition)
    return condition.all.some(neverMatches)
  if ('any' in condition)
    return condition.any.every(neverMatches)
  if ('not' in condition)
    return false
  if ('in' in condition)
    return condition.in.length === 0
  if ('contains_any' in condition)
    return condition.contains_any.every(needle => needle === '')
  if ('host_in' in condition)
    return condition.host_in.length === 0
  return false
}

function compileCondition(condition: Condition): Test | null {
  if ('all' in condition)
    return combine(condition.all, tests => (post, ctx) => tests.every(test => test(post, ctx)))
  if ('any' in condition)
    return combine(condition.any, tests => (post, ctx) => tests.some(test => test(post, ctx)))
  if ('not' in condition) {
    const inner = compileCondition(condition.not)
    return inner && ((post, ctx) => !inner(post, ctx))
  }
  return compileLeaf(condition)
}

function combine(conditions: Condition[], join: (tests: Test[]) => Test): Test | null {
  const tests: Test[] = []
  for (const condition of conditions) {
    const test = compileCondition(condition)
    if (!test)
      return null
    tests.push(test)
  }
  return join(tests)
}

function compilePattern(source: string): RegExp | null {
  try {
    return new RegExp(source, 'iu')
  }
  catch {
    return null
  }
}

function compileLeaf(condition: LeafCondition): Test | null {
  const read = (post: Post, ctx: EvaluateContext) => fieldValue(post, condition.field, ctx)
  const matchText = (match: (item: string) => boolean): Test => (post, ctx) => strings(read(post, ctx)).some(match)
  if ('is' in condition)
    return (post, ctx) => read(post, ctx) === condition.is
  if ('in' in condition) {
    const list = new Set(condition.in.map(item => item.toLowerCase()))
    return matchText(item => list.has(item.toLowerCase()))
  }
  if ('matches' in condition) {
    const pattern = compilePattern(condition.matches)
    return pattern && matchText(item => pattern.test(item))
  }
  if ('contains_any' in condition) {
    const needles = condition.contains_any.map(needle => needle.toLowerCase()).filter(Boolean)
    return matchText((item) => {
      const haystack = item.toLowerCase()
      return needles.some(needle => haystack.includes(needle))
    })
  }
  if ('host_in' in condition) {
    const targets = condition.host_in.map(host => host.toLowerCase())
    return matchText((link) => {
      const host = linkHost(link)
      return host !== null && targets.some(target => hostMatches(host, target))
    })
  }
  const above = 'gt' in condition
  const limit = above ? condition.gt : condition.lt
  return (post, ctx) => {
    const value = numeric(read(post, ctx))
    return value !== null && (above
      ? value > limit
      : value < limit)
  }
}

export function compileRules(settings: Settings): CompiledRules {
  const rules: CompiledRule[] = []
  const fields = new Set<Field>()
  for (const rule of settings.ruleFile.rules) {
    if (!rule.enabled || neverMatches(rule.when))
      continue
    const test = compileCondition(rule.when)
    if (test === null)
      continue
    for (const field of fieldsOf(rule.when)) fields.add(field)
    rules.push({
      id: rule.id,
      name: rule.name,
      effect: rule.effect,
      target: rule.target,
      score: rule.score,
      test,
    })
  }
  return {
    tagOnly: settings.tagOnly,
    scoring: settings.ruleFile.scoring,
    rules,
    needs: {
      about: ABOUT_FIELDS.some(field => fields.has(field)),
      followers: fields.has('author.followers'),
      posts: fields.has('author.posts'),
      copies: fields.has('copies'),
    },
  }
}

const NONE: Verdict = { action: 'none', score: 0, reasons: [] }

function decide(matched: CompiledRule[], score: number, outcome: Outcome, tagOnly: boolean): Verdict['action'] {
  const hide = matched.some(rule => rule.effect === 'hide') || (outcome.hideAt !== null && score >= outcome.hideAt)
  if (hide)
    return tagOnly ? 'tag' : 'hide'
  const tag = matched.some(rule => rule.effect === 'tag') || (outcome.tagAt !== null && score >= outcome.tagAt)
  return tag ? 'tag' : 'none'
}

export function evaluate(post: Post, compiled: CompiledRules, ctx: EvaluateContext): Verdict {
  const target = post.isReply ? 'replies' : 'posts'
  const matched: CompiledRule[] = []
  for (const rule of compiled.rules) {
    if ((rule.target !== 'all' && rule.target !== target) || !rule.test(post, ctx))
      continue
    if (rule.effect === 'allow')
      return NONE
    matched.push(rule)
  }
  const score = matched.reduce((sum, rule) => sum + (rule.effect === 'score'
    ? rule.score
    : 0), 0)
  const action = decide(matched, score, compiled.scoring[target], compiled.tagOnly)
  if (action === 'none')
    return { action, score, reasons: [] }
  return {
    action,
    score,
    reasons: matched.map(({ id, name, effect }) => ({ id, name, effect })),
  }
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
    if (key.length < MIN_COPY_LENGTH)
      return 0
    let authors = this.#authors.get(key)
    if (authors === undefined) {
      if (this.#authors.size >= MAX_COPY_ENTRIES) {
        const oldest = this.#authors.keys().next().value
        if (oldest !== undefined)
          this.#authors.delete(oldest)
      }
      authors = new Set()
      this.#authors.set(key, authors)
    }
    authors.add(post.author.pk)
    return authors.size
  }

  count(post: Post): number {
    const key = normalizeCopyText(post.text)
    return key.length < MIN_COPY_LENGTH
      ? 0
      : (this.#authors.get(key)?.size ?? 0)
  }
}
