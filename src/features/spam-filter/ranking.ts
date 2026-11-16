import type { RankedAccount, Ranking } from '../../model'

export const MAX_ACCOUNTS = 500
export const MAX_CODES = 30
export const TOP = 50

export interface Sighting {
  pk: string
  username: string
  code: string
  action: 'hide' | 'tag'
  ruleIds: string[]
  day: string
}

const total = (account: RankedAccount) => account.hidden + account.tagged

export function addSighting(ranking: Ranking, sighting: Sighting): Ranking {
  const current = ranking[sighting.pk]
  if (current?.codes.includes(sighting.code))
    return ranking
  const base = current ?? {
    username: sighting.username,
    hidden: 0,
    tagged: 0,
    byRule: {},
    lastSeen: sighting.day,
    codes: [],
  }
  const byRule = { ...base.byRule }
  for (const id of sighting.ruleIds) byRule[id] = (byRule[id] ?? 0) + 1
  const next: Ranking = {
    ...ranking,
    [sighting.pk]: {
      username: sighting.username,
      hidden: base.hidden + (sighting.action === 'hide'
        ? 1
        : 0),
      tagged: base.tagged + (sighting.action === 'tag'
        ? 1
        : 0),
      byRule,
      lastSeen: sighting.day,
      codes: [...base.codes, sighting.code].slice(-MAX_CODES),
    },
  }
  const pks = Object.keys(next)
  if (pks.length <= MAX_ACCOUNTS)
    return next
  const dropped = pks
    .filter(pk => pk !== sighting.pk)
    .sort((a, b) => next[a]!.lastSeen.localeCompare(next[b]!.lastSeen) || total(next[a]!) - total(next[b]!))
    .slice(0, pks.length - MAX_ACCOUNTS)
  for (const pk of dropped) delete next[pk]
  return next
}

export interface RankRow extends RankedAccount { pk: string, topRule: string | null }

export function topAccounts(ranking: Ranking, limit = TOP): RankRow[] {
  return Object.entries(ranking)
    .sort(([, a], [, b]) => total(b) - total(a) || b.lastSeen.localeCompare(a.lastSeen))
    .slice(0, limit)
    .map(([pk, account]) => ({
      ...account,
      pk,
      topRule: Object.entries(account.byRule).sort(([, a], [, b]) => b - a)[0]?.[0] ?? null,
    }))
}
