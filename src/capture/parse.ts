import type { SeenUser } from '../bridge'
import type { Post } from '../model'

type Json = Record<string, unknown>

const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value)

function obj(value: unknown): Json {
  return isObject(value)
    ? value
    : {}
}

function str(value: unknown): string {
  return typeof value === 'string'
    ? value
    : typeof value === 'number'
      ? String(value)
      : ''
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : 0
}

const REDIRECT_HOSTS = new Set(['l.threads.com', 'l.threads.net', 'l.instagram.com'])

const URL_PATTERN = /https?:\/\/[^\s<>"'）)]+/g

export function unwrapLink(link: string): string {
  try {
    const url = new URL(link)
    const target = REDIRECT_HOSTS.has(url.hostname)
      ? url.searchParams.get('u')
      : null
    return target ?? link
  }
  catch {
    return link
  }
}

export function stripGuard(text: string): string {
  return text.replace(/^for\s*\(\s*;\s*;\s*\)\s*;/, '')
}

function isPostRecord(value: Json): boolean {
  return (typeof value.code === 'string' || typeof value.code === 'number') && value.pk !== undefined && isObject(value.user)
}

function toPost(record: Json): Post {
  const info = obj(record.text_post_app_info)
  const user = obj(record.user)
  const friendship = obj(user.friendship_status)
  const text = str(obj(record.caption).text)
  const fragments = Array.isArray(obj(info.text_fragments).fragments)
    ? (obj(info.text_fragments).fragments as unknown[])
    : []
  const links = new Set<string>()
  const mentions = new Set<string>()
  for (const fragment of fragments.map(obj)) {
    const uri = str(obj(fragment.link_fragment).uri)
    if (uri)
      links.add(unwrapLink(uri))
    const mention = str(obj(fragment.mention_fragment).mentioned_username)
    if (mention)
      mentions.add(mention.toLowerCase())
  }
  const preview = str(obj(info.link_preview_attachment).url)
  if (preview)
    links.add(unwrapLink(preview))
  for (const match of text.match(URL_PATTERN) ?? []) links.add(unwrapLink(match))
  const detection = str(obj(record.gen_ai_detection_method).detection_method)
  return {
    code: str(record.code),
    pk: str(record.pk),
    author: {
      pk: str(user.pk),
      username: str(user.username).toLowerCase(),
      fullName: str(user.full_name),
      bio: str(user.biography),
      isVerified: user.is_verified === true,
      isPrivate: user.text_post_app_is_private === true,
      following: friendship.following === true,
      followedBy: friendship.followed_by === true,
      country: null,
      ageMonths: null,
      followers: null,
      posts: null,
    },
    text,
    links: [...links],
    mentions: [...mentions],
    language: str(record.detected_language),
    hasAiLabel: detection !== '' && detection !== 'NONE',
    isPaidPartnership: record.is_paid_partnership === true,
    isReply: info.is_reply === true,
    replyToUsername: str(obj(info.reply_to_author).username) || null,
    rootAuthorUsername: str(obj(info.root_post_author).username) || null,
    counts: {
      likes: num(record.like_count),
      replies: num(info.direct_reply_count),
      reposts: num(info.repost_count),
      quotes: num(info.quote_count),
    },
    takenAt: num(record.taken_at),
    selfReplyLinks: [],
  }
}

function postInItem(item: unknown): Json | null {
  const value = obj(item)
  if (isPostRecord(value))
    return value
  const post = obj(value.post)
  return isPostRecord(post)
    ? post
    : null
}

export interface Capture { posts: Post[], users: SeenUser[] }

function seenUser(node: Json): SeenUser | null {
  if (typeof node.follower_count !== 'number' || typeof node.username !== 'string')
    return null
  const pk = str(node.pk) || str(node.id)
  return pk
    ? { pk, followers: node.follower_count }
    : null
}

function walk(root: unknown, visit: (node: Json) => void): void {
  const stack: unknown[] = [root]
  while (stack.length > 0) {
    const node = stack.pop()
    if (Array.isArray(node)) {
      for (const item of node) stack.push(item)
      continue
    }
    if (!isObject(node))
      continue
    visit(node)
    for (const value of Object.values(node)) {
      if (typeof value === 'object' && value !== null)
        stack.push(value)
    }
  }
}

function collectSelfReplies(threadItems: unknown[], into: Map<string, Set<string>>): void {
  const [head, ...rest] = threadItems.map(postInItem).filter((record): record is Json => record !== null)
  if (head === undefined)
    return
  const rootCode = str(head.code)
  const rootAuthor = str(obj(head.user).pk)
  for (const record of rest) {
    if (str(obj(record.user).pk) !== rootAuthor)
      continue
    const links = into.get(rootCode) ?? new Set<string>()
    for (const link of toPost(record).links) links.add(link)
    into.set(rootCode, links)
  }
}

export function extract(root: unknown): Capture {
  const posts = new Map<string, Post>()
  const users = new Map<string, number>()
  const selfReplyLinks = new Map<string, Set<string>>()
  walk(root, (node) => {
    if (isPostRecord(node)) {
      const post = toPost(node)
      if (post.code && !posts.has(post.code))
        posts.set(post.code, post)
    }
    const user = seenUser(node)
    if (user)
      users.set(user.pk, user.followers)
    if (Array.isArray(node.thread_items))
      collectSelfReplies(node.thread_items, selfReplyLinks)
  })
  for (const [code, links] of selfReplyLinks) {
    const post = posts.get(code)
    if (post)
      post.selfReplyLinks = [...links]
  }
  return {
    posts: [
      ...posts.values(),
    ],
    users: [...users].map(([pk, followers]) => ({ pk, followers })),
  }
}

const EMPTY: Capture = { posts: [], users: [] }

export function parsePayloadText(text: string): Capture {
  const body = stripGuard(text).trim()
  if (!body)
    return EMPTY
  try {
    return extract(JSON.parse(body))
  }
  catch {
    const documents: unknown[] = []
    for (const line of body.split('\n')) {
      try {
        documents.push(JSON.parse(line))
      }
      catch {
        continue
      }
    }
    return extract(documents)
  }
}

export function parseBootstrap(doc: Document): Capture {
  const documents: unknown[] = []
  for (const script of doc.querySelectorAll('script[type="application/json"]')) {
    const text = script.textContent ?? ''
    if (!text.includes('logging_info_token') && !text.includes('follower_count'))
      continue
    try {
      documents.push(JSON.parse(text))
    }
    catch {
      continue
    }
  }
  return extract(documents)
}
