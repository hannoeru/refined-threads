import { describe, expect, it } from 'vitest'
import { ageInMonths, CountryNames, parseCount, parseJoined, parseProfileCounts } from '../normalize'

describe('CountryNames', () => {
  const names = new CountryNames(['ja', 'zh-TW', 'zh-CN', 'ko', 'en'])

  it('maps localized country names from About this profile to ISO codes', () => {
    expect(names.code('日本')).toBe('JP')
    expect(names.code('台灣')).toBe('TW')
    expect(names.code('臺灣')).toBe('TW')
    expect(names.code('中国')).toBe('CN')
    expect(names.code('United States')).toBe('US')
    expect(names.code('Hong Kong')).toBe('HK')
    expect(names.code('대한민국')).toBe('KR')
  })

  it('returns null for names it does not know', () => {
    expect(names.code('Atlantis')).toBeNull()
  })
})

describe('parseJoined', () => {
  it('reads year and month from localized joined text', () => {
    expect(parseJoined('2023年7月 · 1億人以上', ['ja'])).toEqual({ year: 2023, month: 6 })
    expect(parseJoined('July 2023 · Over 100M', ['en'])).toEqual({ year: 2023, month: 6 })
    expect(parseJoined('Sept 2024', ['en'])).toEqual({ year: 2024, month: 8 })
    expect(parseJoined('2025년 3월', ['ko'])).toEqual({ year: 2025, month: 2 })
  })

  it('assumes January when the month is unknown, so age is never underestimated', () => {
    expect(parseJoined('2024', ['en'])).toEqual({ year: 2024, month: 0 })
    expect(parseJoined('no date', ['en'])).toBeNull()
  })

  it('computes age in whole months', () => {
    expect(ageInMonths({ year: 2023, month: 6 }, new Date(Date.UTC(2026, 10, 12)))).toBe(40)
    expect(ageInMonths({ year: 2026, month: 11 }, new Date(Date.UTC(2026, 10, 12)))).toBe(0)
  })
})

describe('profile counts', () => {
  it('reads followers and posts from the profile description', () => {
    expect(parseProfileCounts('フォロワー100人・スレッド4,515 件・🇯🇵 1 Japanese word')).toEqual({ followers: 100, posts: 4515 })
    expect(parseProfileCounts('1.2K Followers • 300 Threads • bio')).toEqual({ followers: 1200, posts: 300 })
    expect(parseProfileCounts('粉絲 3.4萬 人・串文 12 則')).toEqual({ followers: 34000, posts: 12 })
    expect(parseProfileCounts('See the latest conversations')).toEqual({ followers: null, posts: null })
  })

  it('reads compact and grouped numbers', () => {
    expect(parseCount('1,5 M Follower')).toBe(1_500_000)
    expect(parseCount('12.345 Follower')).toBe(12345)
    expect(parseCount('8 천')).toBe(8000)
  })
})
