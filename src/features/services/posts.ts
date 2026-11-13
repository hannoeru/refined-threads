import type { Post } from '../../model'
import type { PostStream } from '../api'
import { POSTS_EVENT } from '../../bridge'

export class PostCatalog implements PostStream {
  #posts = new Map<string, Post>()
  #listeners = new Set<(posts: Post[]) => void>()

  constructor(win: Window) {
    win.addEventListener(POSTS_EVENT, (event) => {
      let posts: Post[]
      try {
        posts = JSON.parse(String((event as CustomEvent).detail))
      }
      catch {
        return
      }
      this.add(posts)
    })
  }

  add(posts: Post[]): void {
    const merged = posts.map((post) => {
      const known = this.#posts.get(post.code)?.selfReplyLinks ?? []
      const next = known.length > 0
        ? {
            ...post,
            selfReplyLinks: [
              ...new Set([
                ...known,
                ...post.selfReplyLinks,
              ]),
            ],
          }
        : post
      this.#posts.set(post.code, next)
      return next
    })
    for (const listener of this.#listeners) listener(merged)
  }

  get(code: string): Post | undefined {
    return this.#posts.get(code)
  }

  subscribe(listener: (posts: Post[]) => void, signal: AbortSignal): void {
    this.#listeners.add(listener)
    signal.addEventListener('abort', () => this.#listeners.delete(listener), { once: true })
    if (this.#posts.size > 0) {
      listener([
        ...this.#posts.values(),
      ])
    }
  }
}
