interface RawInput {
  code: string
  pk?: string
  username?: string
  userPk?: string
  text?: string | null
  fragments?: unknown[]
  preview?: string
  detection?: string
  isReply?: boolean
  following?: boolean
}

export function rawPost(input: RawInput) {
  return {
    code: input.code,
    pk: input.pk ?? `pk-${input.code}`,
    taken_at: 1_760_000_000,
    like_count: 5,
    detected_language: 'zh-tw',
    is_paid_partnership: false,
    logging_info_token: 'token',
    gen_ai_detection_method: { detection_method: input.detection ?? 'NONE' },
    caption: input.text === null
      ? null
      : { text: input.text ?? 'hello world', pk: '1' },
    user: {
      pk: input.userPk ?? '900',
      id: input.userPk ?? '900',
      username: input.username ?? 'Writer',
      full_name: 'A Writer',
      biography: 'bio',
      is_verified: false,
      text_post_app_is_private: false,
      friendship_status: {
        following: input.following ?? false,
        followed_by: false,
        muting: false,
        blocking: false,
      },
    },
    text_post_app_info: {
      is_reply: input.isReply ?? false,
      reply_to_author: input.isReply
        ? { username: 'parent', id: '1' }
        : null,
      root_post_author: null,
      direct_reply_count: 2,
      repost_count: 1,
      quote_count: 0,
      link_preview_attachment: input.preview
        ? { url: input.preview }
        : null,
      text_fragments: { fragments: input.fragments ?? [] },
    },
  }
}

export function feedPayload(items: unknown[][]) {
  return {
    data: {
      feedData: {
        edges: items.map(thread => ({
          node: {
            text_post_app_thread: {
              thread_items: thread.map(post => ({ post })),
            },
          },
        })),
      },
    },
    extensions: { is_final: true },
  }
}
