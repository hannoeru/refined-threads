import { defineFeature } from '../api'

const ORIGINAL = 'rtOriginalTime'

export default defineFeature({
  id: 'absolute-timestamps',
  enabledByDefault: false,
  options: {
    format: { type: 'select', default: 'date-time', choices: ['date-time', 'date', 'relative-and-date'] },
  },
  init(ctx) {
    const language = ctx.t('@@ui_locale').replace('_', '-') || undefined
    const formatter = new Intl.DateTimeFormat(
      language,
      ctx.options.format === 'date' ? { dateStyle: 'medium' } : { dateStyle: 'medium', timeStyle: 'short' },
    )
    ctx.observe<HTMLTimeElement>('a[href*="/post/"] time[datetime]', (time) => {
      const date = new Date(time.dateTime)
      if (Number.isNaN(date.getTime()) || time.dataset[ORIGINAL] !== undefined) return
      const original = time.textContent ?? ''
      time.dataset[ORIGINAL] = original
      time.textContent = ctx.options.format === 'relative-and-date' ? `${original} · ${formatter.format(date)}` : formatter.format(date)
    })
    ctx.signal.addEventListener(
      'abort',
      () => {
        for (const time of ctx.document.querySelectorAll<HTMLTimeElement>('time[data-rt-original-time]')) {
          time.textContent = time.dataset[ORIGINAL] ?? time.textContent
          delete time.dataset[ORIGINAL]
        }
      },
      { once: true },
    )
  },
})
