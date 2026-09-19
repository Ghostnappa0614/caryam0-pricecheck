// Draws the app icons (a manila price tag on navy) with no image libraries.
//   npm run icons
// Writes PNGs to public/icons/. Only needs re-running if you change the design.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../public/icons/', import.meta.url));
const NAVY = [22, 32, 43];
const MANILA = [242, 217, 139];
const EDGE = [201, 172, 85];
const INK = [59, 42, 5];

// ---- tiny PNG encoder ----
const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
const crc32 = (buf) => {
  let c = -1;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, pixel) {
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixel(x, y);
      const o = y * (size * 3 + 1) + 1 + x * 3;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- shapes in a 0..1 unit square (signed distance: < 0 is inside) ----
const box = (px, py, cx, cy, hw, hh, r) => {
  const qx = Math.abs(px - cx) - hw + r;
  const qy = Math.abs(py - cy) - hh + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
};
const circle = (px, py, cx, cy, r) => Math.hypot(px - cx, py - cy) - r;
const seg = (px, py, ax, ay, bx, by) => {
  const t = Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)));
  return Math.hypot(px - ax - t * (bx - ax), py - ay - t * (by - ay));
};

// The tag, rotated a little, with a pointed left end, a hole, and a "$".
function tagColor(u, v, scale) {
  const a = -0.35;
  const cx = 0.51, cy = 0.5;
  const x = (u - cx) * Math.cos(a) - (v - cy) * Math.sin(a);
  const y = (u - cx) * Math.sin(a) + (v - cy) * Math.cos(a);
  const s = scale;
  const body = box(x, y, 0.08 * s, 0, 0.26 * s, 0.19 * s, 0.04 * s);
  // pointed end: intersect two half-planes left of the body
  const tip = Math.max(-x - 0.37 * s + Math.abs(y), x + 0.1 * s);
  const shape = Math.min(body, Math.max(tip, Math.abs(y) - 0.19 * s));
  const hole = circle(x, y, -0.21 * s, 0, 0.045 * s);
  // "$": an S made of three bars and two short uprights, plus a vertical stroke
  const w = 0.028 * s;
  const sx = 0.08 * s, sh = 0.1 * s, sw = 0.075 * s;
  const dollar = Math.min(
    seg(x, y, sx - sw, -sh, sx + sw, -sh),
    seg(x, y, sx - sw, 0, sx + sw, 0),
    seg(x, y, sx - sw, sh, sx + sw, sh),
    seg(x, y, sx - sw, -sh, sx - sw, 0),
    seg(x, y, sx + sw, 0, sx + sw, sh),
    seg(x, y, sx, -sh - 0.05 * s, sx, sh + 0.05 * s),
  ) - w;

  if (shape > 0) return null;
  if (hole < 0) return NAVY;
  if (dollar < 0) return INK;
  if (shape > -0.012 * s || hole < 0.012 * s) return EDGE;
  return MANILA;
}

// 4x4 supersampling for smooth edges.
function render(size, scale) {
  return png(size, (px, py) => {
    const acc = [0, 0, 0];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const c = tagColor((px + (i + 0.5) / 4) / size, (py + (j + 0.5) / 4) / size, scale) || NAVY;
      acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2];
    }
    return acc.map((v) => Math.round(v / 16));
  });
}

for (const [name, size, scale] of [
  ['apple-touch-icon.png', 180, 1.1],
  ['icon-192.png', 192, 1.1],
  ['icon-512.png', 512, 1.1],
  ['icon-maskable-512.png', 512, 0.9], // smaller so it survives circle/squircle masks
]) {
  writeFileSync(OUT + name, render(size, scale));
  console.log('wrote icons/' + name);
}
