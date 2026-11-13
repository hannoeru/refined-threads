import type { Post, Settings, Stats } from '../../model'
import { addAccount, isBuiltIn, ruleLabel } from '../../rules/edit'
import { nameSlotOf } from '../../threads/dom'
import { type CompiledRules, compileRules, CopyTracker, evaluate, normalizeCopyText } from '../../rules/engine'
import type { AccountLookups, PostStream } from '../api'
import type { WhenVisible } from '../services/visible'
import { CONTAINER, clearView, postCode, renderView, STYLE, type ViewText } from './view'

export type SpamFilterDeps = {
  document: Document
  signal: AbortSignal
  settings: Settings
  posts: PostStream
  lookups: AccountLookups
  observe: <E extends Element>(selector: string, callback: (element: E) => void) => void
  whenVisible: WhenVisible
  translate: (key: string, substitutions?: string[]) => string
  addStyle: (css: string) => void
  saveSettings: (settings: Settings) => Promise<void>
  recordStats: (update: (stats: Stats) => Stats) => void
  today: () => string
}

const MAX_TEXTS = 5000

const flag = (code: string) => String.fromCodePoint(...[...code].map((letter) => 0x1f1a5 + letter.charCodeAt(0)))

export class SpamFilter {
  #copies = new CopyTracker()
  #recorded = new Set<string>()
  #settings: Settings
  #compiled: CompiledRules
  #revealed = new Set<string>()
  #counted = new Set<string>()
  #timer: ReturnType<typeof setTimeout> | null = null
  #pending = new Set<HTMLElement>()
  #all = false
  #codes = new WeakMap<Element, string>()
  #waiting = new Map<string, Set<HTMLElement>>()
  #shown = new Map<string, Set<HTMLElement>>()
  #sameText = new Map<string, Set<string>>()
  #regionNames: Intl.DisplayNames | null

  constructor(private readonly deps: SpamFilterDeps) {
    this.#settings = deps.settings
    this.#compiled = compileRules(deps.settings)
    const language = deps.translate('@@ui_locale').replace('_', '-') || 'en'
    try {
      this.#regionNames = new Intl.DisplayNames([language], { type: 'region' })
    } catch {
      this.#regionNames = null
    }
  }

  start(): void {
    const { document, signal } = this.deps
    this.deps.addStyle(STYLE)
    this.deps.posts.subscribe((posts) => this.#postsArrived(posts), signal)
    this.deps.lookups.subscribe(() => this.#scheduleAll(), signal)
    this.deps.observe<HTMLElement>(CONTAINER, (container) => this.#queue(container))
    this.deps.observe<HTMLElement>('a[href*="/post/"] time', (time) => {
      const container = time.closest<HTMLElement>(CONTAINER)
      if (!container) return
      this.#codes.delete(container)
      this.#queue(container)
    })
    signal.addEventListener(
      'abort',
      () => {
        if (this.#timer !== null) clearTimeout(this.#timer)
        for (const container of document.querySelectorAll(CONTAINER)) clearView(container)
      },
      { once: true },
    )
    this.scan()
  }

  setSettings(settings: Settings): void {
    this.#settings = settings
    this.#compiled = compileRules(settings)
    this.#scheduleAll()
  }

  scan(): void {
    if (this.deps.signal.aborted) return
    this.#pending.clear()
    this.#all = false
    for (const container of this.deps.document.querySelectorAll<HTMLElement>(CONTAINER)) this.#check(container)
  }

  #postsArrived(posts: Post[]): void {
    for (const post of posts) {
      if (!this.#recorded.has(post.code)) {
        this.#recorded.add(post.code)
        this.#rememberText(post)
        if (this.#copies.record(post) > 1) this.#queueSameText(post)
      }
      for (const container of this.#waiting.get(post.code) ?? []) this.#pending.add(container)
      this.#waiting.delete(post.code)
    }
    this.#schedule()
  }

  #rememberText(post: Post): void {
    const key = normalizeCopyText(post.text)
    if (key.length < 12) return
    const codes = this.#sameText.get(key)
    if (codes) {
      codes.add(post.code)
      return
    }
    if (this.#sameText.size >= MAX_TEXTS) this.#sameText.delete(this.#sameText.keys().next().value!)
    this.#sameText.set(key, new Set([post.code]))
  }

  #queueSameText(post: Post): void {
    if (!this.#compiled.needs.copies) return
    for (const code of this.#sameText.get(normalizeCopyText(post.text)) ?? []) {
      for (const container of this.#shown.get(code) ?? []) {
        if (container.isConnected) this.#pending.add(container)
        else this.#shown.get(code)?.delete(container)
      }
    }
  }

  #queue(container: HTMLElement): void {
    this.#pending.add(container)
    this.#schedule()
  }

  #scheduleAll(): void {
    this.#all = true
    this.#schedule()
  }

  #schedule(): void {
    if (this.#timer !== null || this.deps.signal.aborted) return
    this.#timer = setTimeout(() => {
      this.#timer = null
      this.#flush()
    }, 16)
  }

  #flush(): void {
    if (this.deps.signal.aborted) return
    if (this.#all) {
      this.scan()
      return
    }
    const pending = [...this.#pending]
    this.#pending.clear()
    for (const container of pending) if (container.isConnected) this.#check(container)
  }

  #codeOf(container: HTMLElement): string | null {
    const cached = this.#codes.get(container)
    if (cached !== undefined) return cached
    const code = postCode(container)
    if (code) this.#codes.set(container, code)
    return code
  }

  #check(container: HTMLElement): void {
    const code = this.#codeOf(container)
    if (!code) return
    const post = this.deps.posts.get(code)
    if (post) {
      const shown = this.#shown.get(code) ?? new Set()
      shown.add(container)
      this.#shown.set(code, shown)
      this.#process(container, post)
      return
    }
    const waiting = this.#waiting.get(code) ?? new Set()
    waiting.add(container)
    this.#waiting.set(code, waiting)
  }

  #process(container: HTMLElement, stored: Post): void {
    const needs = this.#compiled.needs
    if ((needs.about || needs.followers || needs.posts) && !stored.author.following) {
      this.deps.whenVisible(container, () => this.deps.lookups.want(stored.author.pk, stored.author.username, needs))
    }
    const { country, ageMonths, followers, posts } = this.deps.lookups.data(stored.author.pk)
    const post: Post = { ...stored, author: { ...stored.author, country, ageMonths, followers, posts } }
    const verdict = evaluate(post, this.#compiled, { copies: (item) => this.#copies.count(item) })
    if (verdict.action === 'none') {
      clearView(container)
      return
    }
    this.#count(post.code, verdict.action, verdict.reasons.map((reason) => reason.id))
    const t = this.deps.translate
    const labels = verdict.reasons.map((reason) =>
      reason.id === 'countries' && post.author.country
        ? `${flag(post.author.country)} ${this.#regionNames?.of(post.author.country) ?? post.author.country}`
        : reason.name || (isBuiltIn(reason.id) && t(`reason_${reason.id.replaceAll('-', '_')}`)) || ruleLabel(reason, (key) => t(key)),
    )
    const text: ViewText = {
      hidden: (reasons) => t('bar_hidden', [reasons]),
      tagged: (reasons) => t('bar_tagged', [reasons]),
      show: t('bar_show'),
      notSpam: t('bar_not_spam'),
      keepHiding: t('bar_keep_hiding'),
    }
    renderView(
      container,
      {
        verdict,
        labels,
        display: this.#settings.display,
        revealed: this.#revealed.has(post.code),
        slot: nameSlotOf(container, post.author.username),
      },
      text,
      {
        reveal: () => this.#toggle(post.code, true),
        conceal: () => this.#toggle(post.code, false),
        allow: () => void this.#allow(post.author.username),
      },
    )
  }

  #toggle(code: string, revealed: boolean): void {
    if (revealed) this.#revealed.add(code)
    else this.#revealed.delete(code)
    this.scan()
  }

  async #allow(username: string): Promise<void> {
    const settings = { ...this.#settings, ruleFile: addAccount(this.#settings.ruleFile, 'allowed-accounts', username) }
    this.setSettings(settings)
    this.scan()
    await this.deps.saveSettings(settings)
  }

  #count(code: string, action: 'hide' | 'tag', ruleIds: string[]): void {
    if (this.#counted.has(code)) return
    this.#counted.add(code)
    const day = this.deps.today()
    this.deps.recordStats((stats) => {
      const current = stats.day === day ? stats : { day, hidden: 0, tagged: 0, byRule: {} }
      const byRule = { ...current.byRule }
      for (const id of ruleIds) byRule[id] = (byRule[id] ?? 0) + 1
      return {
        day,
        hidden: current.hidden + (action === 'hide' ? 1 : 0),
        tagged: current.tagged + (action === 'tag' ? 1 : 0),
        byRule,
      }
    })
  }
}
