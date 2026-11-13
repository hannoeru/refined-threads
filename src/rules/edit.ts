import type { BuiltInRuleId, Condition, Level, Rule, RuleFile } from '../model'
import * as v from 'valibot'
import { BUILT_IN_IDS, BUILT_IN_RULE_INPUTS, LEVEL_RULES, LEVEL_TOGGLED, RuleSchema } from '../model'

export type ListRuleId = 'allowed-accounts' | 'hidden-accounts' | 'blocked-words' | 'blocked-sites' | 'countries'

const LIST_KEY: Record<ListRuleId, 'in' | 'contains_any' | 'host_in'> = {
  'allowed-accounts': 'in',
  'hidden-accounts': 'in',
  'blocked-words': 'contains_any',
  'blocked-sites': 'host_in',
  'countries': 'in',
}

function leaves(condition: Condition): Condition[] {
  return 'all' in condition
    ? condition.all.flatMap(leaves)
    : 'any' in condition
      ? condition.any.flatMap(leaves)
      : 'not' in condition
        ? leaves(condition.not)
        : [condition]
}

export function findRule(file: RuleFile, id: string): Rule | undefined {
  return file.rules.find(rule => rule.id === id)
}

function ensureRule(file: RuleFile, id: BuiltInRuleId): Rule {
  const existing = findRule(file, id)
  if (existing)
    return existing
  const rule = v.parse(RuleSchema, structuredClone(BUILT_IN_RULE_INPUTS.find(item => item.id === id)))
  file.rules.push(rule)
  return rule
}

export function readList(file: RuleFile, id: ListRuleId): string[] {
  const rule = findRule(file, id)
  if (!rule)
    return []
  const key = LIST_KEY[id]
  const leaf = leaves(rule.when).find(condition => key in condition) as Record<string, unknown> | undefined
  return Array.isArray(leaf?.[key])
    ? (leaf[key] as string[])
    : []
}

export function writeList(file: RuleFile, id: ListRuleId, values: string[]): RuleFile {
  const next = structuredClone(file)
  const rule = ensureRule(next, id)
  const key = LIST_KEY[id]
  for (const leaf of leaves(rule.when)) {
    if (key in leaf) {
      (leaf as Record<string, unknown>)[key] = [
        ...new Set(values),
      ]
    }
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
  if (rule)
    Object.assign(rule, patch)
  return next
}

export function addAccount(file: RuleFile, list: 'hidden-accounts' | 'allowed-accounts', handle: string): RuleFile {
  const other = list === 'hidden-accounts'
    ? 'allowed-accounts'
    : 'hidden-accounts'
  const name = handle.toLowerCase()
  const removed = writeList(file, other, readList(file, other).filter(item => item !== name))
  return writeList(removed, list, [
    ...readList(removed, list),
    name,
  ])
}

export const isBuiltIn = (id: string): id is BuiltInRuleId => BUILT_IN_IDS.includes(id)

export function ruleLabel(rule: { id: string, name: string }, translate: (key: string) => string): string {
  if (rule.name)
    return rule.name
  return (isBuiltIn(rule.id) && translate(`rule_${rule.id.replaceAll('-', '_')}`)) || rule.id
}
