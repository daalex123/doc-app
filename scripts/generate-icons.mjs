// Generates the PWA PNG icons (no dependencies). Run: node scripts/generate-icons.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const BG = [0x5a, 0x88, 0xc6];
const BG2 = [0x3f, 0x6c, 0xad];
const FG = [255, 255, 255];

function crc32(buf) {
  let c, crc = ~0;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return ~crc >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// Coverage tests in unit square [0,1]
const inRoundRect = (u, v, r) => {
  const dx = Math.max(Math.abs(u - 0.5) - (0.5 - r), 0);
  const dy = Math.max(Math.abs(v - 0.5) - (0.5 - r), 0);
  return dx * dx + dy * dy <= r * r;
};
const inCross = (u, v, scale) => {
  const arm = 0.11 * scale, len = 0.3 * scale;
  const dx = Math.abs(u - 0.5), dy = Math.abs(v - 0.5);
  return (dx <= arm && dy <= len) || (dy <= arm && dx <= len);
};

function icon(size, { rounded, crossScale }) {
  const S = 3;
  return png(size, (x, y) => {
    let bg = 0, fg = 0;
    for (let i = 0; i < S; i++)
      for (let j = 0; j < S; j++) {
        const u = (x + (i + 0.5) / S) / size, v = (y + (j + 0.5) / S) / size;
        if (!rounded || inRoundRect(u, v, 0.22)) {
          bg++;
          if (inCross(u, v, crossScale)) fg++;
        }
      }
    const n = S * S;
    const t = (x + y) / (2 * size);
    const base = BG.map((c, k) => c + (BG2[k] - c) * t);
    const a = bg / n;
    if (a === 0) return [0, 0, 0, 0];
    const f = fg / bg;
    return [0, 1, 2].map((k) => Math.round(base[k] * (1 - f) + FG[k] * f)).concat(Math.round(a * 255));
  });
}

mkdirSync("public/icons", { recursive: true });
writeFileSync("public/icons/icon-192.png", icon(192, { rounded: true, crossScale: 1 }));
writeFileSync("public/icons/icon-512.png", icon(512, { rounded: true, crossScale: 1 }));
// Maskable: full bleed, symbol kept inside the 80% safe zone.
writeFileSync("public/icons/icon-maskable-512.png", icon(512, { rounded: false, crossScale: 0.8 }));
// Apple touch icon: iOS rounds corners itself, so full bleed.
writeFileSync("src/app/apple-icon.png", icon(180, { rounded: false, crossScale: 0.9 }));
console.log("icons written");
