import {
  ABOUT_REQUEST_EVENT,
  ABOUT_RESULT_EVENT,
  type AboutResult,
  PROFILE_REQUEST_EVENT,
  PROFILE_RESULT_EVENT,
  type ProfileResult,
} from '../bridge'
import { ageInMonths, CountryNames, parseJoined, parseProfileCounts, type YearMonth } from './normalize'

export type ProfileData = { country: string | null; ageMonths: number | null; followers: number | null; posts: number | null }

type Entry = {
  about?: { country: string | null; joined: YearMonth | null; at: number }
  profile?: { followers: number | null; posts: number | null; at: number }
  aboutFailedAt?: number
  profileFailedAt?: number
}

export type Cache = Record<string, Entry>

export type CacheStore = { get: () => Promise<Cache>; set: (cache: Cache) => Promise<void> }

type Kind = 'about' | 'profile'

type Clock = { now: () => number; wait: (ms: number) => Promise<void> }

const DAY = 86_400_000
const TTL: Record<Kind, number> = { about: 30 * DAY, profile: 7 * DAY }
const RETRY_FAILED = DAY
const GAP: Record<Kind, number> = { about: 1500, profile: 2000 }
const RESULT_TIMEOUT = 15_000
const BACKOFF_START = 30_000
const BACKOFF_MAX = 300_000
const MAX_QUEUE = 200
const MAX_ENTRIES = 5000
const SAVE_DELAY = 2000

const EVENTS: Record<Kind, { request: string; result: string }> = {
  about: { request: ABOUT_REQUEST_EVENT, result: ABOUT_RESULT_EVENT },
  profile: { request: PROFILE_REQUEST_EVENT, result: PROFILE_RESULT_EVENT },
}

const realClock: Clock = { now: () => Date.now(), wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)) }

export class ProfileLookups {
  #cache: Cache = {}
  #queues: Record<Kind, Map<string, string>> = { about: new Map(), profile: new Map() }
  #running: Record<Kind, boolean> = { about: false, profile: false }
  #backoff: Record<Kind, number> = { about: 0, profile: 0 }
  #pending = new Map<string, (result: AboutResult | ProfileResult | null) => void>()
  #names: CountryNames
  #saveTimer: ReturnType<typeof setTimeout> | null = null

  constructor(
    private readonly win: Window,
    private readonly store: CacheStore,
    private readonly languages: readonly string[],
    private readonly onChange: (pk: string) => void,
    private readonly clock: Clock = realClock,
  ) {
    this.#names = new CountryNames(languages)
    for (const kind of ['about', 'profile'] as const) {
      win.addEventListener(EVENTS[kind].result, (event) => {
        let result: AboutResult | ProfileResult
        try {
          result = JSON.parse(String((event as CustomEvent).detail))
        } catch {
          return
        }
        this.#pending.get(`${kind}:${result.pk}`)?.(result)
      })
    }
  }

  async load(): Promise<void> {
    this.#cache = { ...(await this.store.get()), ...this.#cache }
  }

  data(pk: string): ProfileData {
    const entry = this.#cache[pk]
    const joined = entry?.about?.joined
    return {
      country: entry?.about?.country ?? null,
      ageMonths: joined ? ageInMonths(joined, new Date(this.clock.now())) : null,
      followers: entry?.profile?.followers ?? null,
      posts: entry?.profile?.posts ?? null,
    }
  }

  want(pk: string, username: string, needs: { about: boolean; profile: boolean }): void {
    for (const kind of ['about', 'profile'] as const) {
      if (!needs[kind] || this.#fresh(pk, kind)) continue
      const queue = this.#queues[kind]
      queue.delete(pk)
      queue.set(pk, username)
      if (queue.size > MAX_QUEUE) queue.delete(queue.keys().next().value!)
      void this.#pump(kind)
    }
  }

  #fresh(pk: string, kind: Kind): boolean {
    const entry = this.#cache[pk]
    const now = this.clock.now()
    const at = entry?.[kind]?.at
    const failedAt = kind === 'about' ? entry?.aboutFailedAt : entry?.profileFailedAt
    return (at !== undefined && now - at < TTL[kind]) || (failedAt !== undefined && now - failedAt < RETRY_FAILED)
  }

  async #pump(kind: Kind): Promise<void> {
    if (this.#running[kind]) return
    this.#running[kind] = true
    try {
      const queue = this.#queues[kind]
      while (queue.size > 0) {
        const [pk, username] = [...queue.entries()].at(-1)!
        queue.delete(pk)
        if (this.#fresh(pk, kind)) continue
        const result = await this.#request(kind, pk, username)
        const retryAfter = this.#store(kind, pk, username, result)
        await this.clock.wait(retryAfter ?? GAP[kind])
      }
    } finally {
      this.#running[kind] = false
    }
  }

  #request(kind: Kind, pk: string, username: string): Promise<AboutResult | ProfileResult | null> {
    return new Promise((resolve) => {
      const key = `${kind}:${pk}`
      const timer = setTimeout(() => done(null), RESULT_TIMEOUT)
      const done = (result: AboutResult | ProfileResult | null) => {
        clearTimeout(timer)
        this.#pending.delete(key)
        resolve(result)
      }
      this.#pending.set(key, done)
      const detail = JSON.stringify(kind === 'about' ? { pk } : { pk, username })
      this.win.dispatchEvent(new CustomEvent(EVENTS[kind].request, { detail }))
    })
  }

  #store(kind: Kind, pk: string, username: string, result: AboutResult | ProfileResult | null): number | null {
    const now = this.clock.now()
    const entry = (this.#cache[pk] ??= {})
    if (result?.ok) {
      this.#backoff[kind] = 0
      if (kind === 'about' && 'country' in result) {
        entry.about = {
          country: result.countryVisible && result.country ? this.#names.code(result.country) : null,
          joined: result.joined ? parseJoined(result.joined, this.languages) : null,
          at: now,
        }
      }
      if (kind === 'profile' && 'description' in result) {
        entry.profile = { ...(result.description ? parseProfileCounts(result.description) : { followers: null, posts: null }), at: now }
      }
      this.#scheduleSave()
      this.onChange(pk)
      return null
    }
    if (result?.status === 429) {
      this.#backoff[kind] = Math.min(BACKOFF_MAX, this.#backoff[kind] ? this.#backoff[kind] * 2 : BACKOFF_START)
      if (!this.#queues[kind].has(pk)) this.#queues[kind].set(pk, username)
      return Math.min(BACKOFF_MAX, Math.max(result.retryAfterMs ?? 0, this.#backoff[kind]))
    }
    if (kind === 'about') entry.aboutFailedAt = now
    else entry.profileFailedAt = now
    this.#scheduleSave()
    return null
  }

  #scheduleSave(): void {
    if (this.#saveTimer !== null) return
    this.#saveTimer = setTimeout(() => {
      this.#saveTimer = null
      const entries = Object.entries(this.#cache)
      if (entries.length > MAX_ENTRIES) {
        const stamp = ([, entry]: [string, Entry]) => Math.max(entry.about?.at ?? 0, entry.profile?.at ?? 0, entry.aboutFailedAt ?? 0, entry.profileFailedAt ?? 0)
        this.#cache = Object.fromEntries(entries.sort((a, b) => stamp(b) - stamp(a)).slice(0, MAX_ENTRIES))
      }
      void this.store.set(this.#cache)
    }, SAVE_DELAY)
  }
}
