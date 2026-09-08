import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const SIZE = 192;
const SCALE = 4;
const WORK_SIZE = SIZE * SCALE;
const here = path.dirname(fileURLToPath(import.meta.url));
const output = path.resolve(here, "../src/common/icon.png");

const rgba = Buffer.alloc(WORK_SIZE * WORK_SIZE * 4, 0);

function setPixel(x, y, r, g, b, a = 255) {
  if (x < 0 || x >= WORK_SIZE || y < 0 || y >= WORK_SIZE) return;
  const i = (y * WORK_SIZE + x) * 4;
  rgba[i] = r;
  rgba[i + 1] = g;
  rgba[i + 2] = b;
  rgba[i + 3] = a;
}

function fillCanvas(color) {
  for (let y = 0; y < WORK_SIZE; y++) {
    for (let x = 0; x < WORK_SIZE; x++) setPixel(x, y, ...color);
  }
}

function fillCircle(cx, cy, radius, color) {
  const r2 = radius * radius;
  for (let y = cy - radius; y <= cy + radius; y++) {
    for (let x = cx - radius; x <= cx + radius; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) setPixel(x, y, ...color);
    }
  }
}

function fillRoundedRect(x, y, width, height, radius, color) {
  const right = x + width - 1;
  const bottom = y + height - 1;
  const r2 = radius * radius;
  for (let py = y; py <= bottom; py++) {
    for (let px = x; px <= right; px++) {
      const nx = px < x + radius ? x + radius : px > right - radius ? right - radius : px;
      const ny = py < y + radius ? y + radius : py > bottom - radius ? bottom - radius : py;
      const dx = px - nx;
      const dy = py - ny;
      if (dx * dx + dy * dy <= r2) setPixel(px, py, ...color);
    }
  }
}

function s(value) {
  return Math.round(value * SCALE);
}

fillCanvas([0, 0, 0, 255]);
fillCircle(s(96), s(96), s(76), [246, 248, 251, 255]);
fillRoundedRect(s(48), s(60), s(72), s(18), s(6), [91, 154, 222, 255]);
fillRoundedRect(s(48), s(87), s(88), s(18), s(6), [62, 124, 201, 255]);
fillRoundedRect(s(48), s(114), s(104), s(18), s(6), [43, 96, 174, 255]);

const downsampled = Buffer.alloc(SIZE * SIZE * 4, 0);
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    let r = 0;
    let g = 0;
    let b = 0;
    let a = 0;
    for (let oy = 0; oy < SCALE; oy++) {
      for (let ox = 0; ox < SCALE; ox++) {
        const i = (((y * SCALE + oy) * WORK_SIZE) + (x * SCALE + ox)) * 4;
        r += rgba[i];
        g += rgba[i + 1];
        b += rgba[i + 2];
        a += rgba[i + 3];
      }
    }
    const count = SCALE * SCALE;
    const o = (y * SIZE + x) * 4;
    downsampled[o] = Math.round(r / count);
    downsampled[o + 1] = Math.round(g / count);
    downsampled[o + 2] = Math.round(b / count);
    downsampled[o + 3] = Math.round(a / count);
  }
}

const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
for (let y = 0; y < SIZE; y++) {
  const row = y * (SIZE * 4 + 1);
  raw[row] = 0;
  downsampled.copy(raw, row + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data = Buffer.alloc(0)) {
  const name = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])), 0);
  return Buffer.concat([length, name, data, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8;
ihdr[9] = 6;
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk("IHDR", ihdr),
  chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
  chunk("IEND")
]);

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, png);
console.log(`generated ${output}: ${png.length} bytes, ${SIZE}x${SIZE} RGBA`);
