import type { RankedAccount, Ranking } from '../../../model'
import { describe, expect, it } from 'vitest'
import { addSighting, MAX_ACCOUNTS, topAccounts } from '../ranking'

function account(input: Partial<RankedAccount> = {}): RankedAccount {
  return {
    username: 'amy',
    hidden: 1,
    tagged: 0,
    byRule: {},
    lastSeen: '2026-11-12',
    codes: [],
    ...input,
  }
}

function sighting(code: string, pk = 'p1', day = '2026-11-12') {
  return {
    pk,
    username: 'amy',
    code,
    action: 'hide' as const,
    ruleIds: ['affiliate-links'],
    day,
  }
}

describe('addSighting', () => {
  it('keeps only the newest 30 post codes of an account', () => {
    let ranking: Ranking = {}
    for (let index = 0; index < 35; index++) ranking = addSighting(ranking, sighting(`C${index}`))
    expect(ranking.p1!.hidden).toBe(35)
    expect(ranking.p1!.codes).toHaveLength(30)
    expect(ranking.p1!.codes[0]).toBe('C5')
  })

  it('drops the accounts seen longest ago, then the lowest counts, when over 500 accounts', () => {
    const ranking: Ranking = {}
    for (let index = 0; index < MAX_ACCOUNTS; index++)
      ranking[`p${index}`] = account({ hidden: 5 })
    ranking.p0 = account({ hidden: 50, lastSeen: '2026-01-01' })
    ranking.p1 = account({ hidden: 1, lastSeen: '2026-11-13' })
    ranking.p3 = account({ hidden: 1 })
    const one = addSighting(ranking, sighting('NEW', 'new', '2026-11-13'))
    expect(Object.keys(one)).toHaveLength(MAX_ACCOUNTS)
    expect(one.p0).toBeUndefined()
    expect(one.new).toBeDefined()
    const two = addSighting(one, sighting('NEW2', 'new2', '2026-11-14'))
    expect(Object.keys(two)).toHaveLength(MAX_ACCOUNTS)
    expect(two.p3).toBeUndefined()
    expect(two.p2).toBeDefined()
    expect(two.p1).toBeDefined()
    expect(two.new2).toBeDefined()
  })
})

describe('topAccounts', () => {
  it('sorts by hidden plus tagged, then by the newest last seen day, and keeps the top 50', () => {
    const ranking: Ranking = {
      old: account({ hidden: 2, lastSeen: '2026-11-01' }),
      new: account({ hidden: 1, tagged: 1, lastSeen: '2026-11-10' }),
      most: account({
        hidden: 1,
        tagged: 5,
        byRule: { 'a': 1, 'engagement-bait': 4 },
      }),
    }
    for (let index = 0; index < 60; index++)
      ranking[`x${index}`] = account({ hidden: 1, lastSeen: '2026-10-01' })
    const top = topAccounts(ranking)
    expect(top).toHaveLength(50)
    expect(top.slice(0, 3).map(row => row.pk)).toEqual(['most', 'new', 'old'])
    expect(top[0]!.topRule).toBe('engagement-bait')
  })
})
