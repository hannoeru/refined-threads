import type { Condition, Field, LeafCondition } from '../model'
import { compilePattern } from '../rules/pattern'

export type FieldKind = 'text' | 'list' | 'flag' | 'number'

export const FIELD_KINDS: Record<Field, FieldKind> = {
  'text': 'text',
  'language': 'text',
  'author.username': 'text',
  'author.fullName': 'text',
  'author.bio': 'text',
  'author.country': 'text',
  'links': 'list',
  'mentions': 'list',
  'selfReplyLinks': 'list',
  'hasAiLabel': 'flag',
  'isPaidPartnership': 'flag',
  'isReply': 'flag',
  'author.isVerified': 'flag',
  'author.isPrivate': 'flag',
  'author.following': 'flag',
  'author.followedBy': 'flag',
  'copies': 'number',
  'author.ageMonths': 'number',
  'author.followers': 'number',
  'author.posts': 'number',
  'counts.likes': 'number',
  'counts.replies': 'number',
  'counts.reposts': 'number',
  'counts.quotes': 'number',
}

export const OPERATORS = [
  'contains_any',
  'in',
  'matches',
  'host_in',
  'is',
  'gt',
  'lt',
] as const
export type Operator = (typeof OPERATORS)[number]

export function operatorsFor(field: Field): Operator[] {
  switch (FIELD_KINDS[field]) {
    case 'text':
      return ['contains_any', 'in', 'matches']
    case 'list':
      return field === 'mentions'
        ? ['contains_any', 'in', 'gt', 'lt']
        : ['host_in', 'contains_any', 'gt', 'lt']
    case 'flag':
      return ['is']
    case 'number':
      return ['gt', 'lt']
  }
}

export interface Row { field: Field, operator: Operator, value: string }

export interface RuleForm { match: 'all' | 'any', rows: Row[] }

const LIST_OPERATORS: Operator[] = ['contains_any', 'in', 'host_in']

function leafToRow(leaf: LeafCondition): Row {
  const { field } = leaf
  if ('contains_any' in leaf) {
    return {
      field,
      operator: 'contains_any',
      value: leaf.contains_any.join(', '),
    }
  }
  if ('in' in leaf) {
    return {
      field,
      operator: 'in',
      value: leaf.in.join(', '),
    }
  }
  if ('host_in' in leaf) {
    return {
      field,
      operator: 'host_in',
      value: leaf.host_in.join(', '),
    }
  }
  if ('matches' in leaf)
    return { field, operator: 'matches', value: leaf.matches }
  if ('gt' in leaf) {
    return {
      field,
      operator: 'gt',
      value: String(leaf.gt),
    }
  }
  if ('lt' in leaf) {
    return {
      field,
      operator: 'lt',
      value: String(leaf.lt),
    }
  }
  return {
    field,
    operator: 'is',
    value: String(leaf.is),
  }
}

const isLeaf = (condition: Condition): condition is LeafCondition => 'field' in condition

export function toForm(condition: Condition): RuleForm | null {
  if (isLeaf(condition)) {
    return {
      match: 'all',
      rows: [
        leafToRow(condition),
      ],
    }
  }
  if ('all' in condition && condition.all.every(isLeaf)) {
    return {
      match: 'all',
      rows: condition.all.map(leafToRow),
    }
  }
  if ('any' in condition && condition.any.every(isLeaf)) {
    return {
      match: 'any',
      rows: condition.any.map(leafToRow),
    }
  }
  return null
}

const isValidPattern = (value: string): boolean => compilePattern(value) !== null

function listLeaf({ field, operator, value }: Row): LeafCondition | null {
  const items = value.split(/[,、，\n]/).map(item => item.trim()).filter(Boolean)
  if (items.length === 0)
    return null
  if (operator === 'contains_any')
    return { field, contains_any: items }
  if (operator === 'in')
    return { field, in: items }
  return {
    field,
    host_in: items.map(item => item.toLowerCase()),
  }
}

function numberLeaf({ field, operator, value }: Row): LeafCondition | null {
  const number = Number(value)
  if (value.trim() === '' || !Number.isFinite(number))
    return null
  return operator === 'gt'
    ? { field, gt: number }
    : { field, lt: number }
}

function rowToLeaf(row: Row): LeafCondition | null {
  const { field, operator, value } = row
  if (LIST_OPERATORS.includes(operator))
    return listLeaf(row)
  if (operator === 'gt' || operator === 'lt')
    return numberLeaf(row)
  if (operator === 'matches') {
    return value && isValidPattern(value)
      ? { field, matches: value }
      : null
  }
  if (FIELD_KINDS[field] === 'flag')
    return { field, is: value === 'true' }
  return value
    ? { field, is: value }
    : null
}

export function fromForm(form: RuleForm): Condition | null {
  const leaves = form.rows.map(rowToLeaf)
  if (leaves.length === 0 || !leaves.every((leaf): leaf is LeafCondition => leaf !== null))
    return null
  return form.match === 'all'
    ? { all: leaves }
    : { any: leaves }
}

export function defaultRow(field: Field = 'text'): Row {
  const operator = operatorsFor(field)[0]!
  return {
    field,
    operator,
    value: FIELD_KINDS[field] === 'flag'
      ? 'true'
      : '',
  }
}
