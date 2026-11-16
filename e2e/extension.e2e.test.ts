import type { Browser, Page, SupportedBrowser } from 'puppeteer'
import { resolve } from 'node:path'
import puppeteer from 'puppeteer'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { feedPayload, rawPost } from '../src/capture/__tests__/fixtures'

const BROWSER = (process.env.E2E_BROWSER ?? 'chrome') as SupportedBrowser
const EXTENSION = resolve(import.meta.dirname, `../.output/${BROWSER === 'firefox'
  ? 'firefox'
  : 'chrome'}-mv3`)
const FEED_URL = 'https://www.threads.com/'

const SPAM = rawPost({
  code: 'SPAM1',
  username: 'bait_bot',
  userPk: '901',
  text: 'Giveaway! comment +1 and follow to win',
})
const NORMAL = rawPost({
  code: 'NORMAL1',
  username: 'mika',
  userPk: '902',
  text: 'Finished the autumn series today.',
})

function article(username: string, code: string, text: string): string {
  return `<div data-pressable-container="true">
    <div><div><a href="/@${username}">${username}</a></div>
    <a href="/@${username}/post/${code}"><time datetime="2026-11-13T09:42:00Z">3h</time></a></div>
    <p>${text}</p>
  </div>`
}

const FEED_HTML = `<!doctype html><html><head><meta charset="utf-8">
<script type="application/json">${JSON.stringify(feedPayload([
  [SPAM],
  [NORMAL],
]))}</script>
</head><body>
${article('bait_bot', 'SPAM1', 'Giveaway! comment +1 and follow to win')}
${article('mika', 'NORMAL1', 'Finished the autumn series today.')}
</body></html>`

let browser: Browser
let page: Page

beforeAll(async () => {
  browser = await puppeteer.launch({
    browser: BROWSER,
    headless: true,
    enableExtensions: true,
    ...(BROWSER === 'chrome' && { pipe: true }),
  })
  await browser.installExtension(EXTENSION)
  page = await browser.newPage()
  await page.setRequestInterception(true)
  page.on('request', (request) => {
    if (request.url() === FEED_URL)
      void request.respond({ status: 200, contentType: 'text/html', body: FEED_HTML })
    else void request.abort()
  })
  await page.goto(FEED_URL)
}, 60_000)

afterAll(async () => {
  await browser?.close()
})

describe(`the extension in ${BROWSER}`, () => {
  it('folds a spam post into a bar with its reason', async () => {
    const bar = await page.waitForSelector('[data-pressable-container] .rt-bar', { timeout: 15_000 })
    const text = await bar!.evaluate(element => element.textContent)
    expect(text).toContain('Hidden · engagement bait')
  })

  it('leaves a normal post alone', async () => {
    const bars = await page.$$eval('[data-pressable-container]', containers =>
      containers.map(container => container.querySelector('.rt-bar') !== null))
    expect(bars).toEqual([true, false])
  })
})
