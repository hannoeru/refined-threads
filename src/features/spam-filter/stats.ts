import type { Stats } from '../../model'
import { statsItem } from '../../settings'

export function createStatsRecorder(delay = 1000): (update: (stats: Stats) => Stats) => void {
  let pending: ((stats: Stats) => Stats)[] = []
  let timer: ReturnType<typeof setTimeout> | null = null
  return (update) => {
    pending.push(update)
    timer ??= setTimeout(async () => {
      timer = null
      const updates = pending
      pending = []
      await statsItem.setValue(updates.reduce((stats, apply) => apply(stats), await statsItem.getValue()))
    }, delay)
  }
}
