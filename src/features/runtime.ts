import type { AccountLookups, Feature, FeatureContext, PostStream } from './api'
import { observe } from './services/observe'
import type { WhenVisible } from './services/visible'
import { resolveState, type StoredFeatures } from './state'

export type RuntimeServices = {
  document: Document
  posts: PostStream
  lookups: AccountLookups
  t: (key: string, substitutions?: string[]) => string
  url: () => URL
  whenVisible: (signal: AbortSignal) => WhenVisible
  report: (featureId: string, error: unknown) => void
}

type Running = { key: string; controller: AbortController }

export class FeatureRuntime {
  #running = new Map<string, Running>()
  #stored: StoredFeatures = {}

  constructor(
    private readonly features: readonly Feature[],
    private readonly services: RuntimeServices,
  ) {}

  apply(stored: StoredFeatures): void {
    this.#stored = stored
    const url = this.services.url()
    for (const feature of this.features) {
      const state = resolveState(feature, stored)
      const active = state.enabled && (feature.include?.(url) ?? true)
      const key = active ? JSON.stringify(state.options) : ''
      const current = this.#running.get(feature.id)
      if (current?.key === key) continue
      current?.controller.abort()
      this.#running.delete(feature.id)
      if (active) this.#start(feature, state.options, key)
    }
  }

  navigated(): void {
    this.apply(this.#stored)
  }

  running(): string[] {
    return [...this.#running.keys()]
  }

  stopAll(): void {
    for (const { controller } of this.#running.values()) controller.abort()
    this.#running.clear()
  }

  #start(feature: Feature, options: Record<string, unknown>, key: string): void {
    const controller = new AbortController()
    const { signal } = controller
    this.#running.set(feature.id, { key, controller })
    const { document } = this.services
    const ctx: FeatureContext<Record<string, unknown>> = {
      signal,
      options,
      document,
      posts: this.services.posts,
      lookups: this.services.lookups,
      t: this.services.t,
      observe: (selector, callback) => observe(document, selector, callback, signal),
      whenVisible: this.services.whenVisible(signal),
      addStyle: (css) => {
        const style = document.createElement('style')
        style.dataset.refinedThreads = feature.id
        style.textContent = css
        ;(document.head ?? document.documentElement).append(style)
        signal.addEventListener('abort', () => style.remove(), { once: true })
      },
    }
    try {
      void Promise.resolve(feature.init(ctx as never)).catch((error) => this.services.report(feature.id, error))
    } catch (error) {
      this.services.report(feature.id, error)
    }
  }
}
