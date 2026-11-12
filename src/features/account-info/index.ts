import type { ProfileData } from '../../profile/lookups'
import { authorHeaderOf, nameSlotOf, POST_CONTAINER, postCodeOf, THREADS_THEME } from '../../threads/dom'
import { defineFeature } from '../api'

const BADGE = 'rt-account-info'

const STYLE = `
.${BADGE} { display: flex; align-items: center; min-width: 0; overflow: hidden; font-size: 11px; line-height: 14px; font-weight: 400;
  color: ${THREADS_THEME.secondary}; white-space: nowrap; }
.${BADGE}[hidden] { display: none; }
.${BADGE}.rt-ai-line { grid-column: 1 / -1; margin: 1px 0 3px; }
.${BADGE}.rt-ai-inline { display: inline-flex; flex: 0 1 auto; margin-inline-start: 6px; }
.${BADGE} > span { flex: none; }
.${BADGE} > span + span::before { content: "·"; margin: 0 4px; }
.${BADGE} > .rt-ai-hidden { font-style: italic; }
.${BADGE} > .rt-ai-follows-you, .${BADGE} > .rt-ai-you-follow { font-weight: 600; }
`

const flag = (code: string) => String.fromCodePoint(...[...code].map((letter) => 0x1f1a5 + letter.charCodeAt(0)))

type Item = { kind: string; text: string; title: string }

export default defineFeature({
  id: 'account-info',
  enabledByDefault: false,
  options: {
    followsYou: { type: 'boolean', default: true },
    youFollow: { type: 'boolean', default: false },
    flag: { type: 'boolean', default: true },
    countryName: { type: 'boolean', default: false },
    age: { type: 'boolean', default: true },
    followers: { type: 'boolean', default: false },
    posts: { type: 'boolean', default: false },
  },
  init(ctx) {
    const { options, lookups, t } = ctx
    const showsPlace = options.flag || options.countryName
    const needs = { about: showsPlace || options.age, profile: options.followers || options.posts }
    const language = t('@@ui_locale').replace('_', '-') || undefined
    const compact = new Intl.NumberFormat(language, { notation: 'compact' })
    const regions = new Intl.DisplayNames(language ? [language] : [], { type: 'region' })
    const badges = new Map<string, Set<HTMLElement>>()
    const relations = new Map<string, { followedBy: boolean; following: boolean }>()

    ctx.addStyle(STYLE)

    const place = (data: ProfileData): Item[] => {
      if (!showsPlace) return []
      if (data.countryHidden) {
        const hidden = t('feature_account_info_location_hidden')
        return [{ kind: 'hidden', text: options.countryName ? `🏴 ${hidden}` : '🏴', title: hidden }]
      }
      const name = data.country ? (regions.of(data.country) ?? data.country) : data.countryName
      if (!name) return []
      const title = t('feature_account_info_based_in', [name])
      const items: Item[] = []
      if (options.flag && data.country) items.push({ kind: 'flag', text: flag(data.country), title })
      if (options.countryName || items.length === 0) items.push({ kind: 'country', text: name, title })
      return items
    }

    const relation = (pk: string): Item[] => {
      const { followedBy = false, following = false } = relations.get(pk) ?? {}
      const result: Item[] = []
      if (options.followsYou && followedBy) {
        const text = t('feature_account_info_follows_you')
        result.push({ kind: 'follows-you', text, title: text })
      }
      if (options.youFollow && following) {
        const text = t('feature_account_info_you_follow')
        result.push({ kind: 'you-follow', text, title: text })
      }
      return result
    }

    const items = (pk: string): Item[] => {
      const data = lookups.data(pk)
      const result = [...relation(pk), ...place(data)]
      if (options.age && data.ageMonths !== null) {
        const years = Math.floor(data.ageMonths / 12)
        const text = years >= 1 ? t('feature_account_info_age_years', [String(years)]) : t('feature_account_info_age_months', [String(data.ageMonths)])
        result.push({ kind: 'age', text, title: t('feature_account_info_age_title', [text]) })
      }
      if (options.followers && data.followers !== null) {
        const text = t('feature_account_info_followers', [compact.format(data.followers)])
        result.push({ kind: 'followers', text, title: text })
      }
      if (options.posts && data.posts !== null) {
        const text = t('feature_account_info_posts', [compact.format(data.posts)])
        result.push({ kind: 'posts', text, title: text })
      }
      return result
    }

    const refresh = (pk: string) => {
      const list = items(pk)
      for (const badge of badges.get(pk) ?? []) {
        badge.replaceChildren(
          ...list.map((item) => {
            const span = ctx.document.createElement('span')
            span.className = `rt-ai-${item.kind}`
            span.textContent = item.text
            span.title = item.title
            return span
          }),
        )
        badge.setAttribute('aria-label', list.map((item) => item.title).join(', '))
        badge.hidden = list.length === 0
      }
    }

    const attach = (container: HTMLElement) => {
      const code = postCodeOf(container)
      const post = code ? ctx.posts.get(code) : undefined
      if (!post) return
      if (container.querySelector(`.${BADGE}`)) return
      const header = authorHeaderOf(container, post.author.username)
      const slot = header ? null : nameSlotOf(container, post.author.username)
      if (!header && !slot) return
      const badge = ctx.document.createElement('span')
      badge.className = `${BADGE} ${header ? 'rt-ai-line' : 'rt-ai-inline'}`
      badge.setAttribute('role', 'note')
      if (header) header.append(badge)
      else slot!.after(badge)
      relations.set(post.author.pk, { followedBy: post.author.followedBy, following: post.author.following })
      const set = badges.get(post.author.pk) ?? new Set()
      set.add(badge)
      badges.set(post.author.pk, set)
      refresh(post.author.pk)
      if (needs.about || needs.profile) ctx.whenVisible(container, () => lookups.want(post.author.pk, post.author.username, needs))
    }

    ctx.observe<HTMLElement>(POST_CONTAINER, attach)
    ctx.posts.subscribe(() => ctx.document.querySelectorAll<HTMLElement>(POST_CONTAINER).forEach(attach), ctx.signal)
    lookups.subscribe(refresh, ctx.signal)
    ctx.signal.addEventListener('abort', () => ctx.document.querySelectorAll(`.${BADGE}`).forEach((badge) => badge.remove()), { once: true })
  },
})
