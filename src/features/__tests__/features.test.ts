// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { catalogWith, fakeLookups, postContainer, translate } from '../../testing/feature'
import { makePost } from '../../testing/post'
import type { Feature } from '../api'
import { FeatureRuntime } from '../runtime'
import { featureById } from '../registry'
import type { StoredFeatures } from '../state'

function run(id: string, stored: StoredFeatures, posts = catalogWith([]), lookups = fakeLookups()) {
  const runtime = new FeatureRuntime([featureById(id) as Feature], {
    document,
    posts,
    lookups: lookups.lookups,
    t: translate,
    url: () => new URL('https://www.threads.com/'),
    report: (_, error) => {
      throw error
    },
  })
  runtime.apply(stored)
  return runtime
}

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('absolute-timestamps', () => {
  it('shows the full date and time, and restores the relative time when turned off', () => {
    document.body.innerHTML = postContainer('A1', 'amy', '2026-03-04T05:06:00.000Z')
    const runtime = run('absolute-timestamps', { 'absolute-timestamps': { enabled: true, options: { format: 'date' } } })
    const time = document.querySelector('time')!
    expect(time.textContent).toBe(new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date('2026-03-04T05:06:00.000Z')))
    runtime.stopAll()
    expect(time.textContent).toBe('1h')
  })

  it('can keep the relative time next to the date', () => {
    document.body.innerHTML = postContainer('A2')
    run('absolute-timestamps', { 'absolute-timestamps': { enabled: true, options: { format: 'relative-and-date' } } })
    expect(document.querySelector('time')!.textContent).toMatch(/^1h · /)
  })
})

describe('keyboard-navigation', () => {
  const press = (key: string, target: EventTarget = document.body) => target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))

  it('moves between posts with j and k, and opens the current post with o', () => {
    document.body.innerHTML = postContainer('K1') + postContainer('K2')
    for (const element of document.querySelectorAll<HTMLElement>('[data-pressable-container]')) {
      element.getClientRects = () => [{}] as unknown as DOMRectList
      element.scrollIntoView = () => undefined
    }
    let opened = ''
    document.addEventListener('click', (event) => {
      opened = (event.target as HTMLElement).closest('a')?.getAttribute('href') ?? ''
      event.preventDefault()
    })
    const runtime = run('keyboard-navigation', { 'keyboard-navigation': { enabled: true } })
    press('j')
    expect(document.querySelector('.rt-keyboard-current')?.id).toBe('c-K1')
    press('j')
    expect(document.querySelector('.rt-keyboard-current')?.id).toBe('c-K2')
    press('k')
    expect(document.querySelector('.rt-keyboard-current')?.id).toBe('c-K1')
    press('o')
    expect(opened).toBe('/@amy/post/K1')
    runtime.stopAll()
    press('j')
    expect(document.querySelector('.rt-keyboard-current')).toBeNull()
  })

  it('ignores keys while the user types', () => {
    document.body.innerHTML = postContainer('K3') + '<textarea></textarea>'
    run('keyboard-navigation', { 'keyboard-navigation': { enabled: true } })
    press('j', document.querySelector('textarea')!)
    expect(document.querySelector('.rt-keyboard-current')).toBeNull()
  })
})

describe('account-info', () => {
  it('shows a badge after the author name and fills it when the lookup arrives', () => {
    document.body.innerHTML = postContainer('I1')
    const lookups = fakeLookups()
    const posts = catalogWith([makePost({ code: 'I1', author: { pk: 'p1', username: 'amy' } })])
    const runtime = run('account-info', { 'account-info': { enabled: true, options: { followers: true } } }, posts, lookups)
    const badge = () => document.querySelector('.rt-account-info') as HTMLElement | null
    expect(lookups.wanted).toEqual(['p1'])
    expect(badge()?.previousElementSibling?.textContent).toBe('amy')
    expect(badge()?.hidden).toBe(true)
    lookups.resolve('p1', { country: 'JP', ageMonths: 30, followers: 1200 })
    expect(badge()?.textContent).toBe('🇯🇵 · 2y on Threads · 1.2K followers')
    runtime.stopAll()
    expect(badge()).toBeNull()
  })
})
