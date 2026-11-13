const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

const REGION_CODES = [...LETTERS].flatMap(a => [...LETTERS].map(b => a + b))

function normalizeName(name: string) {
  return name
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s*\(.*\)$/, '')
    .replace(/\s*(sar china|sar|特別行政區|特别行政区|特別行政区)$/u, '')
    .replace(/[\s.'’]/g, '')
    .replace(/臺/g, '台')
}

export class CountryNames {
  #codes = new Map<string, string>()

  constructor(languages: readonly string[]) {
    for (const language of new Set([...languages, 'en'])) {
      for (const style of ['long', 'short'] as const) {
        let names: Intl.DisplayNames
        try {
          names = new Intl.DisplayNames([language], { type: 'region', style, fallback: 'none' })
        }
        catch {
          continue
        }
        for (const code of REGION_CODES) {
          const name = names.of(code)
          if (name && name !== code)
            this.#codes.set(normalizeName(name), code)
        }
      }
    }
  }

  code(name: string): string | null {
    return this.#codes.get(normalizeName(name)) ?? null
  }
}

export interface YearMonth { year: number, month: number }

function monthNames(languages: readonly string[]) {
  const long: [string, number][] = []
  const short: [string, number][] = []
  for (const language of new Set([...languages, 'en'])) {
    for (let month = 0; month < 12; month++) {
      const date = new Date(Date.UTC(2020, month, 15))
      try {
        long.push([
          new Intl.DateTimeFormat(language, { month: 'long', timeZone: 'UTC' }).format(date).toLowerCase(),
          month,
        ])
        short.push([
          new Intl.DateTimeFormat(language, { month: 'short', timeZone: 'UTC' }).format(date).toLowerCase().replace('.', ''),
          month,
        ])
      }
      catch {
        continue
      }
    }
  }
  return [
    ...long,
    ...short,
  ].filter(([name]) => /\p{L}{3,}/u.test(name))
}

export function parseJoined(text: string, languages: readonly string[]): YearMonth | null {
  const yearMatch = text.match(/(?:19|20)\d{2}/)
  if (!yearMatch)
    return null
  const year = Number(yearMatch[0])
  const numeric = text.match(/(\d{1,2})\s*[月월]/)
  if (numeric) {
    return {
      year,
      month: Math.min(11, Math.max(0, Number(numeric[1]) - 1)),
    }
  }
  const lower = text.toLowerCase()
  const named = monthNames(languages).find(([name]) => lower.includes(name))
  return {
    year,
    month: named ? named[1] : 0,
  }
}

export function ageInMonths(joined: YearMonth, now: Date): number {
  return Math.max(0, (now.getUTCFullYear() - joined.year) * 12 + now.getUTCMonth() - joined.month)
}

const MULTIPLIERS: Record<string, number> = {
  k: 1e3,
  m: 1e6,
  b: 1e9,
  千: 1e3,
  万: 1e4,
  萬: 1e4,
  億: 1e8,
  亿: 1e8,
  천: 1e3,
  만: 1e4,
  억: 1e8,
}

export function parseCount(segment: string): number | null {
  const match = segment.match(/(\d[\d.,\s]*)([kmb千万萬億亿천만억])?/iu)
  if (!match?.[1])
    return null
  const suffix = match[2]?.toLowerCase()
  const digits = match[1].trim()
  if (suffix) {
    const value = Number(digits.replace(/\s/g, '').replace(',', '.'))
    return Number.isFinite(value)
      ? Math.round(value * (MULTIPLIERS[suffix] ?? 1))
      : null
  }
  const value = Number(digits.replace(/[.,\s]/g, ''))
  return Number.isFinite(value)
    ? value
    : null
}

export function parseProfileCounts(description: string): { followers: number | null, posts: number | null } {
  const [first = '', second = ''] = description.split(/[・•·]/)
  return {
    followers: parseCount(first),
    posts: parseCount(second),
  }
}
