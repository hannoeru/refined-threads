// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { fakeLookups, translate } from '../../testing/feature'
import { defineFeature } from '../api'
import { FeatureRuntime } from '../runtime'
import { PostCatalog } from '../services/posts'

function setup() {
  const log: string[] = []
  const errors: string[] = []
  const counter = defineFeature({
    id: 'counter',
    enabledByDefault: true,
    options: { label: { type: 'text', default: 'a' } },
    init(ctx) {
      log.push(`start:${ctx.options.label}`)
      ctx.addStyle('.x{}')
      ctx.signal.addEventListener('abort', () => log.push('stop'))
    },
  })
  const off = defineFeature({ id: 'off', enabledByDefault: false, init: () => void log.push('off-start') })
  const broken = defineFeature({
    id: 'broken',
    enabledByDefault: true,
    init: () => {
      throw new Error('boom')
    },
  })
  const profileOnly = defineFeature({
    id: 'profile-only',
    enabledByDefault: true,
    include: (url) => url.pathname.startsWith('/@'),
    init: () => void log.push('profile-start'),
  })
  let url = new URL('https://www.threads.com/')
  const runtime = new FeatureRuntime([counter, off, broken, profileOnly], {
    document,
    posts: new PostCatalog(new EventTarget() as Window),
    lookups: fakeLookups().lookups,
    t: translate,
    url: () => url,
    report: (id) => void errors.push(id),
  })
  return { runtime, log, errors, go: (next: string) => (url = new URL(next)) }
}

beforeEach(() => {
  document.head.innerHTML = ''
})

describe('FeatureRuntime', () => {
  it('starts features that are on by default and reports a broken feature without stopping the others', () => {
    const { runtime, log, errors } = setup()
    runtime.apply({})
    expect(log).toEqual(['start:a'])
    expect(errors).toEqual(['broken'])
    expect(document.querySelectorAll('style[data-refined-threads="counter"]')).toHaveLength(1)
  })

  it('stops a feature and removes its styles when the user turns it off', () => {
    const { runtime, log } = setup()
    runtime.apply({})
    runtime.apply({ counter: { enabled: false } })
    expect(log).toEqual(['start:a', 'stop'])
    expect(document.querySelectorAll('style[data-refined-threads="counter"]')).toHaveLength(0)
  })

  it('restarts a feature only when its own options change', () => {
    const { runtime, log } = setup()
    runtime.apply({})
    runtime.apply({ off: { enabled: false } })
    runtime.apply({ counter: { options: { label: 'b' } } })
    expect(log).toEqual(['start:a', 'stop', 'start:b'])
  })

  it('runs a feature only on the pages it includes, and follows navigation', () => {
    const { runtime, log, go } = setup()
    runtime.apply({})
    go('https://www.threads.com/@amy')
    runtime.navigated()
    expect(log).toContain('profile-start')
    expect(runtime.running()).toContain('profile-only')
    go('https://www.threads.com/')
    runtime.navigated()
    expect(runtime.running()).not.toContain('profile-only')
  })
})
