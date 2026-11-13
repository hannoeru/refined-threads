import { defineFeature } from '../api'
import { DATE_STYLES, formatDate } from './format'

const ORIGINAL = 'rtOriginalTime'

export default defineFeature({
  id: 'absolute-timestamps',
  enabledByDefault: false,
  options: {
    style: { type: 'select', default: 'medium', choices: DATE_STYLES },
    time: { type: 'boolean', default: true },
    relative: { type: 'boolean', default: false },
    pattern: { type: 'text', default: 'YYYY-MM-DD HH:mm', maxLength: 60 },
  },
  init(ctx) {
    const locale = ctx.t('@@ui_locale').replace('_', '-') || undefined
    const { style, time: withTime, relative, pattern } = ctx.options
    ctx.observe<HTMLTimeElement>('a[href*="/post/"] time[datetime]', (time) => {
      const date = new Date(time.dateTime)
      if (Number.isNaN(date.getTime()) || time.dataset[ORIGINAL] !== undefined)
        return
      const original = time.textContent ?? ''
      const formatted = formatDate(date, { style, time: withTime, pattern }, locale)
      time.dataset[ORIGINAL] = original
      time.title = formatDate(date, { style: 'long', time: true, pattern }, locale)
      time.textContent = relative
        ? `${original} · ${formatted}`
        : formatted
    })
    ctx.signal.addEventListener(
      'abort',
      () => {
        for (const time of ctx.document.querySelectorAll<HTMLTimeElement>('time[data-rt-original-time]')) {
          time.textContent = time.dataset[ORIGINAL] ?? time.textContent
          time.removeAttribute('title')
          delete time.dataset[ORIGINAL]
        }
      },
      { once: true },
    )
  },
})
