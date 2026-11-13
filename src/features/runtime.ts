import type { AccountLookups, Feature, FeatureContext, PostStream } from './api'
import type { WhenVisible } from './services/visible'
import type { StoredFeatures } from './state'
import { observe } from './services/observe'
import { resolveState } from './state'

export interface RuntimeServices {
  document: Document
  posts: PostStream
  lookups: AccountLookups
  t: (key: string, substitutions?: string[]) => string
  url: () => URL
  whenVisible: (signal: AbortSignal) => WhenVisible
  report: (featureId: string, error: unknown) => void
}

interface Running { key: string, controller: AbortController }

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
      const key = active
        ? JSON.stringify(state.options)
        : ''
      const current = this.#running.get(feature.id)
      if (current?.key === key)
        continue
      current?.controller.abort()
      this.#running.delete(feature.id)
      if (active)
        this.#start(feature, state.options, key)
    }
  }

  navigated(): void {
    this.apply(this.#stored)
  }

  running(): string[] {
    return [
      ...this.#running.keys(),
    ]
  }

  stopAll(): void {
    for (const { controller } of this.#running.values()) controller.abort()
    this.#running.clear()
  }

  #start(feature: Feature, options: Record<string, unknown>, key: string): void {
    const controller = new AbortController()
    const { signal } = controller
    this.#running.set(feature.id, { key, controller })
    const { document, posts, lookups } = this.services
    const guard = <Args extends unknown[]>(listener: (...args: Args) => void) => (...args: Args) => {
      try {
        listener(...args)
      }
      catch (error) {
        this.services.report(feature.id, error)
      }
    }
    const ctx: FeatureContext<Record<string, unknown>> = {
      signal,
      options,
      document,
      posts: {
        get: code => posts.get(code),
        subscribe: (listener, signal) => posts.subscribe(guard(listener), signal),
      },
      lookups: {
        ...lookups,
        subscribe: (listener, signal) => lookups.subscribe(guard(listener), signal),
      },
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
      void Promise.resolve(feature.init(ctx as never)).catch(error => this.services.report(feature.id, error))
    }
    catch (error) {
      this.services.report(feature.id, error)
    }
  }
}
