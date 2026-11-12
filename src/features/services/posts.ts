import { POSTS_EVENT } from '../../bridge'
import type { Post } from '../../model'
import type { PostStream } from '../api'

export class PostCatalog implements PostStream {
  #posts = new Map<string, Post>()
  #listeners = new Set<(posts: Post[]) => void>()

  constructor(win: Window) {
    win.addEventListener(POSTS_EVENT, (event) => {
      let posts: Post[]
      try {
        posts = JSON.parse(String((event as CustomEvent).detail))
      } catch {
        return
      }
      this.add(posts)
    })
  }

  add(posts: Post[]): void {
    for (const post of posts) this.#posts.set(post.code, post)
    for (const listener of this.#listeners) listener(posts)
  }

  get(code: string): Post | undefined {
    return this.#posts.get(code)
  }

  subscribe(listener: (posts: Post[]) => void, signal: AbortSignal): void {
    this.#listeners.add(listener)
    signal.addEventListener('abort', () => this.#listeners.delete(listener), { once: true })
    if (this.#posts.size > 0) listener([...this.#posts.values()])
  }
}
