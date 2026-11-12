import { ABOUT_REQUEST_EVENT, ABOUT_RESULT_EVENT, type AboutRequest, type AboutResult, POSTS_EVENT } from '../bridge'
import type { Post } from '../model'
import { buildAboutRequest, findVersioningId, parseAboutResponse, retryAfterMs, type Session, sessionFromBody } from './about'
import { parseBootstrap, parsePayloadText } from './parse'

const SKIPPED_QUERIES = new Set(['useBarcelonaBatchedDynamicPostCountsSubscriptionQuery'])

const isGraphql = (url: string) => url.includes('/graphql')

type Tracked = { url: string; name: string | null }

const tracked = new WeakMap<XMLHttpRequest, Tracked>()

export function installHook(win: Window & typeof globalThis): void {
  const emit = (posts: Post[]) => {
    if (posts.length > 0) win.dispatchEvent(new win.CustomEvent(POSTS_EVENT, { detail: JSON.stringify(posts) }))
  }
  const ingest = (text: string) => {
    try {
      emit(parsePayloadText(text))
    } catch {
      return
    }
  }

  let session: Session | null = null
  const captureSession = (body: unknown) => {
    if (typeof body !== 'string') return
    session = sessionFromBody(body) ?? session
  }

  const proto = win.XMLHttpRequest.prototype
  const { open, setRequestHeader, send } = proto
  proto.open = function (this: XMLHttpRequest, ...args: Parameters<XMLHttpRequest['open']>) {
    tracked.set(this, { url: String(args[1]), name: null })
    return open.apply(this, args)
  } as XMLHttpRequest['open']
  proto.setRequestHeader = function (this: XMLHttpRequest, name: string, value: string) {
    const state = tracked.get(this)
    if (state && name.toLowerCase() === 'x-fb-friendly-name') state.name = value
    return setRequestHeader.call(this, name, value)
  }
  proto.send = function (this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null) {
    const state = tracked.get(this)
    if (state && isGraphql(state.url)) {
      captureSession(body)
      if (!SKIPPED_QUERIES.has(state.name ?? '')) {
        this.addEventListener('load', () => {
          if (this.responseType === '' || this.responseType === 'text') ingest(this.responseText)
        })
      }
    }
    return send.call(this, body)
  }

  const fetch = win.fetch
  win.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
    const response = await fetch.call(win, input, init)
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
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

  const lookup = async ({ pk }: AboutRequest): Promise<AboutResult> => {
    const versioningId = findVersioningId(win.document)
    if (session === null || versioningId === null) return { pk, ok: false, status: null, retryAfterMs: null }
    try {
      const request = buildAboutRequest(win.location.origin, session, versioningId, pk)
      const response = await fetch.call(win, request.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: request.body,
        credentials: 'include',
      })
      if (!response.ok) {
        return { pk, ok: false, status: response.status, retryAfterMs: retryAfterMs(response.headers.get('Retry-After')) }
      }
      return parseAboutResponse(pk, await response.text())
    } catch {
      return { pk, ok: false, status: null, retryAfterMs: null }
    }
  }
  win.addEventListener(ABOUT_REQUEST_EVENT, (event) => {
    let request: AboutRequest
    try {
      request = JSON.parse(String((event as CustomEvent).detail))
    } catch {
      return
    }
    void lookup(request).then((result) =>
      win.dispatchEvent(new win.CustomEvent(ABOUT_RESULT_EVENT, { detail: JSON.stringify(result) })),
    )
  })

  const bootstrap = () => {
    try {
      emit(parseBootstrap(win.document))
    } catch {
      return
    }
  }
  if (win.document.readyState === 'loading') win.document.addEventListener('DOMContentLoaded', bootstrap, { once: true })
  else bootstrap()
}
