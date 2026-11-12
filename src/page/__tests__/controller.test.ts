// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { POSTS_EVENT } from '../../bridge'
import { defaultSettings, type Settings, type Stats } from '../../model'
import type { ProfileData } from '../../profile/lookups'
import { readList, writeList } from '../../rules/edit'
import { makePost } from '../../testing/post'
import { PageController } from '../controller'
import { handleFromUrl, parseHandle } from '../handle'
import { postCode } from '../view'

const MESSAGES: Record<string, string> = {
  bar_hidden: 'Hidden: $1',
  bar_tagged: 'Tagged: $1',
  bar_show: 'Show',
  bar_not_spam: 'Not spam',
  bar_keep_hiding: 'Keep hiding',
  rule_affiliate_links: 'affiliate links',
  rule_new_accounts: 'new account',
}
const translate = (key: string, subs: string[] = []) => (MESSAGES[key] ?? '').replace('$1', subs[0] ?? '')

const containerHtml = (code: string, quoted = '') => `
  <div data-pressable-container="true" id="c-${code}">
    <a href="/@amy"><span>amy</span></a>
    <a href="/@amy/post/${code}"><time datetime="2026-01-01">1h</time></a>
    ${quoted}
    <p>body</p>
  </div>`

function setup(settings: Settings = defaultSettings(), profile: Partial<ProfileData> = {}) {
  const saved: Settings[] = []
  const wanted: string[] = []
  let stats: Stats = { day: '', hidden: 0, tagged: 0, byRule: {} }
  const controller = new PageController({
    win: window,
    settings,
    lookups: {
      data: () => ({ country: null, ageMonths: null, followers: null, posts: null, ...profile }),
      want: (pk) => void wanted.push(pk),
    },
    translate,
    saveSettings: async (next) => void saved.push(next),
    recordStats: (update) => void (stats = update(stats)),
    today: () => '2026-11-12',
  })
  return { controller, saved, wanted, stats: () => stats }
}

const container = (code: string) => document.getElementById(`c-${code}`)!
const bar = (code: string) => container(code).querySelector(':scope > .rt-bar')
const click = (code: string, label: string) =>
  [...container(code).querySelectorAll('button')].find((button) => button.textContent === label)!.click()

const affiliate = (code: string) => makePost({ code, links: ['https://shopee.tw/x'], author: { username: 'amy', pk: 'p-amy' } })

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('postCode', () => {
  it('reads the code from the permalink that holds the timestamp, not from quoted posts', () => {
    document.body.innerHTML = containerHtml('OWN', '<a href="/@bob/post/QUOTED">quoted</a>')
    expect(postCode(container('OWN'))).toBe('OWN')
  })
})

describe('PageController', () => {
  it('collapses a spam post with its reason and keeps the original nodes', () => {
    document.body.innerHTML = containerHtml('A1')
    const { controller } = setup()
    controller.addPosts([affiliate('A1')])
    controller.scan()
    expect(container('A1').classList.contains('rt-collapse')).toBe(true)
    expect(bar('A1')?.textContent).toContain('Hidden: affiliate links')
    expect(container('A1').querySelector('p')?.textContent).toBe('body')
  })

  it('reads posts that arrive through the page event', () => {
    document.body.innerHTML = containerHtml('E1')
    const { controller } = setup()
    window.dispatchEvent(new CustomEvent(POSTS_EVENT, { detail: JSON.stringify([affiliate('E1')]) }))
    controller.scan()
    expect(bar('E1')).not.toBeNull()
  })

  it('processes a post whose data arrives after its container', () => {
    document.body.innerHTML = containerHtml('L1')
    const { controller } = setup()
    controller.scan()
    expect(bar('L1')).toBeNull()
    controller.addPosts([affiliate('L1')])
    controller.scan()
    expect(bar('L1')).not.toBeNull()
  })

  it('Show reveals the post, Keep hiding collapses it again, and Not spam allows the author', async () => {
    document.body.innerHTML = containerHtml('S1')
    const { controller, saved } = setup()
    controller.addPosts([affiliate('S1')])
    controller.scan()
    click('S1', 'Show')
    expect(container('S1').classList.contains('rt-collapse')).toBe(false)
    click('S1', 'Keep hiding')
    expect(container('S1').classList.contains('rt-collapse')).toBe(true)
    click('S1', 'Show')
    click('S1', 'Not spam')
    await Promise.resolve()
    expect(bar('S1')).toBeNull()
    expect(readList(saved[0]!.ruleFile, 'allowed-accounts')).toEqual(['amy'])
  })

  it('stops clicks on the bar from opening the post', () => {
    document.body.innerHTML = containerHtml('P1')
    let opened = false
    container('P1').addEventListener('click', () => (opened = true))
    const { controller } = setup()
    controller.addPosts([affiliate('P1')])
    controller.scan()
    click('P1', 'Show')
    expect(opened).toBe(false)
  })

  it('blurs instead of collapsing when the display is blur', () => {
    document.body.innerHTML = containerHtml('B1')
    const { controller } = setup({ ...defaultSettings(), display: 'blur' })
    controller.addPosts([affiliate('B1')])
    controller.scan()
    expect(container('B1').classList.contains('rt-blur')).toBe(true)
  })

  it('only tags in tag-only mode', () => {
    document.body.innerHTML = containerHtml('T1')
    const { controller } = setup({ ...defaultSettings(), tagOnly: true })
    controller.addPosts([affiliate('T1')])
    controller.scan()
    expect(container('T1').classList.contains('rt-collapse')).toBe(false)
    expect(bar('T1')?.textContent).toContain('Tagged: affiliate links')
  })

  it('labels a country match with the flag and the country name, and asks for profile data', () => {
    document.body.innerHTML = containerHtml('G1')
    const settings = defaultSettings()
    settings.ruleFile = writeList(settings.ruleFile, 'countries', ['JP'])
    const { controller, wanted } = setup(settings, { country: 'JP' })
    controller.addPosts([makePost({ code: 'G1', author: { pk: 'p1' } })])
    controller.scan()
    expect(wanted).toContain('p1')
    expect(bar('G1')?.textContent).toMatch(/🇯🇵 Japan/)
  })

  it('removes every change when protection is turned off', () => {
    document.body.innerHTML = containerHtml('O1')
    const { controller } = setup()
    controller.addPosts([affiliate('O1')])
    controller.scan()
    controller.setSettings({ ...defaultSettings(), enabled: false })
    controller.scan()
    expect(bar('O1')).toBeNull()
    expect(container('O1').className).toBe('')
  })

  it('counts each post once in the daily stats', () => {
    document.body.innerHTML = containerHtml('C1')
    const { controller, stats } = setup()
    controller.addPosts([affiliate('C1')])
    controller.scan()
    controller.scan()
    expect(stats()).toEqual({ day: '2026-11-12', hidden: 1, tagged: 0, byRule: { 'affiliate-links': 1 } })
  })
})

describe('handles', () => {
  it('reads a handle from a profile link, a post link, or typed text', () => {
    expect(handleFromUrl('https://www.threads.com/@Amy.Lin')).toBe('amy.lin')
    expect(handleFromUrl('https://www.threads.net/@amy/post/ABC')).toBe('amy')
    expect(handleFromUrl('https://www.threads.com/search')).toBeNull()
    expect(parseHandle('@Bob_1')).toBe('bob_1')
    expect(parseHandle('https://threads.com/@bob')).toBe('bob')
    expect(parseHandle('not a handle!')).toBeNull()
  })
})
