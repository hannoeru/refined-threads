#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: import.meta.dirname, encoding: 'utf8' }).trim()
const store = join(root, 'store/chrome')
const hashFile = join(store, 'sources.json')
const read = path => readFileSync(join(root, path))

const LOCALES = ['en', 'zh_TW']
const SPAM = ['src/features/spam-filter/Settings.vue', 'entrypoints/options/App.vue', 'src/ui/base.css', 'src/ui/components/Toggle.vue']
const MOCK = ['store/chrome/src/i18n.js']
const PER_LOCALE = {
  '0-feed.png': { size: [1280, 800], sources: [...MOCK, 'store/chrome/src/feed-shot.html', 'src/features/spam-filter/view.ts', 'src/features/account-info/index.ts', 'src/features/keyboard-navigation/index.ts'] },
  '1-features.png': { size: [1280, 800], sources: ['entrypoints/options/App.vue', 'src/ui/base.css', 'src/ui/components/Toggle.vue', 'src/features/registry.ts'] },
  '2-protection.png': { size: [1280, 800], sources: [...SPAM, 'src/features/spam-filter/settings/Protection.vue', 'src/ui/components/LevelPicker.vue', 'src/ui/components/EffectPicker.vue'] },
  '3-lists.png': { size: [1280, 800], sources: [...SPAM, 'src/features/spam-filter/settings/Lists.vue', 'src/ui/components/ChipInput.vue'] },
  '4-welcome.png': { size: [1280, 800], sources: ['entrypoints/welcome/App.vue', 'src/ui/base.css', 'src/ui/components/LevelPicker.vue'] },
  '5-popup.png': { size: [1280, 800], sources: [...MOCK, 'store/chrome/src/popup-shot.html', 'entrypoints/popup/App.vue', 'src/ui/base.css', 'src/ui/components/LevelPicker.vue', 'src/ui/components/Toggle.vue'] },
  'promo-tile-440x280.png': { size: [440, 280], sources: [...MOCK, 'store/chrome/src/promo-tile.html', 'public/icon/128.png'] },
}
const IMAGES = {
  ...Object.fromEntries(LOCALES.flatMap(code => Object.entries(PER_LOCALE).map(([name, image]) => [`${code}/${name}`, image]))),
  '../edge/logo-300x300.png': { size: [300, 300], sources: ['assets/icon/source.png'] },
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

const summary = readFileSync(join(root, 'store/firefox/listing.md'), 'utf8').split('**Summary**')[1]?.split('```')[1]?.trim() ?? ''
if (summary.length === 0 || [...summary].length > 250)
  problems.push(`store/firefox/listing.md: the summary has ${[...summary].length} characters, it needs 1 to 250`)

const feedText = JSON.parse(read('store/chrome/src/feed-shot.html').toString().match(/<script type="application\/json" id="text">([\s\S]*?)<\/script>/)[1])
for (const code of LOCALES) {
  const messages = locale(code)
  const text = feedText[code]
  if (!text) {
    problems.push(`feed-shot.html: no text for ${code}`)
    continue
  }
  const reasons = new Set(Object.entries(messages).filter(([key]) => key.startsWith('reason_')).map(([, value]) => value.message))
  const hiddenPrefix = messages.bar_hidden.message.replace('$VALUE$', '')
  for (const key of ['bar1', 'bar2']) {
    if (!text[key].startsWith(hiddenPrefix)) {
      problems.push(`feed-shot.html (${code}): ${key} "${text[key]}" does not start with "${hiddenPrefix}"`)
      continue
    }
    for (const reason of text[key].slice(hiddenPrefix.length).split(', ')) {
      if (!reasons.has(reason))
        problems.push(`feed-shot.html (${code}): reason "${reason}" is not a reason_* text in the ${code} locale`)
    }
  }
  for (const [key, message] of [['show', 'bar_show'], ['followsYou', 'feature_account_info_follows_you']]) {
    if (text[key] !== messages[message].message)
      problems.push(`feed-shot.html (${code}): ${key} "${text[key]}" is not the ${message} text "${messages[message].message}"`)
  }
}

if (problems.length > 0) {
  console.log(problems.map(problem => `✗ ${problem}`).join('\n'))
  process.exit(1)
}
console.log('✓ store/ matches the code')
