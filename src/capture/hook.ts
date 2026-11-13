import type { AboutRequest, AboutResult, LookupFailure, ProfileRequest, ProfileResult } from '../bridge'
import type { Session } from './about'
import type { Capture } from './parse'
import {
  ABOUT_REQUEST_EVENT,
  ABOUT_RESULT_EVENT,

  POSTS_EVENT,
  PROFILE_REQUEST_EVENT,
  PROFILE_RESULT_EVENT,
  USERS_EVENT,

} from '../bridge'
import { buildAboutRequest, findVersioningId, parseAboutResponse, retryAfterMs, sessionFromBody } from './about'
import { parseBootstrap, parsePayloadText } from './parse'
import { readDescription } from './profile'

const SKIPPED_QUERIES = new Set(['useBarcelonaBatchedDynamicPostCountsSubscriptionQuery'])

const isGraphql = (url: string) => url.includes('/graphql')

interface Tracked { url: string, name: string | null }

const tracked = new WeakMap<XMLHttpRequest, Tracked>()

export function installHook(win: Window & typeof globalThis): void {
  const emit = ({ posts, users }: Capture) => {
    if (posts.length > 0) {
      win.dispatchEvent(new win.CustomEvent(POSTS_EVENT, {
        detail: JSON.stringify(posts),
      }))
    }
    if (users.length > 0) {
      win.dispatchEvent(new win.CustomEvent(USERS_EVENT, {
        detail: JSON.stringify(users),
      }))
    }
  }
  const ingest = (text: string) => {
    try {
      emit(parsePayloadText(text))
    }
    catch {

    }
  }

  let session: Session | null = null
  const captureSession = (body: unknown) => {
    if (typeof body !== 'string')
      return
    session = sessionFromBody(body) ?? session
  }

  const proto = win.XMLHttpRequest.prototype
  const { open, setRequestHeader, send } = proto
  proto.open = function (this: XMLHttpRequest, ...args: Parameters<XMLHttpRequest['open']>) {
    tracked.set(this, {
      url: String(args[1]),
      name: null,
    })
    return open.apply(this, args)
  } as XMLHttpRequest['open']
  proto.setRequestHeader = function (this: XMLHttpRequest, name: string, value: string) {
    const state = tracked.get(this)
    if (state && name.toLowerCase() === 'x-fb-friendly-name')
      state.name = value
    return setRequestHeader.call(this, name, value)
  }
  proto.send = function (this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null) {
    const state = tracked.get(this)
    if (state && isGraphql(state.url)) {
      captureSession(body)
      if (!SKIPPED_QUERIES.has(state.name ?? '')) {
        this.addEventListener('load', () => {
          if (this.responseType === '' || this.responseType === 'text')
            ingest(this.responseText)
        })
      }
    }
    return send.call(this, body)
  }

  const fetch = win.fetch
  win.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
    const response = await fetch.call(win, input, init)
    const url = typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input.url
    if (isGraphql(url)) {
      captureSession(init?.body)
      response
        .clone()
        .text()
        .then(ingest)
        .catch(() => undefined)
    }
    return response
  }

  const failure = (pk: string, reason: LookupFailure['reason'], response: Response | null = null): LookupFailure => ({
    pk,
    ok: false,
    reason,
    status: response?.status ?? null,
    retryAfterMs: response
      ? retryAfterMs(response.headers.get('Retry-After'))
      : null,
  })

  const about = async ({ pk }: AboutRequest): Promise<AboutResult> => {
    const versioningId = findVersioningId(win.document)
    if (session === null || versioningId === null)
      return failure(pk, 'no-session')
    const request = buildAboutRequest(win.location.origin, session, versioningId, pk)
    const response = await fetch.call(win, request.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: request.body,
      credentials: 'include',
    })
    return response.ok
      ? parseAboutResponse(pk, await response.text())
      : failure(pk, 'http', response)
  }

  const profile = async ({ pk, username }: ProfileRequest): Promise<ProfileResult> => {
    const response = await fetch.call(win, new URL(`/@${encodeURIComponent(username)}`, win.location.origin), { credentials: 'include' })
    return response.ok
      ? { pk, ok: true, description: await readDescription(response) }
      : failure(pk, 'http', response)
  }

  const serve = <Request extends { pk: string }, Result>(
    requestEvent: string,
    resultEvent: string,
    handle: (request: Request) => Promise<Result>,
  ) =>
    win.addEventListener(requestEvent, (event) => {
      let request: Request
      try {
        request = JSON.parse(String((event as CustomEvent).detail))
      }
      catch {
        return
      }
      void handle(request)
        .catch(() => failure(request.pk, 'network'))
        .then(result => win.dispatchEvent(new win.CustomEvent(resultEvent, {
          detail: JSON.stringify(result),
        })))
    })
  serve(ABOUT_REQUEST_EVENT, ABOUT_RESULT_EVENT, about)
  serve(PROFILE_REQUEST_EVENT, PROFILE_RESULT_EVENT, profile)

  const bootstrap = () => {
    try {
      emit(parseBootstrap(win.document))
    }
    catch {

    }
  }
  if (win.document.readyState === 'loading')
    win.document.addEventListener('DOMContentLoaded', bootstrap, { once: true })
  else bootstrap()
}
