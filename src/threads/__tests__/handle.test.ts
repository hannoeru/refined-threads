import { describe, expect, it } from 'vitest'
import { handleFromUrl, parseHandle } from '../handle'

describe('handles', () => {
  it('reads a handle from a profile link, a post link, or typed text', () => {
    expect(handleFromUrl('https://www.threads.com/@Amy.Lin')).toBe('amy.lin')
    expect(handleFromUrl('https://www.threads.net/@amy/post/ABC')).toBe('amy')
    expect(handleFromUrl('https://www.threads.com/search')).toBeNull()
    expect(parseHandle('@Bob_1')).toBe('bob_1')
    expect(parseHandle('https://threads.com/@bob')).toBe('bob')
    expect(parseHandle('not a handle!')).toBeNull()
  })
})
