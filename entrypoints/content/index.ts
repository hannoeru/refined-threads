import { storage } from '#imports'
import { THREADS_MATCHES } from '../../src/bridge'
import type { AccountLookups } from '../../src/features/api'
import { FEATURES } from '../../src/features/registry'
import { FeatureRuntime } from '../../src/features/runtime'
import { PostCatalog } from '../../src/features/services/posts'
import { createWhenVisible } from '../../src/features/services/visible'
import { featuresItem } from '../../src/features/state'
import { type Cache, ProfileLookups } from '../../src/profile/lookups'

const profileCache = storage.defineItem<Cache>('local:profiles', { fallback: {} })

export default defineContentScript({
  matches: THREADS_MATCHES,
  runAt: 'document_start',
  async main(ctx) {
    const posts = new PostCatalog(window)
    const listeners = new Set<(pk: string) => void>()
    const profiles = new ProfileLookups(
      window,
      { get: () => profileCache.getValue(), set: (cache) => profileCache.setValue(cache) },
      [document.documentElement.lang, ...navigator.languages].filter(Boolean),
      (pk) => listeners.forEach((listener) => listener(pk)),
    )
    const lookups: AccountLookups = {
      data: (pk) => profiles.data(pk),
      want: (pk, username, needs) => profiles.want(pk, username, needs),
      loading: (pk) => profiles.loading(pk),
      subscribe: (listener, signal) => {
        listeners.add(listener)
        signal.addEventListener('abort', () => listeners.delete(listener), { once: true })
      },
    }
    const runtime = new FeatureRuntime(FEATURES, {
      document,
      posts,
      lookups,
      t: (key, substitutions) => browser.i18n.getMessage(key as never, substitutions) || '',
      url: () => new URL(location.href),
      whenVisible: (signal) => createWhenVisible(window, signal),
      report: (id, error) => console.error(`[Refined Threads] ${id} failed`, error),
    })

    const [stored] = await Promise.all([featuresItem.getValue(), profiles.load()])
    if (ctx.isInvalid) return
    if (document.readyState === 'loading') await new Promise((resolve) => document.addEventListener('DOMContentLoaded', resolve, { once: true }))
    runtime.apply(stored)
    ctx.onInvalidated(featuresItem.watch((next) => runtime.apply(next ?? {})))
    ctx.onInvalidated(() => runtime.stopAll())
    ctx.addEventListener(window, 'wxt:locationchange', () => runtime.navigated())
  },
})
