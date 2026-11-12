import { authorLinkOf, POST_CONTAINER, postCodeOf } from '../../threads/dom'
import { defineFeature } from '../api'

const BADGE = 'rt-account-info'

const flag = (code: string) => String.fromCodePoint(...[...code].map((letter) => 0x1f1a5 + letter.charCodeAt(0)))

export default defineFeature({
  id: 'account-info',
  enabledByDefault: false,
  options: {
    country: { type: 'boolean', default: true },
    age: { type: 'boolean', default: true },
    followers: { type: 'boolean', default: false },
  },
  init(ctx) {
    const { options, lookups, t } = ctx
    const needs = { about: options.country || options.age, profile: options.followers }
    const language = t('@@ui_locale').replace('_', '-') || undefined
    const compact = new Intl.NumberFormat(language, { notation: 'compact' })
    const badges = new Map<string, Set<HTMLElement>>()

    ctx.addStyle(`.${BADGE} { margin-inline-start: 6px; font-size: 12px; opacity: 0.75; white-space: nowrap; }`)

    const describe = (pk: string): string => {
      const data = lookups.data(pk)
      const parts: string[] = []
      if (options.country && data.country) parts.push(flag(data.country))
      if (options.age && data.ageMonths !== null) {
        parts.push(data.ageMonths >= 12 ? t('feature_account_info_age_years', [String(Math.floor(data.ageMonths / 12))]) : t('feature_account_info_age_months', [String(data.ageMonths)]))
      }
      if (options.followers && data.followers !== null) parts.push(t('feature_account_info_followers', [compact.format(data.followers)]))
      return parts.join(' · ')
    }

    const refresh = (pk: string) => {
      const text = describe(pk)
      for (const badge of badges.get(pk) ?? []) {
        badge.textContent = text
        badge.hidden = text === ''
      }
    }

    const attach = (container: HTMLElement) => {
      const code = postCodeOf(container)
      const post = code ? ctx.posts.get(code) : undefined
      if (!post) return
      const link = authorLinkOf(container, post.author.username)
      if (!link || link.nextElementSibling?.classList.contains(BADGE)) return
      const badge = ctx.document.createElement('span')
      badge.className = BADGE
      link.after(badge)
      const set = badges.get(post.author.pk) ?? new Set()
      set.add(badge)
      badges.set(post.author.pk, set)
      refresh(post.author.pk)
      lookups.want(post.author.pk, post.author.username, needs)
    }

    ctx.observe<HTMLElement>(POST_CONTAINER, attach)
    ctx.posts.subscribe(() => ctx.document.querySelectorAll<HTMLElement>(POST_CONTAINER).forEach(attach), ctx.signal)
    lookups.subscribe(refresh, ctx.signal)
    ctx.signal.addEventListener('abort', () => ctx.document.querySelectorAll(`.${BADGE}`).forEach((badge) => badge.remove()), { once: true })
  },
})
