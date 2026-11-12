import { storage } from '#imports'
import { POSTS_EVENT, THREADS_MATCHES } from '../../src/bridge'
import type { Stats } from '../../src/model'
import { PageController } from '../../src/page/controller'
import { type Cache, ProfileLookups } from '../../src/profile/lookups'
import { loadSettings, saveSettings, statsItem, today, watchSettings } from '../../src/settings'

const profileCache = storage.defineItem<Cache>('local:profiles', { fallback: {} })

export default defineContentScript({
  matches: THREADS_MATCHES,
  runAt: 'document_start',
  async main(ctx) {
    const buffered: Event[] = []
    const buffer = (event: Event) => buffered.push(event)
    window.addEventListener(POSTS_EVENT, buffer)

    const translate = (key: string, substitutions?: string[]) => browser.i18n.getMessage(key as never, substitutions) || ''
    let controller: PageController | null = null
    const lookups = new ProfileLookups(
      window,
      { get: () => profileCache.getValue(), set: (cache) => profileCache.setValue(cache) },
      [document.documentElement.lang, ...navigator.languages].filter(Boolean),
      () => controller?.schedule(),
    )

    let pendingStats: ((stats: Stats) => Stats)[] = []
    let statsTimer: ReturnType<typeof setTimeout> | null = null
    const recordStats = (update: (stats: Stats) => Stats) => {
      pendingStats.push(update)
      statsTimer ??= setTimeout(async () => {
        statsTimer = null
        const updates = pendingStats
        pendingStats = []
        await statsItem.setValue(updates.reduce((stats, apply) => apply(stats), await statsItem.getValue()))
      }, 1000)
    }

    const [settings] = await Promise.all([loadSettings(), lookups.load()])
    if (ctx.isInvalid) return
    controller = new PageController({ win: window, settings, lookups, translate, saveSettings, recordStats, today })
    window.removeEventListener(POSTS_EVENT, buffer)
    for (const event of buffered) window.dispatchEvent(new CustomEvent(event.type, { detail: (event as CustomEvent).detail }))
    ctx.onInvalidated(watchSettings((next) => controller?.setSettings(next)))
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => controller?.start(), { once: true })
    else controller.start()
  },
})
