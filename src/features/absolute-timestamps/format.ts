export const DATE_STYLES = ['medium', 'short', 'long', 'iso', 'us', 'eu', 'custom'] as const
export type DateStyle = (typeof DATE_STYLES)[number]

export type DateOptions = { style: DateStyle; time: boolean; pattern: string }

const pad = (value: number, size = 2) => String(value).padStart(size, '0')

const TOKENS = /\[([^\]]*)\]|YYYY|YY|MMMM|MMM|MM|M|DD|D|dddd|ddd|HH|H|hh|h|mm|ss|A/g

export function formatPattern(date: Date, pattern: string, locale: string | undefined): string {
  const hours12 = date.getHours() % 12 || 12
  const name = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, options).format(date)
  return pattern.replace(TOKENS, (token, literal: string | undefined) => {
    if (literal !== undefined) return literal
    switch (token) {
      case 'YYYY':
        return String(date.getFullYear())
      case 'YY':
        return pad(date.getFullYear() % 100)
      case 'MMMM':
        return name({ month: 'long' })
      case 'MMM':
        return name({ month: 'short' })
      case 'MM':
        return pad(date.getMonth() + 1)
      case 'M':
        return String(date.getMonth() + 1)
      case 'DD':
        return pad(date.getDate())
      case 'D':
        return String(date.getDate())
      case 'dddd':
        return name({ weekday: 'long' })
      case 'ddd':
        return name({ weekday: 'short' })
      case 'HH':
        return pad(date.getHours())
      case 'H':
        return String(date.getHours())
      case 'hh':
        return pad(hours12)
      case 'h':
        return String(hours12)
      case 'mm':
        return pad(date.getMinutes())
      case 'ss':
        return pad(date.getSeconds())
      default:
        return date.getHours() < 12 ? 'AM' : 'PM'
    }
  })
}

const FIXED: Record<'iso' | 'us' | 'eu', { date: string; time: string }> = {
  iso: { date: 'YYYY-MM-DD', time: ' HH:mm' },
  us: { date: 'MM/DD/YYYY', time: ' h:mm A' },
  eu: { date: 'DD/MM/YYYY', time: ' HH:mm' },
}

export function formatDate(date: Date, options: DateOptions, locale: string | undefined): string {
  if (options.style === 'custom') return formatPattern(date, options.pattern || 'YYYY-MM-DD', locale)
  if (options.style === 'iso' || options.style === 'us' || options.style === 'eu') {
    const fixed = FIXED[options.style]
    return formatPattern(date, fixed.date + (options.time ? fixed.time : ''), locale)
  }
  return new Intl.DateTimeFormat(locale, { dateStyle: options.style, ...(options.time ? { timeStyle: 'short' } : {}) }).format(date)
}
