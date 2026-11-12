export const THREADS_MATCHES = [
  'https://www.threads.com/*',
  'https://threads.com/*',
  'https://www.threads.net/*',
  'https://threads.net/*',
]

export const POSTS_EVENT = 'lint-roller:posts'
export const ABOUT_REQUEST_EVENT = 'lint-roller:about-request'
export const ABOUT_RESULT_EVENT = 'lint-roller:about-result'

export const PROFILE_REQUEST_EVENT = 'lint-roller:profile-request'
export const PROFILE_RESULT_EVENT = 'lint-roller:profile-result'

export type LookupFailure = { pk: string; ok: false; status: number | null; retryAfterMs: number | null }

export type ProfileRequest = { pk: string; username: string }

export type ProfileResult = { pk: string; ok: true; description: string | null } | LookupFailure

export type AboutRequest = { pk: string }

export type AboutResult =
  | { pk: string; ok: true; country: string | null; countryVisible: boolean; joined: string | null }
  | LookupFailure
