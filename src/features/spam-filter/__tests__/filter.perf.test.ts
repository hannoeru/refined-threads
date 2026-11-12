// @vitest-environment happy-dom
import { afterEach, describe, it, vi } from 'vitest'
import { defaultSettings } from '../../../model'
import { catalogWith, fakeLookups, postContainer, translate } from '../../../testing/feature'
import { makePost } from '../../../testing/post'
import { observe } from '../../services/observe'
import { SpamFilter } from '../controller'

const POSTS = 150
const RUNS = 7

const posts = Array.from({ length: POSTS }, (_, index) =>
  makePost({
    code: `P${index}`,
    text: index % 5 === 0 ? 'link in bio for the deal' : `ordinary post number ${index}`,
    links: index % 7 === 0 ? ['https://shopee.tw/x'] : [],
    author: { pk: `u${index}`, username: `user${index}` },
  }),
)

function start(initialPosts: typeof posts) {
  const controller = new AbortController()
  const catalog = catalogWith(initialPosts)
  const filter = new SpamFilter({
    document,
    signal: controller.signal,
    settings: defaultSettings(),
    posts: catalog,
    lookups: fakeLookups().lookups,
    observe: (selector, callback) => observe(document, selector, callback, controller.signal),
    translate,
    addStyle: () => undefined,
    saveSettings: async () => undefined,
    recordStats: () => undefined,
    today: () => '2026-11-13',
  })
  let scans = 0
  const scan = filter.scan.bind(filter)
  filter.scan = () => {
    scans++
    scan()
  }
  filter.start()
  return { controller, catalog, scans: () => scans }
}

async function measure(name: string, scenario: () => Promise<{ ms: number; scans: number }>) {
  const times: number[] = []
  let scans = 0
  for (let run = 0; run < RUNS; run++) {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const result = await scenario()
    times.push(result.ms)
    scans = result.scans
    vi.useRealTimers()
  }
  times.sort((a, b) => a - b)
  console.log(`${name}: median ${times[Math.floor(RUNS / 2)]!.toFixed(1)} ms, ${scans} full scans`)
}

afterEach(() => vi.useRealTimers())

describe('spam filter performance', () => {
  it('measures the work for unrelated DOM changes and for arriving posts', async () => {
    await measure('100 unrelated DOM changes inside 150 posts', async () => {
      document.body.innerHTML = posts.map((post) => postContainer(post.code, post.author.username)).join('')
      const { controller, scans } = start(posts)
      await vi.advanceTimersByTimeAsync(20)
      const before = scans()
      const bodies = [...document.querySelectorAll('p')]
      const startedAt = performance.now()
      for (let index = 0; index < 100; index++) {
        bodies[index % bodies.length]!.append(document.createElement('span'))
        await vi.advanceTimersByTimeAsync(20)
      }
      const ms = performance.now() - startedAt
      controller.abort()
      return { ms, scans: scans() - before }
    })

    for (const filterOn of [false, true]) {
    await measure(`150 posts arriving in 10 batches${filterOn ? '' : ' (floor: filter off)'}`, async () => {
      document.body.innerHTML = ''
      const { controller, catalog, scans } = start([])
      if (!filterOn) controller.abort()
      const startedAt = performance.now()
      for (let batch = 0; batch < 10; batch++) {
        const slice = posts.slice(batch * 15, batch * 15 + 15)
        document.body.insertAdjacentHTML('beforeend', slice.map((post) => postContainer(post.code, post.author.username)).join(''))
        catalog.add(slice)
        await vi.advanceTimersByTimeAsync(20)
      }
      const ms = performance.now() - startedAt
      controller.abort()
      return { ms, scans: scans() }
    })
    }
  }, 120_000)
})
