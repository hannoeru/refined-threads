import { loadSettings, rankingItem, saveSettings, statsItem, today, watchSettings } from '../../settings'
import { defineFeature } from '../api'
import { SpamFilter } from './controller'
import { createRecorder } from './recorder'

export default defineFeature({
  id: 'spam-filter',
  enabledByDefault: true,
  async init(ctx) {
    const settings = await loadSettings()
    if (ctx.signal.aborted)
      return
    const filter = new SpamFilter({
      document: ctx.document,
      signal: ctx.signal,
      settings,
      posts: ctx.posts,
      lookups: ctx.lookups,
      observe: ctx.observe,
      whenVisible: ctx.whenVisible,
      translate: ctx.t,
      addStyle: ctx.addStyle,
      saveSettings,
      recordStats: createRecorder(statsItem),
      recordRanking: createRecorder(rankingItem),
      today,
    })
    const unwatch = watchSettings(next => filter.setSettings(next))
    ctx.signal.addEventListener('abort', unwatch, { once: true })
    filter.start()
  },
})
