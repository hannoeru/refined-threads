import { describe, expect, it } from 'vitest'
import { decodeEntities, findDescription, readDescription } from '../profile'

const head = '<html><head><meta property="og:title" content="x" /><meta name="description" content="&#x30d5;&#x30a9;&#x30ed;&#x30ef;&#x30fc;100&#x4eba;&#x30fb;&#x30b9;&#x30ec;&#x30c3;&#x30c9;4,515 &#x4ef6;" /></head>'

describe('profile description', () => {
  it('decodes HTML entities', () => {
    expect(decodeEntities('&#064;a &amp; b &#x1f1ef;&#x1f1f5;')).toBe('@a & b 🇯🇵')
  })

  it('finds the meta description, or knows it is missing once the head ends', () => {
    expect(findDescription(head)).toBe('フォロワー100人・スレッド4,515 件')
    expect(findDescription('<html><head><title>t</title>')).toBeUndefined()
    expect(findDescription('<html><head></head><body>')).toBeNull()
  })

  it('stops reading the stream as soon as the description arrives', async () => {
    let pulls = 0
    const encoder = new TextEncoder()
    const chunks = [head.slice(0, 40), head.slice(40), '<body>'.repeat(1000), 'never']
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        const chunk = chunks[pulls++]
        if (chunk === undefined) controller.close()
        else controller.enqueue(encoder.encode(chunk))
      },
    })
    expect(await readDescription(new Response(body))).toBe('フォロワー100人・スレッド4,515 件')
    expect(pulls).toBeLessThanOrEqual(3)
  })
})
