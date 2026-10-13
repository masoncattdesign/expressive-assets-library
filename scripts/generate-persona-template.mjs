#!/usr/bin/env node
/**
 * Draws the one placeholder that holds the Personas collection open.
 *
 * Personas are photographs of people, and the library does not hold any yet:
 * the artwork is marketing's to supply and marketing's to clear. What this
 * writes is not a person. It is a portrait-shaped card that says so, filed as
 * a draft, so the collection exists, the panel can be looked at, and the shape
 * of a persona record is written down somewhere a person can read it.
 *
 * Delete it the day the first approved persona lands.
 *
 * Run: node scripts/generate-persona-template.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePng, downscale } from './lib/png.mjs';
import { aspectOf } from './lib/raster.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = 'assets/media/persona';
const SLUG = 'template';

const WIDTH = 768;
const HEIGHT = 1024;
const THUMB = 288;

const GROUND = [0xe8, 0xea, 0xef];
const FIGURE = [0xb4, 0xbb, 0xc8];

const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

/** Head and shoulders, drawn as two shapes with a soft edge. Deliberately
 *  featureless: the moment this has a face it starts looking like a person the
 *  library is claiming to have cleared. */
function draw() {
  const rgb = Buffer.alloc(WIDTH * HEIGHT * 3);
  const cx = WIDTH / 2;
  const headY = HEIGHT * 0.36;
  const headR = WIDTH * 0.185;
  const shoulderY = HEIGHT * 0.98;
  const shoulderRx = WIDTH * 0.40;
  const shoulderRy = HEIGHT * 0.36;
  // One pixel of feather, measured in the same units as the shape tests, so
  // the silhouette has no staircase on its edge.
  const feather = 1.6;

  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      // A very slight vertical lift on the ground, so the card is not flat.
      const ground = mix(GROUND, [0xff, 0xff, 0xff], (1 - y / HEIGHT) * 0.5);

      const dHead = Math.hypot(x - cx, y - headY) - headR;
      const nx = (x - cx) / shoulderRx;
      const ny = (y - shoulderY) / shoulderRy;
      const dShoulder = (Math.hypot(nx, ny) - 1) * Math.min(shoulderRx, shoulderRy);
      const d = Math.min(dHead, dShoulder);

      const inside = d <= -feather ? 1 : d >= feather ? 0 : (feather - d) / (2 * feather);
      const out = mix(ground, FIGURE, inside);

      const i = (y * WIDTH + x) * 3;
      rgb[i] = clamp(out[0]);
      rgb[i + 1] = clamp(out[1]);
      rgb[i + 2] = clamp(out[2]);
    }
  }
  return rgb;
}

async function main() {
  const dir = join(ROOT, DIR, SLUG);
  await mkdir(dir, { recursive: true });

  const rgb = draw();
  const full = `${DIR}/${SLUG}/${SLUG}-${HEIGHT}.png`;
  const thumbH = Math.round((THUMB / WIDTH) * HEIGHT);
  const thumb = `${DIR}/${SLUG}/${SLUG}-${thumbH}.png`;
  await writeFile(join(ROOT, full), encodePng(WIDTH, HEIGHT, rgb));
  await writeFile(join(ROOT, thumb), encodePng(THUMB, thumbH, downscale(rgb, WIDTH, HEIGHT, THUMB, thumbH)));

  const meta = {
    id: `persona.${SLUG}`,
    name: 'Persona template',
    type: 'persona',
    collection: 'persona',
    status: 'draft',
    description:
      'Not a person. A portrait-shaped placeholder that holds the Personas collection open and shows the shape of a persona record. Replace it with approved artwork.',
    keywords: ['persona', 'template', 'placeholder', 'portrait', 'example'],
    themes: ['standard'],
    sizes: [thumbH, HEIGHT],
    aspect: aspectOf(WIDTH, HEIGHT),
    colors: { primary: '#B4BBC8', secondary: '#E8EAEF' },
    recolorable: false,
    variants: { standard: { [thumbH]: thumb, [HEIGHT]: full } },
    generated: [`standard:${thumbH}`, `standard:${HEIGHT}`],
    persona: {
      role: 'Template, not a persona',
      // No approval block, deliberately. A draft persona may sit here without
      // one; a published one may not, and validate.mjs is what enforces that.
    },
    notes:
      'Drawn by scripts/generate-persona-template.mjs. Delete this asset once the first approved persona lands — it exists only so the collection is not empty.',
    version: '1.0.0',
    updated: new Date().toISOString().slice(0, 10),
  };
  await writeFile(join(dir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n', 'utf8');
  console.log(`Wrote ${meta.id} — ${WIDTH}x${HEIGHT} + ${THUMB}px thumb.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
