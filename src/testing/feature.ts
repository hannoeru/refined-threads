import type { Post } from '../model'
import type { ProfileData } from '../profile/lookups'
import type { AccountLookups } from '../features/api'
import { PostCatalog } from '../features/services/posts'

export const MESSAGES: Record<string, string> = {
  '@@ui_locale': 'en',
  bar_hidden: 'Hidden: $1',
  bar_tagged: 'Tagged: $1',
  bar_show: 'Show',
  bar_not_spam: 'Not spam',
  bar_keep_hiding: 'Keep hiding',
  rule_affiliate_links: 'affiliate links',
  reason_affiliate_links: 'affiliate link',
  feature_account_info_age_years: '$1y',
  feature_account_info_age_months: '$1mo',
  feature_account_info_age_title: 'On Threads for $1',
  feature_account_info_followers: '$1 followers',
  feature_account_info_posts: '$1 posts',
  feature_account_info_based_in: 'Based in $1',
  feature_account_info_location_hidden: 'Location hidden',
}

export const translate = (key: string, subs: string[] = []) => (MESSAGES[key] ?? '').replace('$1', subs[0] ?? '')

export function fakeLookups(profile: Partial<ProfileData> = {}) {
  const wanted: string[] = []
  const listeners = new Set<(pk: string) => void>()
  const data: Record<string, Partial<ProfileData>> = {}
  const lookups: AccountLookups = {
    data: (pk) => ({ country: null, countryName: null, countryHidden: false, ageMonths: null, followers: null, posts: null, ...profile, ...data[pk] }),
    want: (pk) => void wanted.push(pk),
    subscribe: (listener, signal) => {
      listeners.add(listener)
      signal.addEventListener('abort', () => listeners.delete(listener))
    },
  }
  const resolve = (pk: string, value: Partial<ProfileData>) => {
    data[pk] = value
    for (const listener of listeners) listener(pk)
  }
  return { lookups, wanted, resolve }
}

export function postContainer(code: string, username = 'amy', datetime = '2026-01-01T10:00:00.000Z') {
  return `
  <div data-pressable-container="true" id="c-${code}">
    <a href="/@${username}"><img alt=""></a>
    <div class="row">
      <div class="name"><span><a href="/@${username}"><span>${username}</span></a></span></div>
      <span><a href="/@${username}/post/${code}"><time datetime="${datetime}">1h</time></a></span>
    </div>
    <p>body</p>
  </div>`
}

export const catalogWith = (posts: Post[]) => {
  const catalog = new PostCatalog(new EventTarget() as Window)
  catalog.add(posts)
  return catalog
}
