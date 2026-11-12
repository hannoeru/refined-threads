import { describe, expect, it } from 'vitest'
import { defaultRow, fromForm, operatorsFor, toForm } from '../ruleForm'

describe('rule form', () => {
  it('round-trips a flat rule through the form', () => {
    const condition = { all: [{ field: 'text' as const, contains_any: ['free', 'gift'] }, { field: 'author.followers' as const, lt: 10 }] }
    const form = toForm(condition)
    expect(form).toEqual({
      match: 'all',
      rows: [
        { field: 'text', operator: 'contains_any', value: 'free, gift' },
        { field: 'author.followers', operator: 'lt', value: '10' },
      ],
    })
    expect(fromForm(form!)).toEqual(condition)
  })

  it('cannot show nested conditions as a form', () => {
    expect(toForm({ all: [{ not: { field: 'isReply', is: true } }] })).toBeNull()
  })

  it('rejects rows with empty values, bad numbers, or bad patterns', () => {
    expect(fromForm({ match: 'any', rows: [{ field: 'text', operator: 'contains_any', value: ' , ' }] })).toBeNull()
    expect(fromForm({ match: 'any', rows: [{ field: 'author.posts', operator: 'gt', value: 'many' }] })).toBeNull()
    expect(fromForm({ match: 'any', rows: [{ field: 'text', operator: 'matches', value: '(' }] })).toBeNull()
    expect(fromForm({ match: 'any', rows: [] })).toBeNull()
  })

  it('stores yes/no fields as booleans and site lists in lower case', () => {
    expect(fromForm({ match: 'all', rows: [{ field: 'isReply', operator: 'is', value: 'false' }] })).toEqual({ all: [{ field: 'isReply', is: false }] })
    expect(fromForm({ match: 'all', rows: [{ field: 'links', operator: 'host_in', value: 'Shopee.TW、amzn.to' }] })).toEqual({
      all: [{ field: 'links', host_in: ['shopee.tw', 'amzn.to'] }],
    })
  })

  it('offers operators that fit each field', () => {
    expect(operatorsFor('author.posts')).toEqual(['gt', 'lt'])
    expect(operatorsFor('author.isVerified')).toEqual(['is'])
    expect(operatorsFor('links')[0]).toBe('host_in')
    expect(defaultRow('isReply')).toEqual({ field: 'isReply', operator: 'is', value: 'true' })
  })
})
