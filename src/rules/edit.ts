import { BUILT_IN_RULES, type BuiltInRuleId, type Condition, type Level, LEVEL_RULES, LEVEL_TOGGLED, type Rule, type RuleFile } from '../model'

export const LIST_RULES = ['allowed-accounts', 'hidden-accounts', 'blocked-words', 'blocked-sites', 'countries'] as const
export type ListRuleId = (typeof LIST_RULES)[number]

const LIST_KEY: Record<ListRuleId, 'in' | 'contains_any' | 'host_in'> = {
  'allowed-accounts': 'in',
  'hidden-accounts': 'in',
  'blocked-words': 'contains_any',
  'blocked-sites': 'host_in',
  countries: 'in',
}

const leaves = (condition: Condition): Condition[] =>
  'all' in condition ? condition.all.flatMap(leaves) : 'any' in condition ? condition.any.flatMap(leaves) : 'not' in condition ? leaves(condition.not) : [condition]

export function findRule(file: RuleFile, id: string): Rule | undefined {
  return file.rules.find((rule) => rule.id === id)
}

function ensureRule(file: RuleFile, id: BuiltInRuleId): Rule {
  const existing = findRule(file, id)
  if (existing) return existing
  const builtIn = structuredClone(BUILT_IN_RULES.find((rule) => rule.id === id)) as unknown as Partial<Rule> & Pick<Rule, 'id' | 'when'>
  const rule: Rule = { name: '', enabled: true, target: 'all', effect: 'score', score: 1, ...builtIn }
  file.rules.push(rule)
  return rule
}

export function readList(file: RuleFile, id: ListRuleId): string[] {
  const rule = findRule(file, id)
  if (!rule) return []
  const key = LIST_KEY[id]
  const leaf = leaves(rule.when).find((condition) => key in condition) as Record<string, unknown> | undefined
  return Array.isArray(leaf?.[key]) ? (leaf[key] as string[]) : []
}

export function writeList(file: RuleFile, id: ListRuleId, values: string[]): RuleFile {
  const next = structuredClone(file)
  const rule = ensureRule(next, id)
  const key = LIST_KEY[id]
  for (const leaf of leaves(rule.when)) {
    if (key in leaf) (leaf as Record<string, unknown>)[key] = [...new Set(values)]
  }
  return next
}

export function applyLevel(file: RuleFile, level: Level): RuleFile {
  const next = structuredClone(file)
  for (const id of LEVEL_TOGGLED) ensureRule(next, id).enabled = LEVEL_RULES[level].includes(id)
  return next
}

export function updateRule(file: RuleFile, id: string, patch: Partial<Rule>): RuleFile {
  const next = structuredClone(file)
  const rule = findRule(next, id)
  if (rule) Object.assign(rule, patch)
  return next
}

export function addAccount(file: RuleFile, list: 'hidden-accounts' | 'allowed-accounts', handle: string): RuleFile {
  const other = list === 'hidden-accounts' ? 'allowed-accounts' : 'hidden-accounts'
  const name = handle.toLowerCase()
  const removed = writeList(file, other, readList(file, other).filter((item) => item !== name))
  return writeList(removed, list, [...readList(removed, list), name])
}

export const isBuiltIn = (id: string): id is BuiltInRuleId => BUILT_IN_RULES.some((rule) => rule.id === id)

export function ruleLabel(rule: { id: string; name: string }, translate: (key: string) => string): string {
  if (rule.name) return rule.name
  return (isBuiltIn(rule.id) && translate(`rule_${rule.id.replaceAll('-', '_')}`)) || rule.id
}
