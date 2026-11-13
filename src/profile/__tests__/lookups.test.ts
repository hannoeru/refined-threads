import type { Cache, CacheStore, LookupWindow } from '../lookups'
// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ABOUT_REQUEST_EVENT, ABOUT_RESULT_EVENT, PROFILE_REQUEST_EVENT, PROFILE_RESULT_EVENT } from '../../bridge'
import { ProfileLookups } from '../lookups'

const NOW = Date.UTC(2026, 10, 12)

function setup(respond: { about?: (pk: string) => object, profile?: (pk: string) => object } = {}, doc?: LookupWindow['document'], store?: CacheStore, pause?: () => Promise<void>) {
  const win: LookupWindow = Object.assign(new EventTarget(), doc
    ? { document: doc }
    : {})
  let now = NOW
  const requests: string[] = []
  const waits: number[] = []
  const changed: string[] = []
  let saved: Cache | null = null
  const reply = (requestEvent: string, resultEvent: string, make?: (pk: string) => object) =>
    win.addEventListener(requestEvent, (event) => {
      const { pk } = JSON.parse(String((event as CustomEvent).detail))
      requests.push(`${requestEvent.split(':')[1]}:${pk}`)
      if (make) {
        queueMicrotask(() => win.dispatchEvent(new CustomEvent(resultEvent, {
          detail: JSON.stringify({
            pk,
            ...make(pk),
          }),
        })))
      }
    })
  reply(ABOUT_REQUEST_EVENT, ABOUT_RESULT_EVENT, respond.about)
  reply(PROFILE_REQUEST_EVENT, PROFILE_RESULT_EVENT, respond.profile)
  const lookups = new ProfileLookups(
    win,
    store ?? {
      get: async () => ({}),
      set: async cache => void (saved = cache),
    },
    ['ja'],
    pk => changed.push(pk),
    {
      now: () => now,
      wait: async (ms) => {
        waits.push(ms)
        await pause?.()
      },
    },
  )
  return {
    lookups,
    requests,
    waits,
    changed,
    saved: () => saved,
    tick: (ms: number) => void (now += ms),
  }
}

const settle = () => new Promise(resolve => setTimeout(resolve, 0))
const live = new AbortController().signal

afterEach(() => vi.useRealTimers())

describe('profileLookups', () => {
  it('fetches country and join date, converts them, and reports the change', async () => {
    const { lookups, changed } = setup({
      about: () => ({
        ok: true,
        country: '日本',
        countryVisible: true,
        joined: '2023年7月 · 1億人以上',
      }),
    })
    lookups.want('7', 'amy', { about: true, followers: false, posts: false }, live)
    await settle()
    expect(changed).toEqual(['7'])
    expect(lookups.data('7')).toEqual({
      country: 'JP',
      countryName: '日本',
      countryHidden: false,
      ageMonths: 40,
      followers: null,
      posts: null,
    })
  })

  it('treats a hidden country as unknown', async () => {
    const { lookups } = setup({
      about: () => ({
        ok: true,
        country: '日本',
        countryVisible: false,
        joined: null,
      }),
    })
    lookups.want('7', 'amy', { about: true, followers: false, posts: false }, live)
    await settle()
    expect(lookups.data('7')).toMatchObject({ country: null, countryName: null, countryHidden: true })
  })

  it('fetches follower and post counts from the profile description', async () => {
    const { lookups } = setup({
      profile: () => ({ ok: true, description: 'フォロワー100人・スレッド4,515 件・bio' }),
    })
    lookups.want('7', 'amy', { about: false, followers: true, posts: true }, live)
    await settle()
    expect(lookups.data('7')).toMatchObject({ followers: 100, posts: 4515 })
  })

  it('asks only for what the rules need, once per account, newest first, with a gap between requests', async () => {
    const ok = () => ({
      ok: true,
      country: null,
      countryVisible: true,
      joined: null,
    })
    const { lookups, requests, waits } = setup({ about: ok })
    lookups.want('1', 'a', { about: true, followers: false, posts: false }, live)
    lookups.want('2', 'b', { about: true, followers: false, posts: false }, live)
    lookups.want('3', 'c', { about: true, followers: false, posts: false }, live)
    lookups.want('3', 'c', { about: true, followers: false, posts: false }, live)
    await settle()
    expect(requests).toEqual(['about-request:3', 'about-request:2', 'about-request:1'])
    expect(waits).toEqual([1500, 1500, 1500])
    lookups.want('1', 'a', { about: true, followers: false, posts: false }, live)
    await settle()
    expect(requests).toHaveLength(3)
  })

  it('backs off after a rate limit and retries the same account', async () => {
    let calls = 0
    const { lookups, requests, waits } = setup({
      about: () => (++calls === 1
        ? {
            ok: false,
            reason: 'http',
            status: 429,
            retryAfterMs: null,
          }
        : {
            ok: true,
            country: '日本',
            countryVisible: true,
            joined: null,
          }),
    })
    lookups.want('9', 'z', { about: true, followers: false, posts: false }, live)
    await settle()
    await settle()
    expect(requests).toEqual(['about-request:9', 'about-request:9'])
    expect(waits[0]).toBe(30_000)
    expect(lookups.data('9').country).toBe('JP')
  })

  it('does not retry a failed account for a day', async () => {
    const { lookups, requests } = setup({
      about: () => ({
        ok: false,
        reason: 'http',
        status: 500,
        retryAfterMs: null,
      }),
    })
    lookups.want('5', 'q', { about: true, followers: false, posts: false }, live)
    await settle()
    lookups.want('5', 'q', { about: true, followers: false, posts: false }, live)
    await settle()
    expect(requests).toEqual(['about-request:5'])
  })

  it('saves the cache to storage after results arrive', async () => {
    vi.useFakeTimers({
      toFake: ['setTimeout'],
    })
    const { lookups, saved } = setup({
      about: () => ({
        ok: true,
        country: '日本',
        countryVisible: true,
        joined: null,
      }),
    })
    lookups.want('7', 'amy', { about: true, followers: false, posts: false }, live)
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(2000)
    expect(saved()?.['7']?.about?.country).toBe('JP')
  })

  it('retries after the page session is ready, without marking the account as failed', async () => {
    let calls = 0
    const { lookups, requests, waits } = setup({
      about: () => (++calls === 1
        ? {
            ok: false,
            reason: 'no-session',
            status: null,
            retryAfterMs: null,
          }
        : {
            ok: true,
            country: '日本',
            countryVisible: true,
            joined: null,
          }),
    })
    lookups.want('4', 'w', { about: true, followers: false, posts: false }, live)
    await settle()
    await settle()
    expect(requests).toEqual(['about-request:4', 'about-request:4'])
    expect(waits[0]).toBe(5000)
    expect(lookups.data('4').country).toBe('JP')
  })

  it('waits while the tab is hidden, and continues when it is shown', async () => {
    let hidden = true
    const doc = new (class extends EventTarget {
      get hidden() {
        return hidden
      }
    })()
    const { lookups, requests } = setup({
      about: () => ({
        ok: true,
        country: null,
        countryVisible: true,
        joined: null,
      }),
    }, doc)
    lookups.want('6', 'h', { about: true, followers: false, posts: false }, live)
    await settle()
    expect(requests).toEqual([])
    hidden = false
    doc.dispatchEvent(new Event('visibilitychange'))
    await settle()
    expect(requests).toEqual(['about-request:6'])
  })

  it('reports an account as loading while it waits or is in flight, and not after it fails', async () => {
    const { lookups, changed } = setup({
      about: () => ({
        ok: false,
        reason: 'http',
        status: 500,
        retryAfterMs: null,
      }),
    })
    lookups.want('8', 'l', { about: true, followers: false, posts: false }, live)
    expect(lookups.loading('8')).toBe(true)
    await settle()
    expect(lookups.loading('8')).toBe(false)
    expect(changed).toEqual(['8'])
  })

  describe('follower counts seen in Threads responses', () => {
    const followersOnly = { about: false, followers: true, posts: false }
    const counts = () => ({ ok: true, description: 'フォロワー100人・スレッド4,515 件' })

    it('uses a seen follower count and makes no profile request', async () => {
      const { lookups, requests, changed } = setup({ profile: counts })
      lookups.seen([
        { pk: '11', followers: 1269 },
      ])
      lookups.want('11', 'amy', followersOnly, live)
      await settle()
      expect(requests).toEqual([])
      expect(changed).toEqual(['11'])
      expect(lookups.data('11').followers).toBe(1269)
      expect(lookups.loading('11')).toBe(false)
    })

    it('still loads the profile page when the post count is needed', async () => {
      const { lookups, requests } = setup({ profile: counts })
      lookups.seen([
        { pk: '12', followers: 1269 },
      ])
      lookups.want('12', 'amy', { about: false, followers: true, posts: true }, live)
      await settle()
      expect(requests).toEqual(['profile-request:12'])
      expect(lookups.data('12')).toMatchObject({ posts: 4515 })
    })

    it('drops a waiting follower-only lookup when the count is seen first', async () => {
      const { lookups, requests } = setup({ profile: counts })
      lookups.want('13', 'a', followersOnly, live)
      lookups.want('14', 'b', followersOnly, live)
      lookups.seen([
        { pk: '13', followers: 5 },
      ])
      await settle()
      expect(requests).toEqual(['profile-request:14'])
      expect(lookups.data('13').followers).toBe(5)
    })

    it('shows the newer of the profile count and the seen count', async () => {
      const { lookups, tick } = setup({ profile: counts })
      lookups.want('15', 'c', followersOnly, live)
      await settle()
      expect(lookups.data('15').followers).toBe(100)
      tick(1000)
      lookups.seen([
        { pk: '15', followers: 120 },
      ])
      expect(lookups.data('15').followers).toBe(120)
    })
  })

  describe('when the user turns a feature off', () => {
    it('drops the account lookups that only that feature asked for', async () => {
      const { lookups, requests, changed } = setup({
        about: () => ({
          ok: true,
          country: null,
          countryVisible: true,
          joined: null,
        }),
      })
      const feature = new AbortController()
      for (const pk of ['1', '2', '3']) lookups.want(pk, `u${pk}`, { about: true, followers: false, posts: false }, feature.signal)
      feature.abort()
      await settle()
      expect(requests).toEqual([])
      expect(['1', '2', '3'].map(pk => lookups.loading(pk))).toEqual([false, false, false])
      expect(changed).toEqual(['1', '2', '3'])
    })

    it('keeps an account lookup that another running feature still needs', async () => {
      const { lookups, requests } = setup({
        about: () => ({
          ok: true,
          country: null,
          countryVisible: true,
          joined: null,
        }),
      })
      const first = new AbortController()
      lookups.want('1', 'a', { about: true, followers: false, posts: false }, first.signal)
      lookups.want('2', 'b', { about: true, followers: false, posts: false }, first.signal)
      lookups.want('1', 'a', { about: true, followers: false, posts: false }, live)
      first.abort()
      await settle()
      await settle()
      expect(requests).toEqual(['about-request:1'])
    })
  })

  it('stops showing loading and backs off while Threads has no session, then recovers', async () => {
    let session = false
    let release = () => {}
    const step = async () => {
      release()
      await settle()
    }
    const { lookups, requests, waits, changed } = setup({
      about: () => (session
        ? {
            ok: true,
            country: '日本',
            countryVisible: true,
            joined: null,
          }
        : {
            ok: false,
            reason: 'no-session',
            status: null,
            retryAfterMs: null,
          }),
    }, undefined, undefined, () => new Promise(resolve => (release = resolve)))
    lookups.want('1', 'a', { about: true, followers: false, posts: false }, live)
    lookups.want('2', 'b', { about: true, followers: false, posts: false }, live)
    await settle()
    expect(lookups.loading('1')).toBe(false)
    expect(lookups.loading('2')).toBe(false)
    expect(changed).toEqual(expect.arrayContaining(['1', '2']))
    await step()
    await step()
    expect(waits).toEqual([5000, 10_000, 20_000])
    session = true
    await step()
    await step()
    await step()
    expect(lookups.data('2').country).toBe('JP')
    expect(lookups.data('1').country).toBe('JP')
    expect(requests.at(-1)).toBe('about-request:1')
  })

  it('does not fail when a seen follower count empties the queue while the tab is hidden', async () => {
    let hidden = true
    const doc = new (class extends EventTarget {
      get hidden() {
        return hidden
      }
    })()
    const errors: unknown[] = []
    const onError = (event: PromiseRejectionEvent) => errors.push(event.reason)
    globalThis.addEventListener('unhandledrejection', onError)
    const { lookups, requests } = setup({}, doc)
    lookups.want('1', 'a', { about: false, followers: true, posts: false }, live)
    await settle()
    lookups.seen([
      { pk: '1', followers: 12 },
    ])
    hidden = false
    doc.dispatchEvent(new Event('visibilitychange'))
    await settle()
    await settle()
    globalThis.removeEventListener('unhandledrejection', onError)
    expect(errors).toEqual([])
    expect(requests).toEqual([])
    expect(lookups.data('1').followers).toBe(12)
  })

  it('tells the page when an account drops out of a full queue, so its loading state ends', () => {
    let hidden = true
    const doc = new (class extends EventTarget {
      get hidden() {
        return hidden
      }
    })()
    const { lookups, changed } = setup({}, doc)
    for (let index = 0; index < 201; index++) lookups.want(String(index), `u${index}`, { about: true, followers: false, posts: false }, live)
    expect(changed).toEqual(['0'])
    expect(lookups.loading('0')).toBe(false)
    hidden = false
  })

  describe('the account cache in storage', () => {
    const memoryStore = (initial: Cache) => {
      let stored = structuredClone(initial)
      return {
        get: async () => structuredClone(stored),
        set: async (cache: Cache) => void (stored = structuredClone(cache)),
        read: () => stored,
      }
    }
    const about = {
      ok: true,
      country: '日本',
      countryVisible: true,
      joined: null,
    }

    it('keeps the lookups of two Threads tabs that save one after the other', async () => {
      vi.useFakeTimers({
        toFake: ['setTimeout'],
      })
      const store = memoryStore({})
      const first = setup({
        about: () => about,
      }, undefined, store)
      const second = setup({
        about: () => about,
      }, undefined, store)
      await first.lookups.load()
      await second.lookups.load()
      first.lookups.want('1', 'a', { about: true, followers: false, posts: false }, live)
      second.lookups.want('2', 'b', { about: true, followers: false, posts: false }, live)
      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(2000)
      expect(Object.keys(store.read()).sort()).toEqual(['1', '2'])
    })

    it('keeps stored About data when a follower count arrives before the cache loads', async () => {
      const store = memoryStore({
        9: {
          about: {
            country: 'JP',
            joined: { year: 2023, month: 6 },
            at: NOW,
          },
        },
      })
      const { lookups } = setup({}, undefined, store)
      lookups.seen([
        { pk: '9', followers: 120 },
      ])
      await lookups.load()
      expect(lookups.data('9')).toMatchObject({ country: 'JP', followers: 120 })
      expect(lookups.data('9').ageMonths).not.toBeNull()
    })
  })
})
