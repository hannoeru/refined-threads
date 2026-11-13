import { Buffer } from 'node:buffer'
import { mkdir } from 'node:fs/promises'
import process from 'node:process'
import sharp from 'sharp'

const [source = 'assets/icon/source.png', outDir = 'public/icon'] = process.argv.slice(2)
const SIZES = [16, 32, 48, 128]

await mkdir(outDir, { recursive: true })
const square = await sharp(source).trim({ threshold: 40 }).toBuffer()

for (const size of SIZES) {
  const radius = Math.round(size * 0.22)
  const mask = Buffer.from(`<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${radius}" ry="${radius}"/></svg>`)
  await sharp(square)
    .resize(size, size, {
      fit: 'cover',
      kernel: size <= 32
        ? 'lanczos3'
        : 'mitchell',
    })
    .ensureAlpha()
    .composite([
      { input: mask, blend: 'dest-in' },
    ])
    .png()
    .toFile(`${outDir}/${size}.png`)
}
console.log(`wrote ${SIZES.map(size => `${outDir}/${size}.png`).join(', ')}`)
