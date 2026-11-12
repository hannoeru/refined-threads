import type { Post, PostAuthor } from '../model'

type PostInput = Partial<Omit<Post, 'author' | 'counts'>> & {
  author?: { [K in keyof PostAuthor]?: PostAuthor[K] }
  counts?: Partial<Post['counts']>
}

export function makePost(input: PostInput = {}): Post {
  const { author, counts, ...rest } = input
  return {
    code: 'C0DE',
    pk: '1',
    text: 'Just a normal post about my day.',
    links: [],
    mentions: [],
    language: 'en',
    hasAiLabel: false,
    isPaidPartnership: false,
    isReply: false,
    replyToUsername: null,
    rootAuthorUsername: null,
    takenAt: 1_700_000_000,
    selfReplyLinks: [],
    ...rest,
    author: {
      pk: '100',
      username: 'someone',
      fullName: 'Some One',
      bio: '',
      isVerified: false,
      isPrivate: false,
      following: false,
      followedBy: false,
      country: null,
      ageMonths: null,
      followers: null,
      posts: null,
      ...author,
    },
    counts: { likes: 0, replies: 0, reposts: 0, quotes: 0, ...counts },
  }
}
