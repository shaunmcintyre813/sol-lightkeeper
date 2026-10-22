import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const out = new URL('../dist/icons/', import.meta.url);
await mkdir(out, { recursive: true });
const clamp = value => Math.max(0, Math.min(255, Math.round(value)));
const blend = (a, b, t) => a + (b - a) * Math.max(0, Math.min(1, t));

let crcTable = null;
function crc32(data) {
  crcTable ??= Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  let crc = 0xffffffff;
  for (const byte of data) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type);
  const head = Buffer.alloc(4); head.writeUInt32BE(data.length);
  const tail = Buffer.alloc(4); tail.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([head, name, data, tail]);
}
function color(x, y) {
  const dx = x - .5, dy = y - .5;
  const distance = Math.hypot(dx, dy);
  const glow = Math.max(0, 1 - distance * 1.7);
  let r = blend(12, 30, glow), g = blend(27, 62, glow), b = blend(43, 66, glow);
  // A small, warm sun sits safely inside an Android maskable icon's crop.
  const sun = Math.hypot(dx, dy);
  const halo = Math.max(0, 1 - sun / .36);
  r += halo * 38; g += halo * 23; b += halo * 5;
  const rayAngle = Math.atan2(dy, dx);
  const spoke = Math.pow(Math.max(0, Math.cos(rayAngle * 8)), 24);
  if (sun > .205 && sun < .27 + spoke * .04) {
    const edge = Math.max(0, 1 - Math.abs(sun - .233) / (.025 + spoke * .035));
    r = blend(r, 248, edge); g = blend(g, 193, edge); b = blend(b, 112, edge);
  }
  if (sun < .205) {
    const t = Math.min(1, sun / .205);
    r = blend(255, 232, t); g = blend(243, 157, t); b = blend(193, 91, t);
  }
  for (const [sx, sy, radius] of [[.17,.2,.008],[.79,.22,.006],[.8,.77,.009],[.2,.78,.005]]) {
    const star = Math.max(0, 1 - Math.hypot(x - sx, y - sy) / radius);
    r = blend(r, 255, star); g = blend(g, 231, star); b = blend(b, 182, star);
  }
  return [clamp(r), clamp(g), clamp(b), 255];
}
function png(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1); raw[row] = 0;
    for (let x = 0; x < size; x++) {
      const pixel = color((x + .5) / size, (y + .5) / size);
      for (let channel = 0; channel < 4; channel++) raw[row + 1 + x * 4 + channel] = pixel[channel];
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4);
  header[8] = 8; header[9] = 6;
  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    chunk('IHDR', header), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}
for (const [name, size] of [['icon-192.png',192],['icon-512.png',512],['apple-touch-icon.png',180]]) {
  await writeFile(new URL(name, out), png(size));
}
