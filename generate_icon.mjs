// Generates a crisp multi-resolution Windows .ico file for Iron Veil: Blood Circuit
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

function createIconBitmap(size) {
  const w = size, h = size;
  const pixels = new Uint8Array(w * h * 4); // BGRA

  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  const rOuter = (w / 2) * 0.92;
  const rRing = (w / 2) * 0.76;
  const rInner = (w / 2) * 0.62;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // BMP is stored bottom-up
      const bmpY = h - 1 - y;
      const idx = (bmpY * w + x) * 4;

      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);

      let b = 10, g = 9, r = 8, a = 0;

      // Dark background shield circle
      if (dist <= rOuter) {
        a = 255;
        // Deep obsidian metal base
        const grad = (y / h) * 20;
        b = 16 + grad; g = 14 + grad; r = 12 + grad;

        // Outer crimson border
        if (dist >= rOuter - 2) {
          r = 255; g = 58; b = 58;
        } else if (dist >= rRing - 1.5 && dist <= rRing + 1.5) {
          // Inner silver ring
          r = 200; g = 206; b = 217;
        }

        // Circuit ticks (24 ticks around the perimeter)
        if (dist >= rInner && dist <= rOuter - 3) {
          const tickIdx = Math.round(((angle + Math.PI) / (Math.PI * 2)) * 24) % 24;
          const tickAngle = ((tickIdx / 24) * Math.PI * 2) - Math.PI;
          const angleDiff = Math.abs(angle - tickAngle);
          if (angleDiff < 0.08) {
            if (tickIdx % 3 === 0) {
              // Glowing crimson pulse tick
              r = 255; g = 58; b = 58;
            } else {
              // Steel tick
              r = 138; g = 146; b = 163;
            }
          }
        }

        // Center stylized eye / diamond blade
        const normX = dx / rInner;
        const normY = dy / rInner;

        // Eye curve: |y| <= 0.5 * (1 - normX^2)
        const eyeBound = 0.55 * (1 - normX * normX);
        if (Math.abs(normX) <= 1 && Math.abs(normY) <= eyeBound) {
          // Eye rim
          if (Math.abs(normY) >= eyeBound - 0.12) {
            r = 255; g = 255; b = 255; // White eye rim
          } else {
            // Inside eye: glowing core
            const coreDist = Math.hypot(dx, dy);
            if (coreDist <= rInner * 0.35) {
              // Crimson pupil / diamond
              r = 255; g = 40; b = 40;
            } else {
              r = 25; g = 20; b = 28;
            }
          }
        }
      }

      pixels[idx] = Math.min(255, Math.max(0, Math.round(b)));
      pixels[idx + 1] = Math.min(255, Math.max(0, Math.round(g)));
      pixels[idx + 2] = Math.min(255, Math.max(0, Math.round(r)));
      pixels[idx + 3] = a;
    }
  }

  // 1-bit mask (padded to 32 bits per row)
  const maskRowBytes = Math.ceil(w / 32) * 4;
  const mask = new Uint8Array(maskRowBytes * h); // all zeros because 32-bit alpha is used

  return { w, h, pixels, mask };
}

function buildIco(sizes = [64, 48, 32, 16]) {
  const images = sizes.map(createIconBitmap);
  const headerSize = 6;
  const entrySize = 16;
  const totalEntriesSize = entrySize * images.length;

  let currentOffset = headerSize + totalEntriesSize;
  const entries = [];
  const imageBuffers = [];

  for (const img of images) {
    const biSize = 40;
    const biWidth = img.w;
    const biHeight = img.h * 2; // doubled for icon
    const biPlanes = 1;
    const biBitCount = 32;
    const biCompression = 0;
    const biSizeImage = img.pixels.length;

    const bmpHeader = Buffer.alloc(40);
    bmpHeader.writeUInt32LE(biSize, 0);
    bmpHeader.writeInt32LE(biWidth, 4);
    bmpHeader.writeInt32LE(biHeight, 8);
    bmpHeader.writeUInt16LE(biPlanes, 12);
    bmpHeader.writeUInt16LE(biBitCount, 14);
    bmpHeader.writeUInt32LE(biCompression, 16);
    bmpHeader.writeUInt32LE(biSizeImage, 20);
    bmpHeader.writeInt32LE(0, 24);
    bmpHeader.writeInt32LE(0, 28);
    bmpHeader.writeUInt32LE(0, 32);
    bmpHeader.writeUInt32LE(0, 36);

    const fullImgData = Buffer.concat([
      bmpHeader,
      Buffer.from(img.pixels),
      Buffer.from(img.mask)
    ]);

    imageBuffers.push(fullImgData);

    const entry = Buffer.alloc(16);
    entry.writeUInt8(img.w >= 256 ? 0 : img.w, 0);
    entry.writeUInt8(img.h >= 256 ? 0 : img.h, 1);
    entry.writeUInt8(0, 2); // colors
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // planes
    entry.writeUInt16LE(32, 6); // bpp
    entry.writeUInt32LE(fullImgData.length, 8); // size
    entry.writeUInt32LE(currentOffset, 12); // offset

    entries.push(entry);
    currentOffset += fullImgData.length;
  }

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // icon type
  header.writeUInt16LE(images.length, 4); // count

  return Buffer.concat([header, ...entries, ...imageBuffers]);
}

const icoBuffer = buildIco([64, 48, 32, 16]);
const root = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
writeFileSync(join(root, 'icon.ico'), icoBuffer);
console.log('Generated icon.ico successfully (' + icoBuffer.length + ' bytes)');
