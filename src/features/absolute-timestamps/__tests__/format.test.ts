import { describe, expect, it } from 'vitest'
import { formatDate, formatPattern } from '../format'

const date = new Date(2026, 10, 3, 9, 5, 7)

describe('formatDate', () => {
  it('formats the fixed styles with and without time', () => {
    expect(formatDate(date, { style: 'iso', time: true, pattern: '' }, 'en')).toBe('2026-11-03 09:05')
    expect(formatDate(date, { style: 'iso', time: false, pattern: '' }, 'en')).toBe('2026-11-03')
    expect(formatDate(date, { style: 'us', time: true, pattern: '' }, 'en')).toBe('11/03/2026 9:05 AM')
    expect(formatDate(date, { style: 'eu', time: false, pattern: '' }, 'en')).toBe('03/11/2026')
  })

  it('uses the language style for medium, short, and long', () => {
    expect(formatDate(date, { style: 'medium', time: false, pattern: '' }, 'en')).toBe('Nov 3, 2026')
    expect(formatDate(date, { style: 'long', time: false, pattern: '' }, 'en')).toBe('November 3, 2026')
    expect(formatDate(date, { style: 'short', time: false, pattern: '' }, 'en')).toBe('11/3/26')
    expect(formatDate(date, { style: 'medium', time: true, pattern: '' }, 'en')).toMatch(/^Nov 3, 2026, 9:05\sAM$/)
    expect(formatDate(date, { style: 'long', time: false, pattern: '' }, 'ja')).toBe('2026年11月3日')
  })

  it('uses the custom pattern, and a plain date when the pattern is empty', () => {
    expect(formatDate(date, { style: 'custom', time: true, pattern: 'ddd, MMM D · HH:mm' }, 'en')).toBe('Tue, Nov 3 · 09:05')
    expect(formatDate(date, { style: 'custom', time: true, pattern: '' }, 'en')).toBe('2026-11-03')
  })
})

describe('formatPattern', () => {
  it('supports every token and keeps text in brackets', () => {
    expect(formatPattern(date, 'YYYY YY MMMM MMM MM M DD D dddd ddd HH H hh h mm ss A', 'en')).toBe(
      '2026 26 November Nov 11 11 03 3 Tuesday Tue 09 9 09 9 05 07 AM',
    )
    expect(formatPattern(new Date(2026, 0, 1, 15, 0), '[Posted] h:mm A [on] D', 'en')).toBe('Posted 3:00 PM on 1')
  })
})
