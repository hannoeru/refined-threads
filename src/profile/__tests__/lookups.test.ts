// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ABOUT_REQUEST_EVENT, ABOUT_RESULT_EVENT, PROFILE_REQUEST_EVENT, PROFILE_RESULT_EVENT } from '../../bridge'
import { type Cache, ProfileLookups } from '../lookups'

const NOW = Date.UTC(2026, 10, 12)

function setup(respond: { about?: (pk: string) => object; profile?: (pk: string) => object } = {}, doc?: Document) {
  const win = Object.assign(new EventTarget(), doc ? { document: doc } : {}) as Window
  const requests: string[] = []
  const waits: number[] = []
  const changed: string[] = []
  let saved: Cache | null = null
  const reply = (requestEvent: string, resultEvent: string, make?: (pk: string) => object) =>
    win.addEventListener(requestEvent, (event) => {
      const { pk } = JSON.parse(String((event as CustomEvent).detail))
      requests.push(`${requestEvent.split(':')[1]}:${pk}`)
      if (make) queueMicrotask(() => win.dispatchEvent(new CustomEvent(resultEvent, { detail: JSON.stringify({ pk, ...make(pk) }) })))
    })
  reply(ABOUT_REQUEST_EVENT, ABOUT_RESULT_EVENT, respond.about)
  reply(PROFILE_REQUEST_EVENT, PROFILE_RESULT_EVENT, respond.profile)
  const lookups = new ProfileLookups(
    win,
    { get: async () => ({}), set: async (cache) => void (saved = cache) },
    ['ja'],
    (pk) => changed.push(pk),
    { now: () => NOW, wait: async (ms) => void waits.push(ms) },
  )
  return { lookups, requests, waits, changed, saved: () => saved }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

afterEach(() => vi.useRealTimers())

describe('ProfileLookups', () => {
  it('fetches country and join date, converts them, and reports the change', async () => {
    const { lookups, changed } = setup({ about: () => ({ ok: true, country: '日本', countryVisible: true, joined: '2023年7月 · 1億人以上' }) })
    lookups.want('7', 'amy', { about: true, profile: false })
    await settle()
    expect(changed).toEqual(['7'])
    expect(lookups.data('7')).toEqual({ country: 'JP', countryName: '日本', countryHidden: false, ageMonths: 40, followers: null, posts: null })
  })

  it('treats a hidden country as unknown', async () => {
    const { lookups } = setup({ about: () => ({ ok: true, country: '日本', countryVisible: false, joined: null }) })
    lookups.want('7', 'amy', { about: true, profile: false })
    await settle()
    expect(lookups.data('7')).toMatchObject({ country: null, countryName: null, countryHidden: true })
  })

  it('fetches follower and post counts from the profile description', async () => {
    const { lookups } = setup({ profile: () => ({ ok: true, description: 'フォロワー100人・スレッド4,515 件・bio' }) })
    lookups.want('7', 'amy', { about: false, profile: true })
    await settle()
    expect(lookups.data('7')).toMatchObject({ followers: 100, posts: 4515 })
  })

  it('asks only for what the rules need, once per account, newest first, with a gap between requests', async () => {
    const ok = () => ({ ok: true, country: null, countryVisible: true, joined: null })
    const { lookups, requests, waits } = setup({ about: ok })
    lookups.want('1', 'a', { about: true, profile: false })
    lookups.want('2', 'b', { about: true, profile: false })
    lookups.want('3', 'c', { about: true, profile: false })
    lookups.want('3', 'c', { about: true, profile: false })
    await settle()
    expect(requests).toEqual(['about-request:3', 'about-request:2', 'about-request:1'])
    expect(waits).toEqual([1500, 1500, 1500])
    lookups.want('1', 'a', { about: true, profile: false })
    await settle()
    expect(requests).toHaveLength(3)
  })

  it('backs off after a rate limit and retries the same account', async () => {
    let calls = 0
    const { lookups, requests, waits } = setup({
      about: () => (++calls === 1 ? { ok: false, reason: 'http', status: 429, retryAfterMs: null } : { ok: true, country: '日本', countryVisible: true, joined: null }),
    })
    lookups.want('9', 'z', { about: true, profile: false })
    await settle()
    await settle()
    expect(requests).toEqual(['about-request:9', 'about-request:9'])
    expect(waits[0]).toBe(30_000)
    expect(lookups.data('9').country).toBe('JP')
  })

  it('does not retry a failed account for a day', async () => {
    const { lookups, requests } = setup({ about: () => ({ ok: false, reason: 'http', status: 500, retryAfterMs: null }) })
    lookups.want('5', 'q', { about: true, profile: false })
    await settle()
    lookups.want('5', 'q', { about: true, profile: false })
    await settle()
    expect(requests).toEqual(['about-request:5'])
  })

  it('saves the cache to storage after results arrive', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] })
    const { lookups, saved } = setup({ about: () => ({ ok: true, country: '日本', countryVisible: true, joined: null }) })
    lookups.want('7', 'amy', { about: true, profile: false })
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(2000)
    expect(saved()?.['7']?.about?.country).toBe('JP')
  })

  it('retries after the page session is ready, without marking the account as failed', async () => {
    let calls = 0
    const { lookups, requests, waits } = setup({
      about: () => (++calls === 1 ? { ok: false, reason: 'no-session', status: null, retryAfterMs: null } : { ok: true, country: '日本', countryVisible: true, joined: null }),
    })
    lookups.want('4', 'w', { about: true, profile: false })
    await settle()
    await settle()
    expect(requests).toEqual(['about-request:4', 'about-request:4'])
    expect(waits[0]).toBe(5000)
    expect(lookups.data('4').country).toBe('JP')
  })

  it('waits while the tab is hidden, and continues when it is shown', async () => {
    let hidden = true
    const doc = Object.assign(new EventTarget(), { get hidden() { return hidden } }) as unknown as Document
    const { lookups, requests } = setup({ about: () => ({ ok: true, country: null, countryVisible: true, joined: null }) }, doc)
    lookups.want('6', 'h', { about: true, profile: false })
    await settle()
    expect(requests).toEqual([])
    hidden = false
    doc.dispatchEvent(new Event('visibilitychange'))
    await settle()
    expect(requests).toEqual(['about-request:6'])
  })
})
