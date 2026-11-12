// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { buildAboutRequest, findVersioningId, parseAboutResponse, retryAfterMs, sessionFromBody } from '../about'

const about = (country: string | null, visible: boolean, joined = '2023年7月 · 1億人以上') =>
  `for (;;);${JSON.stringify({
    payload: {
      layout: {
        bloks_payload: {
          data: [
            { data: { key: 'THREADS_ABOUT_THIS_PROFILE:about_this_profile_country_visibility', initial: visible } },
            ...(country === null ? [] : [{ data: { key: 'THREADS_ABOUT_THIS_PROFILE:about_this_profile_country', initial: country } }]),
          ],
          tree: [{ $: '#FF000000' }, { ')': '名前' }, { '&': 'Amy 2024 (@amy2024' }, { ')': '参加日' }, { ')': joined }],
        },
      },
    },
  })}`

describe('country lookup', () => {
  it('captures the session fields from a GraphQL request body, and only when it has fb_dtsg', () => {
    expect(sessionFromBody('fb_dtsg=T&lsd=L&__user=5&variables=%7B%7D&doc_id=1')).toEqual({ fb_dtsg: 'T', lsd: 'L', __user: '5' })
    expect(sessionFromBody('lsd=L')).toBeNull()
  })

  it('finds the Bloks versioning id in page scripts', () => {
    document.body.innerHTML = '<script>["WebBloksVersioningID",[],{"versioningID":"abc123"}]</script>'
    expect(findVersioningId(document)).toBe('abc123')
  })

  it('builds the About this profile request for one user', () => {
    const request = buildAboutRequest('https://www.threads.com', { fb_dtsg: 'T' }, 'abc', '42')
    const url = new URL(request.url)
    expect(url.pathname).toBe('/async/wbloks/fetch/')
    expect(url.searchParams.get('appid')).toBe('com.bloks.www.text_post_app.about_this_profile_async_action')
    expect(url.searchParams.get('__bkv')).toBe('abc')
    const body = new URLSearchParams(request.body)
    expect(body.get('fb_dtsg')).toBe('T')
    expect(JSON.parse(body.get('params') ?? '{}')).toMatchObject({ target_user_id: '42', referer_type: 'TextPostAppProfileOverflow' })
  })

  it('reads the country name, whether the user shows it, and the joined date text', () => {
    expect(parseAboutResponse('1', about('日本', true))).toEqual({
      pk: '1',
      ok: true,
      country: '日本',
      countryVisible: true,
      joined: '2023年7月 · 1億人以上',
    })
    expect(parseAboutResponse('1', about(null, false, 'July 2023'))).toMatchObject({ country: null, countryVisible: false, joined: 'July 2023' })
    expect(parseAboutResponse('1', '<!DOCTYPE html>')).toEqual({ pk: '1', ok: false, status: 200, retryAfterMs: null })
  })

  it('reads Retry-After in seconds', () => {
    expect(retryAfterMs('30')).toBe(30_000)
    expect(retryAfterMs(null)).toBeNull()
  })
})
