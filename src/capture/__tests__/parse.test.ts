// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { parseBootstrap, parsePayloadText, unwrapLink } from '../parse'
import { feedPayload, rawPost } from './fixtures'

describe('parsePayloadText', () => {
  it('reads posts from a guarded feed response and maps the fields the rules use', () => {
    const body = `for (;;);${JSON.stringify(
      feedPayload([
        [
          rawPost({
            code: 'A1',
            username: 'Writer',
            text: 'see https://example.com/page',
            fragments: [
              {
                fragment_type: 'link',
                link_fragment: { uri: 'https://l.threads.com/?u=https%3A%2F%2Fshopee.tw%2Fitem%2F9&e=x' },
              },
              {
                fragment_type: 'mention',
                mention_fragment: { mentioned_username: 'Friend' },
              },
            ],
            preview: 'https://news.example.org/a',
            following: true,
          }),
        ],
      ]),
    )}`
    const [post] = parsePayloadText(body).posts
    expect(post).toMatchObject({
      code: 'A1',
      text: 'see https://example.com/page',
      links: ['https://shopee.tw/item/9', 'https://news.example.org/a', 'https://example.com/page'],
      mentions: ['friend'],
      language: 'zh-tw',
      hasAiLabel: false,
      counts: {
        likes: 5,
        replies: 2,
        reposts: 1,
        quotes: 0,
      },
      author: {
        pk: '900',
        username: 'writer',
        following: true,
        followedBy: false,
        country: null,
      },
    })
  })

  it('reads newline-delimited JSON documents', () => {
    const body = [
      feedPayload([
        [
          rawPost({ code: 'N1' }),
        ],
      ]),
      feedPayload([
        [
          rawPost({ code: 'N2' }),
        ],
      ]),
    ].map(d => JSON.stringify(d)).join('\n')
    expect(parsePayloadText(body).posts.map(post => post.code).sort()).toEqual(['N1', 'N2'])
  })

  it('sets the AI label only for a real detection method', () => {
    const posts = parsePayloadText(JSON.stringify(feedPayload([
      [
        rawPost({ code: 'X', detection: 'NONE' }),
      ],
      [
        rawPost({ code: 'Y', detection: 'C2PA' }),
      ],
    ]))).posts
    expect(Object.fromEntries(posts.map(post => [post.code, post.hasAiLabel]))).toEqual({ X: false, Y: true })
  })

  it('gives the root post the links from its author self-replies only', () => {
    const thread = [
      rawPost({ code: 'ROOT', userPk: '1', text: 'look at this' }),
      rawPost({
        code: 'SELF',
        userPk: '1',
        isReply: true,
        preview: 'https://shp.ee/abc',
      }),
      rawPost({
        code: 'OTHER',
        userPk: '2',
        isReply: true,
        preview: 'https://amzn.to/zzz',
      }),
    ]
    const root = parsePayloadText(JSON.stringify(feedPayload([thread]))).posts.find(post => post.code === 'ROOT')
    expect(root?.selfReplyLinks).toEqual(['https://shp.ee/abc'])
  })

  it('returns each post once when it appears many times, and handles a missing caption', () => {
    const post = rawPost({ code: 'D', text: null })
    const posts = parsePayloadText(JSON.stringify({
      a: [post, post],
      b: { nested: post },
    })).posts
    expect(posts).toHaveLength(1)
    expect(posts[0]?.text).toBe('')
  })

  it('returns nothing for bodies that are not JSON', () => {
    expect(parsePayloadText('<html>error</html>')).toEqual({ posts: [], users: [] })
    expect(parsePayloadText('')).toEqual({ posts: [], users: [] })
  })
})

describe('follower counts', () => {
  it('reads follower_count from user objects in GraphQL responses, once per account', () => {
    const profile = {
      data: {
        user: {
          pk: '42',
          id: '42',
          username: 'amy',
          follower_count: 1269,
        },
      },
      also: {
        user: { id: '42', username: 'amy', follower_count: 1269 },
      },
    }
    expect(parsePayloadText(JSON.stringify(profile)).users).toEqual([
      { pk: '42', followers: 1269 },
    ])
  })

  it('ignores feed users, which have no follower_count', () => {
    expect(parsePayloadText(JSON.stringify(feedPayload([
      [
        rawPost({ code: 'F1' }),
      ],
    ]))).users).toEqual([])
  })

  it('reads follower counts from a profile page bootstrap script', () => {
    document.body.innerHTML = `<script type="application/json">${JSON.stringify({
      user: { pk: '7', username: 'bob', follower_count: 30 },
    })}</script>`
    expect(parseBootstrap(document).users).toEqual([
      { pk: '7', followers: 30 },
    ])
  })
})

describe('unwrapLink', () => {
  it('unwraps Threads redirect links and keeps other links', () => {
    expect(unwrapLink('https://l.threads.net/?u=https%3A%2F%2Fa.co%2Fb')).toBe('https://a.co/b')
    expect(unwrapLink('https://example.com/?u=x')).toBe('https://example.com/?u=x')
  })
})

describe('parseBootstrap', () => {
  it('reads posts from the server-rendered JSON scripts that carry post data', () => {
    document.body.innerHTML = `
      <script type="application/json">${JSON.stringify({
        require: [
          feedPayload([
            [
              rawPost({ code: 'B1' }),
            ],
          ]),
        ],
      })}</script>
      <script type="application/json">${JSON.stringify({
        other: rawPost({ code: 'IGNORED' }),
      }).replace('logging_info_token', 'x')}</script>`
    expect(parseBootstrap(document).posts.map(post => post.code)).toEqual(['B1'])
  })
})
