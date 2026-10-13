/**
 * Writing a PNG without a dependency.
 *
 * The repo is deliberately dependency-free: a design-system repo that needs an
 * npm install before it can produce an asset does not get run. That holds for
 * raster too, and a PNG is a short format — a header chunk, one deflate stream
 * of filtered scanlines, an end chunk — so writing one is cheaper than taking
 * on an image library.
 *
 * Truecolor, 8 bits a channel, no interlacing, filter 0 on every row. Nothing
 * here needs a palette or an alpha channel: a background is opaque by
 * definition, and the compression that matters on a smooth gradient comes from
 * deflate, not from the filter.
 */
import { deflateSync } from 'node:zlib';

const CRC = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const head = Buffer.alloc(4);
  head.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([head, body, tail]);
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/**
 * Encode an RGB pixel buffer as a PNG.
 *
 * @param {number} width
 * @param {number} height
 * @param {Buffer} rgb  width * height * 3 bytes, row-major.
 * @returns {Buffer}
 */
export function encodePng(width, height, rgb) {
  if (rgb.length !== width * height * 3) {
    throw new Error(`expected ${width * height * 3} bytes of RGB, got ${rgb.length}`);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // truecolor
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  const stride = width * 3;
  const raw = Buffer.alloc(height * (stride + 1));
  const prev = Buffer.alloc(stride);
  const cur = Buffer.alloc(stride);
  const trial = Buffer.alloc(stride);

  for (let y = 0; y < height; y++) {
    rgb.copy(cur, 0, y * stride, (y + 1) * stride);

    /* Pick a filter per row, by the usual heuristic: whichever leaves the
       smallest absolute sum compresses best, because deflate is looking for
       runs of near-zero. This is the whole difference between a 1920-wide
       gradient at 300 KB and the same gradient at 3 MB, and it is why the
       encoder bothers with five filters instead of writing zeroes. */
    let bestType = 0;
    let bestScore = Infinity;
    let best = null;
    for (let type = 0; type < 5; type++) {
      let score = 0;
      for (let i = 0; i < stride; i++) {
        const a = i >= 3 ? cur[i - 3] : 0;   // left
        const b = prev[i];                   // above
        const c = i >= 3 ? prev[i - 3] : 0;  // above-left
        let v;
        if (type === 0) v = cur[i];
        else if (type === 1) v = cur[i] - a;
        else if (type === 2) v = cur[i] - b;
        else if (type === 3) v = cur[i] - ((a + b) >> 1);
        else v = cur[i] - paeth(a, b, c);
        v &= 0xff;
        trial[i] = v;
        score += v < 128 ? v : 256 - v;
      }
      if (score < bestScore) {
        bestScore = score;
        bestType = type;
        best = Buffer.from(trial);
      }
    }

    raw[y * (stride + 1)] = bestType;
    best.copy(raw, y * (stride + 1) + 1);
    cur.copy(prev);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Area-average downscale. Averaging every source pixel that lands in a target
 *  pixel, rather than sampling one of them, is what keeps a gradient smooth and
 *  a thumbnail free of the stair-stepping a nearest-neighbour shrink leaves. */
export function downscale(rgb, width, height, outWidth, outHeight) {
  const out = Buffer.alloc(outWidth * outHeight * 3);
  const sx = width / outWidth;
  const sy = height / outHeight;
  for (let y = 0; y < outHeight; y++) {
    const y0 = Math.floor(y * sy);
    const y1 = Math.min(height, Math.ceil((y + 1) * sy));
    for (let x = 0; x < outWidth; x++) {
      const x0 = Math.floor(x * sx);
      const x1 = Math.min(width, Math.ceil((x + 1) * sx));
      let r = 0, g = 0, b = 0, n = 0;
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const i = (yy * width + xx) * 3;
          r += rgb[i]; g += rgb[i + 1]; b += rgb[i + 2]; n++;
        }
      }
      const o = (y * outWidth + x) * 3;
      out[o] = Math.round(r / n);
      out[o + 1] = Math.round(g / n);
      out[o + 2] = Math.round(b / n);
    }
  }
  return out;
}
