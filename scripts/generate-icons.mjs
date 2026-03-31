/**
 * Generates minimal solid-color PNG icons using only Node.js built-ins.
 * Run once: node scripts/generate-icons.mjs
 */
import { deflateSync } from 'zlib'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const assetsDir = join(__dirname, '..', 'src', 'assets')
mkdirSync(assetsDir, { recursive: true })

// CRC32 lookup table
const crcTable = new Uint32Array(256)
for (let i = 0; i < 256; i++) {
  let c = i
  for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  crcTable[i] = c
}
function crc32(buf) {
  let crc = 0xffffffff
  for (const b of buf) crc = crcTable[(crc ^ b) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const t = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const crcVal = Buffer.alloc(4); crcVal.writeUInt32BE(crc32(Buffer.concat([t, data])))
  return Buffer.concat([len, t, data, crcVal])
}

function makePng(size, r, g, b) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

  const ihdrData = Buffer.alloc(13)
  ihdrData.writeUInt32BE(size, 0)
  ihdrData.writeUInt32BE(size, 4)
  ihdrData[8] = 8   // bit depth
  ihdrData[9] = 2   // color type: RGB
  const ihdr = chunk('IHDR', ihdrData)

  // Build raw scanlines: each row = filter byte (0) + RGB pixels
  const raw = Buffer.alloc((1 + size * 3) * size)
  let off = 0
  for (let y = 0; y < size; y++) {
    raw[off++] = 0  // filter: None
    for (let x = 0; x < size; x++) {
      raw[off++] = r; raw[off++] = g; raw[off++] = b
    }
  }
  const idat = chunk('IDAT', deflateSync(raw))
  const iend = chunk('IEND', Buffer.alloc(0))

  return Buffer.concat([sig, ihdr, idat, iend])
}

// Blue: #4A90E2
const [r, g, b] = [0x4a, 0x90, 0xe2]

for (const size of [16, 48, 128]) {
  const out = join(assetsDir, `icon-${size}.png`)
  writeFileSync(out, makePng(size, r, g, b))
  console.log(`Generated ${out}`)
}
