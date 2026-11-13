import type { AboutResult } from '../bridge'
import { stripGuard } from './parse'

export const SESSION_KEYS = [
  'av',
  '__user',
  '__a',
  '__hs',
  'dpr',
  '__ccg',
  '__rev',
  '__s',
  '__hsi',
  '__dyn',
  '__csr',
  '__hsdp',
  '__hblp',
  '__sjsp',
  '__comet_req',
  'fb_dtsg',
  'jazoest',
  'lsd',
  '__spin_r',
  '__spin_b',
  '__spin_t',
  '__jssesw',
  '__crn',
  '__d',
] as const

export type Session = Record<string, string>

export function sessionFromBody(body: string): Session | null {
  const params = new URLSearchParams(body)
  if (!params.get('fb_dtsg'))
    return null
  const session: Session = {}
  for (const key of SESSION_KEYS) {
    const value = params.get(key)
    if (value)
      session[key] = value
  }
  return session
}

export function findVersioningId(doc: Document): string | null {
  for (const script of doc.querySelectorAll('script')) {
    const text = script.textContent ?? ''
    if (!text.includes('WebBloksVersioningID'))
      continue
    const match = text.match(/"versioningID":"([a-f0-9]+)"/)
    if (match?.[1])
      return match[1]
  }
  return null
}

const ABOUT_APP_ID = 'com.bloks.www.text_post_app.about_this_profile_async_action'
const COUNTRY_KEY = 'THREADS_ABOUT_THIS_PROFILE:about_this_profile_country'
const VISIBILITY_KEY = 'THREADS_ABOUT_THIS_PROFILE:about_this_profile_country_visibility'

export function buildAboutRequest(
  origin: string,
  session: Session,
  versioningId: string,
  pk: string,
): { url: string, body: string } {
  const url = new URL('/async/wbloks/fetch/', origin)
  url.searchParams.set('appid', ABOUT_APP_ID)
  url.searchParams.set('type', 'app')
  url.searchParams.set('__bkv', versioningId)
  const body = new URLSearchParams({ __d: 'www', ...session })
  body.set('params', JSON.stringify({
    atpTriggerSessionID: crypto.randomUUID(),
    referer_type: 'TextPostAppProfileOverflow',
    target_user_id: pk,
  }))
  return {
    url: url.toString(),
    body: body.toString(),
  }
}

const JOINED_PATTERN = /(?:19|20)\d{2}/
const DATE_HINT = /[·•年년]|\d{1,2}[/.-]|[A-Z]{3,}/i

function findJoinedText(root: unknown): string | null {
  const queue = [root]
  while (queue.length > 0) {
    const node = queue.shift()
    if (typeof node === 'string') {
      if (node.length < 60 && !node.includes('(@') && JOINED_PATTERN.test(node) && DATE_HINT.test(node))
        return node
      continue
    }
    if (typeof node === 'object' && node !== null)
      queue.push(...Object.values(node))
  }
  return null
}

export function parseAboutResponse(pk: string, text: string): AboutResult {
  let data: unknown
  try {
    data = JSON.parse(stripGuard(text))
  }
  catch {
    return {
      pk,
      ok: false,
      reason: 'parse',
      status: 200,
      retryAfterMs: null,
    }
  }
  const items = (data as { payload?: { layout?: { bloks_payload?: { data?: unknown } } } })?.payload?.layout?.bloks_payload?.data
  if (!Array.isArray(items)) {
    return {
      pk,
      ok: false,
      reason: 'parse',
      status: 200,
      retryAfterMs: null,
    }
  }
  const initial = (key: string): unknown =>
    items.find(item => (item as { data?: { key?: unknown } })?.data?.key === key)?.data?.initial
  const country = initial(COUNTRY_KEY)
  return {
    pk,
    ok: true,
    country: typeof country === 'string' && country
      ? country
      : null,
    countryVisible: initial(VISIBILITY_KEY) !== false,
    joined: findJoinedText(data),
  }
}

export function retryAfterMs(header: string | null): number | null {
  if (!header)
    return null
  const seconds = Number(header)
  if (Number.isFinite(seconds))
    return Math.max(0, seconds * 1000)
  const date = Date.parse(header)
  return Number.isNaN(date)
    ? null
    : Math.max(0, date - Date.now())
}
