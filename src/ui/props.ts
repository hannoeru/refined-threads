import type { Settings } from '../model'

export interface SectionProps {
  settings: Settings
  update: (change: (current: Settings) => Settings) => Promise<void>
}
