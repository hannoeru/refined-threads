import type { Post, Reason, Settings, Verdict } from '../model'

export type CompiledRules = { enabled: boolean }

export type EvaluateContext = { copies: (post: Post) => number }

export function compileRules(settings: Settings): CompiledRules {
  return { enabled: settings.enabled }
}

export function evaluate(_post: Post, _rules: CompiledRules, _ctx: EvaluateContext): Verdict {
  return { hide: false, score: 0, reasons: [] }
}

export class CopyTracker {
  record(_post: Post): number {
    return 0
  }
}

export function reasonMessageKey(reason: Reason): string {
  switch (reason.kind) {
    case 'preset':
      return `reason_${reason.id.replaceAll('-', '_')}`
    case 'rule':
      return 'reason_rule'
    case 'word':
      return 'reason_word'
    case 'host':
      return 'reason_host'
    case 'hidden-account':
      return 'reason_hidden_account'
  }
}
