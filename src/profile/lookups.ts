import type { AboutResult, ProfileResult, SeenUser } from '../bridge'
import type { YearMonth } from './normalize'
import {
  ABOUT_REQUEST_EVENT,
  ABOUT_RESULT_EVENT,

  PROFILE_REQUEST_EVENT,
  PROFILE_RESULT_EVENT,

  USERS_EVENT,
} from '../bridge'
import { ageInMonths, CountryNames, parseJoined, parseProfileCounts } from './normalize'

export interface LookupWindow extends EventTarget { document?: EventTarget & { hidden: boolean } }

export interface LookupNeeds { about: boolean, followers: boolean, posts: boolean }

export interface ProfileData {
  country: string | null
  countryName: string | null
  countryHidden: boolean
  ageMonths: number | null
  followers: number | null
  posts: number | null
}

interface Entry {
  about?: { country: string | null, countryName?: string | null, countryHidden?: boolean, joined: YearMonth | null, at: number }
  profile?: { followers: number | null, posts: number | null, at: number }
  seen?: { followers: number, at: number }
  aboutFailedAt?: number
  profileFailedAt?: number
}

export type Cache = Record<string, Entry>

function newer<T extends { at: number }>(a: T | undefined, b: T | undefined): T | undefined {
  return !a || (b && b.at >= a.at)
    ? b
    : a
}
function latest(a: number | undefined, b: number | undefined): number | undefined {
  return a === undefined || (b !== undefined && b > a)
    ? b
    : a
}

function mergeEntry(a: Entry, b: Entry): Entry {
  const entry: Entry = {
    about: newer(a.about, b.about),
    profile: newer(a.profile, b.profile),
    seen: newer(a.seen, b.seen),
    aboutFailedAt: latest(a.aboutFailedAt, b.aboutFailedAt),
    profileFailedAt: latest(a.profileFailedAt, b.profileFailedAt),
  }
  return Object.fromEntries(Object.entries(entry).filter(([, value]) => value !== undefined))
}

function mergeCaches(base: Cache, extra: Cache): Cache {
  const merged = { ...base }
  for (const [pk, entry] of Object.entries(extra)) {
    const current = merged[pk]
    merged[pk] = current
      ? mergeEntry(current, entry)
      : entry
  }
  return merged
}

export interface CacheStore { get: () => Promise<Cache>, set: (cache: Cache) => Promise<void> }

type Kind = 'about' | 'profile'

interface Request { username: string, consumers: Set<AbortSignal> }

interface Clock { now: () => number, wait: (ms: number) => Promise<void> }

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
const NO_SESSION_RETRY = 5000
const KINDS = ['about', 'profile'] as const

const EVENTS: Record<Kind, { request: string, result: string }> = {
  about: { request: ABOUT_REQUEST_EVENT, result: ABOUT_RESULT_EVENT },
  profile: { request: PROFILE_REQUEST_EVENT, result: PROFILE_RESULT_EVENT },
}

const realClock: Clock = {
  now: () => Date.now(),
  wait: ms => new Promise(resolve => setTimeout(resolve, ms)),
}

export class ProfileLookups {
  #cache: Cache = {}
  #queues: Record<Kind, Map<string, Request>> = {
    about: new Map(),
    profile: new Map(),
  }

  #running: Record<Kind, boolean> = { about: false, profile: false }
  #backoff: Record<Kind, number> = { about: 0, profile: 0 }
  #sessionRetry: Record<Kind, number> = { about: 0, profile: 0 }
  #tracked = new WeakSet<AbortSignal>()
  #pending = new Map<string, (result: AboutResult | ProfileResult | null) => void>()
  #names: CountryNames
  #saveTimer: ReturnType<typeof setTimeout> | null = null
  #needsPosts = new Set<string>()

  constructor(
    private readonly win: LookupWindow,
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
        }
        catch {
          return
        }
        this.#pending.get(`${kind}:${result.pk}`)?.(result)
      })
    }
    win.addEventListener(USERS_EVENT, (event) => {
      let users: SeenUser[]
      try {
        users = JSON.parse(String((event as CustomEvent).detail))
      }
      catch {
        return
      }
      this.seen(users)
    })
  }

  seen(users: SeenUser[]): void {
    const at = this.clock.now()
    for (const { pk, followers } of users) {
      if (!pk || !Number.isFinite(followers))
        continue
      const entry = (this.#cache[pk] ??= {})
      entry.seen = { followers, at }
      if (!this.#needsPosts.has(pk))
        this.#queues.profile.delete(pk)
      this.onChange(pk)
    }
    if (users.length > 0)
      this.#scheduleSave()
  }

  async load(): Promise<void> {
    this.#cache = mergeCaches(await this.store.get(), this.#cache)
  }

  data(pk: string): ProfileData {
    const entry = this.#cache[pk]
    const joined = entry?.about?.joined
    return {
      country: entry?.about?.country ?? null,
      countryName: entry?.about?.countryName ?? null,
      countryHidden: entry?.about?.countryHidden ?? false,
      ageMonths: joined
        ? ageInMonths(joined, new Date(this.clock.now()))
        : null,
      followers: this.#followers(entry),
      posts: entry?.profile?.posts ?? null,
    }
  }

  loading(pk: string): boolean {
    return KINDS.some(kind => !this.#sessionRetry[kind] && (this.#queues[kind].has(pk) || this.#pending.has(`${kind}:${pk}`)))
  }

  #followers(entry: Entry | undefined): number | null {
    const { profile, seen } = entry ?? {}
    if (seen && (profile?.followers == null || seen.at >= profile.at))
      return seen.followers
    return profile?.followers ?? null
  }

  #seenFresh(pk: string): boolean {
    const at = this.#cache[pk]?.seen?.at
    return at !== undefined && this.clock.now() - at < TTL.profile
  }

  want(pk: string, username: string, needs: LookupNeeds, signal: AbortSignal): void {
    if (signal.aborted)
      return
    this.#track(signal)
    if (needs.posts)
      this.#needsPosts.add(pk)
    const wants: Record<Kind, boolean> = {
      about: needs.about,
      profile: needs.posts || (needs.followers && !this.#seenFresh(pk)),
    }
    for (const kind of KINDS) {
      if (!wants[kind] || this.#fresh(pk, kind))
        continue
      const queue = this.#queues[kind]
      const consumers = queue.get(pk)?.consumers ?? new Set()
      consumers.add(signal)
      queue.delete(pk)
      queue.set(pk, { username, consumers })
      if (queue.size > MAX_QUEUE) {
        const oldest = queue.keys().next().value!
        this.#unqueue(kind, oldest)
        this.onChange(oldest)
      }
      void this.#pump(kind)
    }
  }

  #track(signal: AbortSignal): void {
    if (this.#tracked.has(signal))
      return
    this.#tracked.add(signal)
    signal.addEventListener('abort', () => {
      const dropped = new Set<string>()
      for (const kind of KINDS) {
        for (const [pk, request] of this.#queues[kind]) {
          request.consumers.delete(signal)
          if (request.consumers.size === 0) {
            this.#unqueue(kind, pk)
            dropped.add(pk)
          }
        }
      }
      dropped.forEach(pk => this.onChange(pk))
    }, { once: true })
  }

  #unqueue(kind: Kind, pk: string): void {
    this.#queues[kind].delete(pk)
    if (kind === 'profile')
      this.#needsPosts.delete(pk)
  }

  #fresh(pk: string, kind: Kind): boolean {
    const entry = this.#cache[pk]
    const now = this.clock.now()
    const at = entry?.[kind]?.at
    const failedAt = kind === 'about'
      ? entry?.aboutFailedAt
      : entry?.profileFailedAt
    return (at !== undefined && now - at < TTL[kind]) || (failedAt !== undefined && now - failedAt < RETRY_FAILED)
  }

  async #pump(kind: Kind): Promise<void> {
    if (this.#running[kind])
      return
    this.#running[kind] = true
    try {
      const queue = this.#queues[kind]
      while (queue.size > 0) {
        await this.#whenVisible()
        const next = [...queue].at(-1)
        if (!next)
          continue
        const [pk, request] = next
        queue.delete(pk)
        if (this.#fresh(pk, kind) || (kind === 'profile' && !this.#needsPosts.has(pk) && this.#seenFresh(pk)))
          continue
        const result = await this.#request(kind, pk, request.username)
        const retryAfter = this.#store(kind, pk, request, result)
        await this.clock.wait(retryAfter ?? GAP[kind])
      }
    }
    finally {
      this.#running[kind] = false
    }
  }

  #request(kind: Kind, pk: string, username: string): Promise<AboutResult | ProfileResult | null> {
    return new Promise((resolve) => {
      const key = `${kind}:${pk}`
      let timer: ReturnType<typeof setTimeout> | undefined
      const done = (result: AboutResult | ProfileResult | null) => {
        clearTimeout(timer)
        this.#pending.delete(key)
        resolve(result)
      }
      timer = setTimeout(done, RESULT_TIMEOUT, null)
      this.#pending.set(key, done)
      const detail = JSON.stringify(kind === 'about'
        ? { pk }
        : { pk, username })
      this.win.dispatchEvent(new CustomEvent(EVENTS[kind].request, { detail }))
    })
  }

  #store(kind: Kind, pk: string, request: Request, result: AboutResult | ProfileResult | null): number | null {
    const noSession = result?.ok === false && result.reason === 'no-session'
    if (result && !noSession && this.#sessionRetry[kind]) {
      this.#sessionRetry[kind] = 0
      this.#queues[kind].forEach((_, queued) => this.onChange(queued))
    }
    if (result?.ok) {
      this.#storeSuccess(kind, pk, result)
      return null
    }
    if (noSession) {
      this.#requeue(kind, pk, request)
      const first = !this.#sessionRetry[kind]
      this.#sessionRetry[kind] = first
        ? NO_SESSION_RETRY
        : Math.min(BACKOFF_MAX, this.#sessionRetry[kind] * 2)
      if (first)
        this.#queues[kind].forEach((_, queued) => this.onChange(queued))
      return this.#sessionRetry[kind]
    }
    if (result?.status === 429) {
      this.#backoff[kind] = Math.min(BACKOFF_MAX, this.#backoff[kind]
        ? this.#backoff[kind] * 2
        : BACKOFF_START)
      this.#requeue(kind, pk, request)
      return Math.min(BACKOFF_MAX, Math.max(result.retryAfterMs ?? 0, this.#backoff[kind]))
    }
    this.#storeFailure(kind, pk)
    return null
  }

  #requeue(kind: Kind, pk: string, request: Request): void {
    for (const signal of request.consumers) {
      if (signal.aborted)
        request.consumers.delete(signal)
    }
    if (request.consumers.size > 0 && !this.#queues[kind].has(pk))
      this.#queues[kind].set(pk, request)
  }

  #storeSuccess(kind: Kind, pk: string, result: AboutResult | ProfileResult): void {
    const at = this.clock.now()
    const entry = (this.#cache[pk] ??= {})
    this.#backoff[kind] = 0
    if (kind === 'about' && 'country' in result) {
      entry.about = {
        country: result.countryVisible && result.country
          ? this.#names.code(result.country)
          : null,
        countryName: result.countryVisible ? result.country : null,
        countryHidden: !result.countryVisible,
        joined: result.joined
          ? parseJoined(result.joined, this.languages)
          : null,
        at,
      }
    }
    if (kind === 'profile' && 'description' in result) {
      const counts = result.description
        ? parseProfileCounts(result.description)
        : { followers: null, posts: null }
      entry.profile = { ...counts, at }
      this.#needsPosts.delete(pk)
    }
    this.#scheduleSave()
    this.onChange(pk)
  }

  #storeFailure(kind: Kind, pk: string): void {
    const at = this.clock.now()
    const entry = (this.#cache[pk] ??= {})
    if (kind === 'about') {
      entry.aboutFailedAt = at
    }
    else {
      entry.profileFailedAt = at
      this.#needsPosts.delete(pk)
    }
    this.#scheduleSave()
    this.onChange(pk)
  }

  #whenVisible(): Promise<void> {
    const doc = this.win.document
    if (!doc?.hidden)
      return Promise.resolve()
    return new Promise(resolve => doc.addEventListener('visibilitychange', () => resolve(), { once: true }))
  }

  #scheduleSave(): void {
    if (this.#saveTimer !== null)
      return
    this.#saveTimer = setTimeout(async () => {
      this.#saveTimer = null
      this.#cache = mergeCaches(await this.store.get(), this.#cache)
      const entries = Object.entries(this.#cache)
      if (entries.length > MAX_ENTRIES) {
        const stamp = ([, entry]: [string, Entry]) => Math.max(entry.about?.at ?? 0, entry.profile?.at ?? 0, entry.seen?.at ?? 0, entry.aboutFailedAt ?? 0, entry.profileFailedAt ?? 0)
        this.#cache = Object.fromEntries(entries.sort((a, b) => stamp(b) - stamp(a)).slice(0, MAX_ENTRIES))
      }
      void this.store.set(this.#cache)
    }, SAVE_DELAY)
  }
}
