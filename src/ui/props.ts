import type { Settings } from '../model'

export type SectionProps = {
  settings: Settings
  update: (change: (current: Settings) => Settings) => Promise<void>
}
