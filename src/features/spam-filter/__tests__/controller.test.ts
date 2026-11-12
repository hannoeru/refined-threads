// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { defaultSettings, type Settings, type Stats } from '../../../model'
import type { ProfileData } from '../../../profile/lookups'
import { readList, writeList } from '../../../rules/edit'
import { catalogWith, fakeLookups, postContainer, translate } from '../../../testing/feature'
import { makePost } from '../../../testing/post'
import { SpamFilter } from '../controller'
import { postCode } from '../view'

type Post = ReturnType<typeof makePost>

function setup(posts: Post[], settings: Settings = defaultSettings(), profile: Partial<ProfileData> = {}) {
  const saved: Settings[] = []
  const controller = new AbortController()
  const catalog = catalogWith(posts)
  const { lookups, wanted } = fakeLookups(profile)
  let stats: Stats = { day: '', hidden: 0, tagged: 0, byRule: {} }
  const filter = new SpamFilter({
    document,
    signal: controller.signal,
    settings,
    posts: catalog,
    lookups,
    translate,
    addStyle: () => undefined,
    saveSettings: async (next) => void saved.push(next),
    recordStats: (update) => void (stats = update(stats)),
    today: () => '2026-11-12',
  })
  filter.start()
  return { filter, catalog, controller, saved, wanted, stats: () => stats }
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
    document.body.innerHTML = postContainer('OWN').replace('<p>body</p>', '<a href="/@bob/post/QUOTED">quoted</a>')
    expect(postCode(container('OWN'))).toBe('OWN')
  })
})

describe('SpamFilter', () => {
  it('collapses a spam post with its reason and keeps the original nodes', () => {
    document.body.innerHTML = postContainer('A1')
    setup([affiliate('A1')])
    expect(container('A1').classList.contains('rt-collapse')).toBe(true)
    expect(bar('A1')?.textContent).toContain('Hidden: affiliate link')
    expect(container('A1').querySelector('p')?.textContent).toBe('body')
  })

  it('processes a post whose data arrives after its container', () => {
    document.body.innerHTML = postContainer('L1')
    const { filter, catalog } = setup([])
    expect(bar('L1')).toBeNull()
    catalog.add([affiliate('L1')])
    filter.scan()
    expect(bar('L1')).not.toBeNull()
  })

  it('Show reveals the post, Keep hiding collapses it again, and Not spam allows the author', async () => {
    document.body.innerHTML = postContainer('S1')
    const { saved } = setup([affiliate('S1')])
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
    document.body.innerHTML = postContainer('P1')
    let opened = false
    container('P1').addEventListener('click', () => (opened = true))
    setup([affiliate('P1')])
    click('P1', 'Show')
    expect(opened).toBe(false)
  })

  it('blurs instead of collapsing when the display is blur', () => {
    document.body.innerHTML = postContainer('B1')
    setup([affiliate('B1')], { ...defaultSettings(), display: 'blur' })
    expect(container('B1').classList.contains('rt-blur')).toBe(true)
  })

  it('only tags in tag-only mode, with a chip next to the author name', () => {
    document.body.innerHTML = postContainer('T1')
    setup([affiliate('T1')], { ...defaultSettings(), tagOnly: true })
    const chip = container('T1').querySelector('.rt-chip') as HTMLElement
    expect(container('T1').classList.contains('rt-collapse')).toBe(false)
    expect(bar('T1')).toBeNull()
    expect(chip.previousElementSibling?.className).toBe('name')
    expect(chip.textContent).toBe('affiliate link×')
    expect(chip.title).toBe('Tagged: affiliate link')
  })

  it('allows the author from the chip with one click, without opening the post', async () => {
    document.body.innerHTML = postContainer('T2')
    let opened = false
    container('T2').addEventListener('click', () => (opened = true))
    const { saved } = setup([affiliate('T2')], { ...defaultSettings(), tagOnly: true })
    container('T2').querySelector<HTMLButtonElement>('.rt-chip button')!.click()
    await Promise.resolve()
    expect(opened).toBe(false)
    expect(container('T2').querySelector('.rt-chip')).toBeNull()
    expect(readList(saved[0]!.ruleFile, 'allowed-accounts')).toEqual(['amy'])
  })

  it('falls back to a bar when the author row is not found', () => {
    document.body.innerHTML = `<div data-pressable-container="true" id="c-T3"><a href="/@amy/post/T3"><time datetime="2026-01-01">1h</time></a></div>`
    setup([affiliate('T3')], { ...defaultSettings(), tagOnly: true })
    expect(bar('T3')?.textContent).toContain('Tagged: affiliate link')
  })

  it('labels a country match with the flag and the country name, and asks for profile data', () => {
    document.body.innerHTML = postContainer('G1')
    const settings = defaultSettings()
    settings.ruleFile = writeList(settings.ruleFile, 'countries', ['JP'])
    const { wanted } = setup([makePost({ code: 'G1', author: { pk: 'p1' } })], settings, { country: 'JP' })
    expect(wanted).toContain('p1')
    expect(bar('G1')?.textContent).toMatch(/🇯🇵 Japan/)
  })

  it('removes every change when the feature is turned off', () => {
    document.body.innerHTML = postContainer('O1')
    const { controller } = setup([affiliate('O1')])
    controller.abort()
    expect(bar('O1')).toBeNull()
    expect(container('O1').className).toBe('')
  })

  it('counts each post once in the daily stats', () => {
    document.body.innerHTML = postContainer('C1')
    const { filter, stats } = setup([affiliate('C1')])
    filter.scan()
    expect(stats()).toEqual({ day: '2026-11-12', hidden: 1, tagged: 0, byRule: { 'affiliate-links': 1 } })
  })
})
