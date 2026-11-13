export const THREADS_MATCHES = [
  'https://www.threads.com/*',
  'https://threads.com/*',
  'https://www.threads.net/*',
  'https://threads.net/*',
]

export const POSTS_EVENT = 'refined-threads:posts'
export const USERS_EVENT = 'refined-threads:users'

export interface SeenUser { pk: string, followers: number }

export const ABOUT_REQUEST_EVENT = 'refined-threads:about-request'
export const ABOUT_RESULT_EVENT = 'refined-threads:about-result'

export const PROFILE_REQUEST_EVENT = 'refined-threads:profile-request'
export const PROFILE_RESULT_EVENT = 'refined-threads:profile-result'

export interface LookupFailure {
  pk: string
  ok: false
  reason: 'no-session' | 'http' | 'network' | 'parse'
  status: number | null
  retryAfterMs: number | null
}

export interface ProfileRequest { pk: string, username: string }

export type ProfileResult = { pk: string, ok: true, description: string | null } | LookupFailure

export interface AboutRequest { pk: string }

export type AboutResult
  = | { pk: string, ok: true, country: string | null, countryVisible: boolean, joined: string | null }
    | LookupFailure
