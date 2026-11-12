import { describe, expect, it } from 'vitest'
import { defaultSettings } from '../../model'
import { addAccount, applyLevel, findRule, readList, ruleLabel, updateRule, writeList } from '../edit'

const file = () => defaultSettings().ruleFile

describe('rule file editing', () => {
  it('reads and writes the lists of built-in rules without changing the input', () => {
    const original = file()
    const next = writeList(original, 'blocked-sites', ['example.com', 'example.com', 'spam.net'])
    expect(readList(next, 'blocked-sites')).toEqual(['example.com', 'spam.net'])
    expect(readList(original, 'blocked-sites')).toEqual([])
  })

  it('moves an account between hidden and allowed', () => {
    const hidden = addAccount(file(), 'hidden-accounts', 'Amy')
    expect(readList(hidden, 'hidden-accounts')).toEqual(['amy'])
    const allowed = addAccount(hidden, 'allowed-accounts', 'amy')
    expect(readList(allowed, 'hidden-accounts')).toEqual([])
    expect(readList(allowed, 'allowed-accounts')).toEqual(['amy'])
  })

  it('applies a level by turning the level rules on and the others off', () => {
    const strict = applyLevel(file(), 'strict')
    expect(findRule(strict, 'ai-label')?.enabled).toBe(true)
    const light = applyLevel(strict, 'light')
    expect(findRule(light, 'engagement-bait')?.enabled).toBe(false)
    expect(findRule(light, 'affiliate-links')?.enabled).toBe(true)
  })

  it('restores a deleted built-in rule when its list is edited', () => {
    const without = { ...file(), rules: file().rules.filter((rule) => rule.id !== 'countries') }
    expect(readList(writeList(without, 'countries', ['JP']), 'countries')).toEqual(['JP'])
  })

  it('updates one rule', () => {
    expect(findRule(updateRule(file(), 'countries', { effect: 'tag' }), 'countries')?.effect).toBe('tag')
  })

  it('labels built-in rules by translation and custom rules by name', () => {
    const t = (key: string) => (key === 'rule_blocked_words' ? 'Blocked words' : '')
    expect(ruleLabel({ id: 'blocked-words', name: '' }, t)).toBe('Blocked words')
    expect(ruleLabel({ id: 'mine', name: 'My rule' }, t)).toBe('My rule')
    expect(ruleLabel({ id: 'mine', name: '' }, t)).toBe('mine')
  })
})
