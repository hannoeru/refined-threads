import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { FEATURES } from '../features/registry'

const root = join(__dirname, '..', '..')
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('feature docs', () => {
  const readme = read('README.md')

  it.each(FEATURES.map(feature => [feature.id, feature.enabledByDefault] as const))('%s has a page that states its default, and the README links to it', (id, enabledByDefault) => {
    const page = read(`docs/features/${id}.md`)
    const header = page.split('\n').find(line => line.startsWith('**ID**'))
    expect(header).toContain(`\`${id}\``)
    expect(header).toContain(enabledByDefault ? '**On by default**' : '**Off by default**')
    expect(readme).toContain(`(docs/features/${id}.md)`)
  })

  it('has no page for a feature that does not exist', () => {
    const pages = readdirSync(join(root, 'docs/features')).map(name => name.replace(/\.md$/, ''))
    expect(pages.sort()).toEqual(FEATURES.map(feature => feature.id).sort())
  })
})
