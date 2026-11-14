#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: import.meta.dirname, encoding: 'utf8' }).trim()
const store = join(root, 'store/chrome')
const hashFile = join(store, 'sources.json')
const read = path => readFileSync(join(root, path))

const SPAM = ['src/features/spam-filter/Settings.vue', 'entrypoints/options/App.vue', 'src/ui/base.css', 'src/ui/components/Toggle.vue']
const IMAGES = {
  'screenshots/0-feed.png': { size: [1280, 800], sources: ['store/chrome/src/feed-shot.html', 'src/features/spam-filter/view.ts', 'src/features/account-info/index.ts', 'src/features/keyboard-navigation/index.ts'] },
  'screenshots/1-features.png': { size: [1280, 800], sources: ['entrypoints/options/App.vue', 'src/ui/base.css', 'src/ui/components/Toggle.vue', 'src/features/registry.ts'] },
  'screenshots/2-protection.png': { size: [1280, 800], sources: [...SPAM, 'src/features/spam-filter/settings/Protection.vue', 'src/ui/components/LevelPicker.vue', 'src/ui/components/EffectPicker.vue'] },
  'screenshots/3-lists.png': { size: [1280, 800], sources: [...SPAM, 'src/features/spam-filter/settings/Lists.vue', 'src/ui/components/ChipInput.vue'] },
  'screenshots/4-welcome.png': { size: [1280, 800], sources: ['entrypoints/welcome/App.vue', 'src/ui/base.css', 'src/ui/components/LevelPicker.vue'] },
  'screenshots/5-popup.png': { size: [1280, 800], sources: ['store/chrome/src/popup-shot.html', 'entrypoints/popup/App.vue', 'src/ui/base.css', 'src/ui/components/LevelPicker.vue', 'src/ui/components/Toggle.vue'] },
  'promo-tile-440x280.png': { size: [440, 280], sources: ['store/chrome/src/promo-tile.html', 'public/icon/128.png'] },
}

const problems = []
const hashOf = sources => createHash('sha256').update(sources.map(path => read(path)).reduce((all, file) => Buffer.concat([all, file]), Buffer.alloc(0))).digest('hex').slice(0, 16)
const current = Object.fromEntries(Object.entries(IMAGES).map(([image, { sources }]) => [image, hashOf(sources)]))

if (process.argv.includes('--update')) {
  writeFileSync(hashFile, `${JSON.stringify(current, null, 2)}\n`)
  console.log(`Recorded source hashes in ${hashFile}`)
}

const recorded = existsSync(hashFile) ? JSON.parse(readFileSync(hashFile, 'utf8')) : {}
for (const [image, { size, sources }] of Object.entries(IMAGES)) {
  const path = join(store, image)
  if (!existsSync(path)) {
    problems.push(`${image}: missing`)
    continue
  }
  const png = readFileSync(path)
  const [width, height] = [png.readUInt32BE(16), png.readUInt32BE(20)]
  if (width !== size[0] || height !== size[1])
    problems.push(`${image}: ${width}×${height}, needs ${size[0]}×${size[1]}`)
  if (recorded[image] !== current[image])
    problems.push(`${image}: stale, a source changed (${sources.join(', ')})`)
}

const locale = name => JSON.parse(read(`public/_locales/${name}/messages.json`))
const en = locale('en')
const zh = locale('zh_TW')
for (const [name, messages] of [['en', en], ['zh_TW', zh]]) {
  const length = [...messages.extDescription.message].length
  if (length > 132)
    problems.push(`extDescription (${name}): ${length} characters, the store allows 132`)
}

const listing = readFileSync(join(store, 'listing.md'), 'utf8')
const section = heading => listing.split(heading)[1]?.split('```')[1] ?? ''
const features = execFileSync('git', ['ls-files', 'src/features/*/index.ts'], { cwd: root, encoding: 'utf8' }).trim().split('\n').map(path => path.split('/')[2].replaceAll('-', '_'))
for (const [heading, messages] of [['### Description (English)', en], ['### Description (Traditional Chinese)', zh]]) {
  const text = section(heading).toLowerCase()
  for (const id of features) {
    const name = messages[`feature_${id}_name`]?.message
    if (name && !text.includes(name.toLowerCase()))
      problems.push(`listing.md ${heading.slice(4)}: feature "${name}" is not named`)
  }
}

const feed = read('store/chrome/src/feed-shot.html').toString()
const reasons = new Set(Object.entries(en).filter(([key]) => key.startsWith('reason_')).map(([, value]) => value.message))
const hiddenPrefix = en.bar_hidden.message.replace('$VALUE$', '')
for (const [, text] of feed.matchAll(/class="rt-bar-text">([^<]+)</g)) {
  if (!text.startsWith(hiddenPrefix)) {
    problems.push(`feed-shot.html: bar "${text}" does not start with "${hiddenPrefix}"`)
    continue
  }
  for (const reason of text.slice(hiddenPrefix.length).split(', ')) {
    if (!reasons.has(reason))
      problems.push(`feed-shot.html: reason "${reason}" is not a reason_* text in the en locale`)
  }
}

if (problems.length > 0) {
  console.log(problems.map(problem => `✗ ${problem}`).join('\n'))
  process.exit(1)
}
console.log('✓ store/chrome matches the code')
