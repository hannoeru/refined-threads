import { authorLinkOf, POST_CONTAINER, postCodeOf } from '../../threads/dom'
import type { ProfileData } from '../../profile/lookups'
import { defineFeature } from '../api'

const BADGE = 'rt-account-info'

const flag = (code: string) => String.fromCodePoint(...[...code].map((letter) => 0x1f1a5 + letter.charCodeAt(0)))

export default defineFeature({
  id: 'account-info',
  enabledByDefault: false,
  options: {
    geo: { type: 'select', default: 'flag', choices: ['flag', 'flag-name', 'name', 'off'] },
    age: { type: 'boolean', default: true },
    followers: { type: 'boolean', default: false },
  },
  init(ctx) {
    const { options, lookups, t } = ctx
    const needs = { about: options.geo !== 'off' || options.age, profile: options.followers }
    const language = t('@@ui_locale').replace('_', '-') || undefined
    const compact = new Intl.NumberFormat(language, { notation: 'compact' })
    const regions = new Intl.DisplayNames(language ? [language] : [], { type: 'region' })
    const badges = new Map<string, Set<HTMLElement>>()

    ctx.addStyle(`.${BADGE} { margin-inline-start: 6px; font-size: 12px; opacity: 0.75; white-space: nowrap; }`)

    const geo = (data: ProfileData): { short: string; full: string } | null => {
      if (options.geo === 'off') return null
      if (data.countryHidden) {
        const full = `🏴 ${t('feature_account_info_location_hidden')}`
        return { short: options.geo === 'flag' ? '🏴' : options.geo === 'name' ? t('feature_account_info_location_hidden') : full, full }
      }
      const name = data.country ? (regions.of(data.country) ?? data.country) : data.countryName
      if (!name) return null
      const mark = data.country ? flag(data.country) : ''
      const full = [mark, name].filter(Boolean).join(' ')
      return { short: options.geo === 'flag' ? mark || name : options.geo === 'name' ? name : full, full }
    }

    const describe = (pk: string): { text: string; title: string } => {
      const data = lookups.data(pk)
      const short: string[] = []
      const full: string[] = []
      const place = geo(data)
      if (place) {
        short.push(place.short)
        full.push(place.full)
      }
      if (options.age && data.ageMonths !== null) {
        const age = data.ageMonths >= 12 ? t('feature_account_info_age_years', [String(Math.floor(data.ageMonths / 12))]) : t('feature_account_info_age_months', [String(data.ageMonths)])
        short.push(age)
        full.push(age)
      }
      if (options.followers && data.followers !== null) {
        const followers = t('feature_account_info_followers', [compact.format(data.followers)])
        short.push(followers)
        full.push(followers)
      }
      return { text: short.join(' · '), title: full.join(' · ') }
    }

    const refresh = (pk: string) => {
      const { text, title } = describe(pk)
      for (const badge of badges.get(pk) ?? []) {
        badge.textContent = text
        badge.title = title
        badge.setAttribute('aria-label', title)
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
