import type { Feature } from '../api'
import type { StoredFeatures } from '../state'
// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { catalogWith, fakeLookups, postContainer, translate } from '../../testing/feature'
import { makePost } from '../../testing/post'
import { featureById } from '../registry'
import { FeatureRuntime } from '../runtime'
import { alwaysVisible } from '../services/visible'

function run(id: string, stored: StoredFeatures, posts = catalogWith([]), lookups = fakeLookups()) {
  const runtime = new FeatureRuntime([
    featureById(id) as Feature,
  ], {
    document,
    posts,
    lookups: lookups.lookups,
    t: translate,
    url: () => new URL('https://www.threads.com/'),
    whenVisible: () => alwaysVisible,
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
  it('is off by default', () => {
    document.body.innerHTML = postContainer('A0')
    run('absolute-timestamps', {})
    expect(document.querySelector('time')!.textContent).toBe('1h')
  })

  it('shows the date in the chosen style, and restores the relative time when turned off', () => {
    document.body.innerHTML = postContainer('A1', 'amy', '2026-03-04T05:06:00')
    const runtime = run('absolute-timestamps', {
      'absolute-timestamps': {
        enabled: true,
        options: { style: 'iso', time: false },
      },
    })
    const time = document.querySelector('time')!
    expect(time.textContent).toBe('2026-03-04')
    expect(time.title).not.toBe('')
    runtime.stopAll()
    expect(time.textContent).toBe('1h')
    expect(time.hasAttribute('title')).toBe(false)
  })

  it('uses a custom pattern and can keep the relative time in front', () => {
    document.body.innerHTML = postContainer('A2', 'amy', '2026-03-04T05:06:00')
    run('absolute-timestamps', {
      'absolute-timestamps': {
        enabled: true,
        options: { style: 'custom', pattern: 'D MMM HH:mm', relative: true },
      },
    })
    expect(document.querySelector('time')!.textContent).toBe('1h · 4 Mar 05:06')
  })
})

describe('keyboard-navigation', () => {
  const press = (key: string, target: EventTarget = document.body) => target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))

  it('moves between posts with j and k, and opens the current post with o', () => {
    document.body.innerHTML = postContainer('K1') + postContainer('K2')
    for (const element of document.querySelectorAll<HTMLElement>('[data-pressable-container]')) {
      element.getClientRects = () => Object.assign([
        new DOMRect(),
      ], {
        item: () => null,
      })
      element.scrollIntoView = () => undefined
    }
    let opened = ''
    document.addEventListener('click', (event) => {
      opened = (event.target as HTMLElement).closest('a')?.getAttribute('href') ?? ''
      event.preventDefault()
    })
    const runtime = run('keyboard-navigation', {
      'keyboard-navigation': { enabled: true },
    })
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
    document.body.innerHTML = `${postContainer('K3')}<textarea></textarea>`
    run('keyboard-navigation', {
      'keyboard-navigation': { enabled: true },
    })
    press('j', document.querySelector('textarea')!)
    expect(document.querySelector('.rt-keyboard-current')).toBeNull()
  })
})

describe('account-info', () => {
  const setup = (options: Record<string, unknown>) => {
    document.body.innerHTML = postContainer('I1')
    const lookups = fakeLookups()
    const wanted: unknown[] = []
    const want = lookups.lookups.want
    lookups.lookups.want = (pk, username, needs) => {
      wanted.push(needs)
      want(pk, username, needs)
    }
    const posts = catalogWith([
      makePost({
        code: 'I1',
        author: { pk: 'p1', username: 'amy' },
      }),
    ])
    const runtime = run('account-info', {
      'account-info': { enabled: true, options },
    }, posts, lookups)
    const badge = () => document.querySelector('.rt-account-info') as HTMLElement | null
    const items = () => [
      ...(badge()?.children ?? []),
    ].map(item => ({ text: item.textContent, title: (item as HTMLElement).title }))
    return {
      lookups,
      runtime,
      badge,
      items,
      wanted,
    }
  }

  it('places one line under the username, after the menu, and fills it when data arrives', () => {
    const { lookups, runtime, badge, items } = setup({ followers: true, posts: true })
    expect(badge()?.parentElement?.className).toBe('header')
    expect(badge()?.previousElementSibling?.className).toBe('menu')
    expect(badge()?.classList.contains('rt-ai-line')).toBe(true)
    expect(items()).toEqual([
      { text: '', title: 'Loading account info' },
    ])
    expect(badge()?.hidden).toBe(false)
    lookups.resolve('p1', {
      country: 'JP',
      ageMonths: 30,
      followers: 1200,
      posts: 4515,
    })
    expect(items()).toEqual([
      { text: '🇯🇵', title: 'Based in Japan' },
      { text: '2y', title: 'On Threads for 2y' },
      { text: '1.2K followers', title: '1.2K followers' },
      { text: '4.5K posts', title: '4.5K posts' },
    ])
    expect(badge()?.getAttribute('aria-label')).toBe('Based in Japan, On Threads for 2y, 1.2K followers, 4.5K posts')
    runtime.stopAll()
    expect(badge()).toBeNull()
  })

  it('falls back to a small inline badge after the name when the header layout is unknown', () => {
    document.body.innerHTML = postContainer('I2').replace('style="display: grid"', '')
    const posts = catalogWith([
      makePost({
        code: 'I2',
        author: { pk: 'p2', username: 'amy' },
      }),
    ])
    run('account-info', {
      'account-info': { enabled: true },
    }, posts, fakeLookups())
    const badge = document.querySelector('.rt-account-info')!
    expect(badge.classList.contains('rt-ai-inline')).toBe(true)
    expect(badge.previousElementSibling?.className).toBe('name')
  })

  it('shows whether the author follows you, and optionally whether you follow them, without a lookup', () => {
    document.body.innerHTML = postContainer('F1')
    const lookups = fakeLookups()
    const posts = catalogWith([
      makePost({
        code: 'F1',
        author: {
          pk: 'p1',
          username: 'amy',
          followedBy: true,
          following: true,
        },
      }),
    ])
    run('account-info', {
      'account-info': {
        enabled: true,
        options: { youFollow: true, flag: false, age: false },
      },
    }, posts, lookups)
    const badge = document.querySelector('.rt-account-info') as HTMLElement
    expect([...badge.children].map(item => item.textContent)).toEqual(['Follows you', 'Following'])
    expect(badge.hidden).toBe(false)
  })

  it('shows no follow details for strangers, and none when the switches are off', () => {
    const { lookups, items } = setup({ age: false })
    lookups.resolve('p1', { country: 'JP' })
    expect(items().map(item => item.text)).toEqual(['🇯🇵'])
    document.body.innerHTML = postContainer('F2')
    const posts = catalogWith([
      makePost({
        code: 'F2',
        author: { pk: 'p2', username: 'amy', followedBy: true },
      }),
    ])
    run('account-info', {
      'account-info': {
        enabled: true,
        options: { followsYou: false, flag: false, age: false },
      },
    }, posts, fakeLookups())
    expect((document.querySelector('.rt-account-info') as HTMLElement).hidden).toBe(true)
  })

  it('shows details that are known while the rest is still loading', () => {
    document.body.innerHTML = postContainer('L1')
    const posts = catalogWith([
      makePost({
        code: 'L1',
        author: { pk: 'p3', username: 'amy', followedBy: true },
      }),
    ])
    run('account-info', {
      'account-info': { enabled: true },
    }, posts, fakeLookups())
    const badge = document.querySelector('.rt-account-info') as HTMLElement
    expect([...badge.children].map(item => item.className)).toEqual(['rt-ai-follows-you', 'rt-ai-loading'])
  })

  it('shows each detail only when its switch is on', () => {
    const { lookups, items } = setup({ flag: false, countryName: true, age: false })
    lookups.resolve('p1', {
      country: 'TW',
      ageMonths: 5,
      followers: 10,
      posts: 3,
    })
    expect(items().map(item => item.text)).toEqual(['Taiwan'])
  })

  it('shows both the flag and the country name when both are on', () => {
    const { lookups, items } = setup({ countryName: true, age: false })
    lookups.resolve('p1', { country: 'TW' })
    expect(items().map(item => item.text)).toEqual(['🇹🇼', 'Taiwan'])
  })

  it('shows months for accounts younger than a year', () => {
    const { lookups, items } = setup({ flag: false })
    lookups.resolve('p1', { ageMonths: 5 })
    expect(items()).toEqual([
      { text: '5mo', title: 'On Threads for 5mo' },
    ])
  })

  it('marks accounts that hide their location', () => {
    const flagOnly = setup({ age: false })
    flagOnly.lookups.resolve('p1', { countryHidden: true })
    expect(flagOnly.items()).toEqual([
      { text: '🏴', title: 'Location hidden' },
    ])
    const named = setup({ countryName: true, age: false })
    named.lookups.resolve('p1', { countryHidden: true })
    expect(named.items().map(item => item.text)).toEqual(['🏴 Location hidden'])
  })

  it('shows the name from Threads when it is not a known country', () => {
    const { lookups, items } = setup({ age: false })
    lookups.resolve('p1', { country: null, countryName: 'Atlantis' })
    expect(items().map(item => item.text)).toEqual(['Atlantis'])
  })

  it('asks only for the lookups the switches need', () => {
    expect(setup({ flag: false, age: false, followers: true }).wanted).toEqual([
      { about: false, followers: true, posts: false },
    ])
    expect(setup({}).wanted).toEqual([
      { about: true, followers: false, posts: false },
    ])
  })
})
