/**
 * Reading raster artwork without a dependency.
 *
 * Backgrounds and personas are photographs and renders, not drawings. Nothing
 * in this repo parses them, but the library still has to be able to say three
 * things about one: that it is really the format its extension claims, how big
 * it actually is, and whether it is web-sized. All three come out of the first
 * few dozen bytes of the file, so they come out of here rather than out of an
 * image library the repo would then depend on.
 *
 * The rule the sizes come from: masters live outside the repo, the web-sized
 * copy lives in it. A 12 MB wallpaper in git is a 12 MB wallpaper in every
 * clone of git, forever.
 */

/** Largest a committed raster may be. Above this the master was committed by
 *  mistake, which is the failure this number exists to catch. */
export const RASTER_MAX_BYTES = 800 * 1024;
/** Above this it still ships, but someone should look at the export settings. */
export const RASTER_WARN_BYTES = 400 * 1024;

export const RASTER_EXT = ['png', 'jpg', 'webp'];

export function extOf(path) {
  const m = /\.([a-z0-9]+)$/i.exec(path);
  return m ? m[1].toLowerCase() : '';
}

export function isRasterPath(path) {
  return RASTER_EXT.includes(extOf(path));
}

const be16 = (b, i) => b.readUInt16BE(i);
const be32 = (b, i) => b.readUInt32BE(i);
const le16 = (b, i) => b.readUInt16LE(i);
const le32 = (b, i) => b.readUInt32LE(i);

/**
 * What format this buffer really is, by signature rather than by filename.
 * Returns 'png' | 'jpg' | 'webp' | null.
 */
export function formatOf(buf) {
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length >= 12 && buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  return null;
}

/** { width, height } in pixels, or null if the header cannot be read. */
export function dimensionsOf(buf) {
  const format = formatOf(buf);
  if (format === 'png') return pngSize(buf);
  if (format === 'jpg') return jpgSize(buf);
  if (format === 'webp') return webpSize(buf);
  return null;
}

function pngSize(buf) {
  // IHDR is always the first chunk, so width and height sit at a fixed offset.
  if (buf.length < 24 || buf.subarray(12, 16).toString('latin1') !== 'IHDR') return null;
  return { width: be32(buf, 16), height: be32(buf, 20) };
}

function jpgSize(buf) {
  // Walk the marker segments to the first start-of-frame. Everything before it
  // is metadata of unpredictable length, which is why this is a walk and not an
  // offset.
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
    const length = be16(buf, i + 2);
    // SOF0 through SOF15, skipping the four that are not frame headers.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: be16(buf, i + 5), width: be16(buf, i + 7) };
    }
    i += 2 + length;
  }
  return null;
}

function webpSize(buf) {
  const chunk = buf.subarray(12, 16).toString('latin1');
  if (chunk === 'VP8X' && buf.length >= 30) {
    // 24-bit, stored one less than the real value.
    const w = buf[24] | (buf[25] << 8) | (buf[26] << 16);
    const h = buf[27] | (buf[28] << 8) | (buf[29] << 16);
    return { width: w + 1, height: h + 1 };
  }
  if (chunk === 'VP8 ' && buf.length >= 30) {
    return { width: le16(buf, 26) & 0x3fff, height: le16(buf, 28) & 0x3fff };
  }
  if (chunk === 'VP8L' && buf.length >= 25) {
    const bits = le32(buf, 21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  return null;
}

/** Reduce a width and height to the "W:H" string the schema's `aspect` wants. */
export function aspectOf(width, height) {
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const d = gcd(width, height) || 1;
  let w = width / d;
  let h = height / d;
  // "1600:899" is not an aspect ratio anybody reads. Where the exact reduction
  // is unreadable, fall back to the nearest ratio with a small denominator.
  if (w > 99 || h > 99) {
    const target = width / height;
    let best = null;
    for (let hh = 1; hh <= 20; hh++) {
      const ww = Math.round(target * hh);
      if (ww < 1 || ww > 99) continue;
      const err = Math.abs(ww / hh - target);
      if (!best || err < best.err) best = { w: ww, h: hh, err };
    }
    if (!best) return null;
    w = best.w;
    h = best.h;
  }
  return `${w}:${h}`;
}
