import type { Post, PresetId } from '../model'
import { hostMatches, linkHost } from './hosts'

export type PresetContext = { copies: number }

export type Preset = { id: PresetId; weight: number; test: (post: Post, ctx: PresetContext) => boolean }

export const AFFILIATE_HOSTS = [
  'shopee.tw',
  'shopee.com',
  'shopee.sg',
  'shopee.com.my',
  'shopee.ph',
  'shopee.co.id',
  'shopee.vn',
  'shopee.co.th',
  'shopee.com.br',
  'shp.ee',
  'amzn.to',
  'amzn.asia',
  'a.co',
  'a.r10.to',
  'hb.afl.rakuten.co.jp',
  'af.moshimo.com',
  'momo.dm',
  's.click.aliexpress.com',
  's.click.taobao.com',
]

export const BAIT_PHRASES = [
  'comment +1',
  'comment "yes"',
  'drop a 🔥',
  'link in bio',
  'link in my bio',
  'dm me for',
  'dm me the word',
  '留言+1',
  '留言 +1',
  '私訊我',
  '私我拿',
  '想要的留言',
  '連結在留言',
  '連結放留言',
  '連結在首頁',
  'コメントで',
  'プロフのリンク',
  '固定ポストから',
]

const GENERATED_NAME = [/^[a-z._]+\d{4,}$/, /^[a-z0-9]+(?:[._][a-z0-9]+){2,}\d+$/]

const allLinks = (post: Post): string[] => [...post.links, ...post.selfReplyLinks]

export const PRESETS: Record<PresetId, Preset> = {
  'affiliate-links': {
    id: 'affiliate-links',
    weight: 3,
    test: (post) =>
      allLinks(post).some((link) => {
        const host = linkHost(link)
        return host !== null && AFFILIATE_HOSTS.some((affiliate) => hostMatches(host, affiliate))
      }),
  },
  'engagement-bait': {
    id: 'engagement-bait',
    weight: 3,
    test: (post) => {
      const text = post.text.toLowerCase()
      return BAIT_PHRASES.some((phrase) => text.includes(phrase))
    },
  },
  'copy-paste-replies': {
    id: 'copy-paste-replies',
    weight: 3,
    test: (post, ctx) => post.isReply && ctx.copies >= 3,
  },
  'ai-label': {
    id: 'ai-label',
    weight: 3,
    test: (post) => post.hasAiLabel,
  },
  'generated-names': {
    id: 'generated-names',
    weight: 1,
    test: (post) => !post.author.isVerified && GENERATED_NAME.some((pattern) => pattern.test(post.author.username)),
  },
  'strangers-in-replies': {
    id: 'strangers-in-replies',
    weight: 1,
    test: (post) =>
      post.isReply &&
      !post.author.following &&
      !post.author.followedBy &&
      (post.links.length > 0 || post.mentions.length > 0),
  },
}
