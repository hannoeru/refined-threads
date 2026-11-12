import { POSTS_EVENT } from '../bridge'
import type { Post, Settings, Stats } from '../model'
import type { ProfileData } from '../profile/lookups'
import { addAccount, ruleLabel } from '../rules/edit'
import { type CompiledRules, compileRules, CopyTracker, evaluate } from '../rules/engine'
import { CONTAINER, clearView, postCode, renderView, STYLE, type ViewText } from './view'

export type Lookups = {
  data: (pk: string) => ProfileData
  want: (pk: string, username: string, needs: { about: boolean; profile: boolean }) => void
}

export type ControllerDeps = {
  win: Window
  settings: Settings
  lookups: Lookups
  translate: (key: string, substitutions?: string[]) => string
  saveSettings: (settings: Settings) => Promise<void>
  recordStats: (update: (stats: Stats) => Stats) => void
  today: () => string
}

const flag = (code: string) => String.fromCodePoint(...[...code].map((letter) => 0x1f1a5 + letter.charCodeAt(0)))

export class PageController {
  readonly catalog = new Map<string, Post>()
  #copies = new CopyTracker()
  #settings: Settings
  #compiled: CompiledRules
  #revealed = new Set<string>()
  #counted = new Set<string>()
  #frame: number | null = null
  #observer: MutationObserver | null = null
  #regionNames: Intl.DisplayNames | null

  constructor(private readonly deps: ControllerDeps) {
    this.#settings = deps.settings
    this.#compiled = compileRules(deps.settings)
    const language = deps.translate('@@ui_locale').replace('_', '-') || 'en'
    try {
      this.#regionNames = new Intl.DisplayNames([language], { type: 'region' })
    } catch {
      this.#regionNames = null
    }
    deps.win.addEventListener(POSTS_EVENT, (event) => {
      let posts: Post[]
      try {
        posts = JSON.parse(String((event as CustomEvent).detail))
      } catch {
        return
      }
      this.addPosts(posts)
    })
  }

  start(): void {
    const doc = this.deps.win.document
    const style = doc.createElement('style')
    style.textContent = STYLE
    ;(doc.head ?? doc.documentElement).append(style)
    this.#observer = new MutationObserver(() => this.schedule())
    this.#observer.observe(doc.documentElement, { childList: true, subtree: true })
    this.schedule()
  }

  addPosts(posts: Post[]): void {
    for (const post of posts) {
      if (!this.catalog.has(post.code)) this.#copies.record(post)
      this.catalog.set(post.code, post)
    }
    this.schedule()
  }

  setSettings(settings: Settings): void {
    this.#settings = settings
    this.#compiled = compileRules(settings)
    this.schedule()
  }

  schedule(): void {
    if (this.#frame !== null) return
    this.#frame = this.deps.win.requestAnimationFrame(() => {
      this.#frame = null
      this.scan()
    })
  }

  scan(): void {
    for (const container of this.deps.win.document.querySelectorAll<HTMLElement>(CONTAINER)) {
      const code = postCode(container)
      const post = code ? this.catalog.get(code) : undefined
      if (!post) continue
      this.#process(container, post)
    }
  }

  #process(container: HTMLElement, stored: Post): void {
    const needs = this.#compiled.needs
    if (this.#compiled.enabled && (needs.about || needs.profile) && !stored.author.following) {
      this.deps.lookups.want(stored.author.pk, stored.author.username, needs)
    }
    const post: Post = { ...stored, author: { ...stored.author, ...this.deps.lookups.data(stored.author.pk) } }
    const verdict = evaluate(post, this.#compiled, { copies: (item) => this.#copies.count(item) })
    if (verdict.action === 'none') {
      clearView(container)
      return
    }
    this.#count(post.code, verdict.action, verdict.reasons.map((reason) => reason.id))
    const labels = verdict.reasons.map((reason) =>
      reason.id === 'countries' && post.author.country ? `${flag(post.author.country)} ${this.#regionNames?.of(post.author.country) ?? post.author.country}` : ruleLabel(reason, (key) => this.deps.translate(key)),
    )
    const t = this.deps.translate
    const text: ViewText = {
      hidden: (reasons) => t('bar_hidden', [reasons]),
      tagged: (reasons) => t('bar_tagged', [reasons]),
      show: t('bar_show'),
      notSpam: t('bar_not_spam'),
      keepHiding: t('bar_keep_hiding'),
    }
    renderView(
      container,
      { verdict, labels, display: this.#settings.display, revealed: this.#revealed.has(post.code) },
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
