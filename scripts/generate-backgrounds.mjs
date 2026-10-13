#!/usr/bin/env node
/**
 * Draws the starter Backgrounds set and writes its metadata.
 *
 * Backgrounds exist so that somebody mocking a Windows screen has a ground to
 * put it on that is already on palette. The eight here are drawn by this
 * script rather than photographed, which means three useful things: they are
 * ours, so there is no license to chase; they are reproducible, so a palette
 * change is a re-run and not a redraw; and they are cheap, because a gradient
 * deflates to a fraction of what a photograph costs.
 *
 * Each background is written twice — a 1920 wide copy for use and a 480 wide
 * copy for the Gallery's cards, so browsing the collection does not pull eight
 * full-size images. That is the same reason icons are fetched per size.
 *
 * Run: node scripts/generate-backgrounds.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePng, downscale } from './lib/png.mjs';
import { aspectOf } from './lib/raster.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = 'assets/media/background';

const WIDTH = 1920;
const HEIGHT = 1080;
const THUMB = 480;

/** The ground a background sits on. Backgrounds come in pairs because the
 *  screens built on them do: a dark mock on a light ground reads as a mistake. */
const GROUNDS = {
  dark: { label: 'dark', base: [0x0d, 0x10, 0x17], reach: 0.95, lift: 0.0 },
  light: { label: 'light', base: [0xf5, 0xf6, 0xf9], reach: 0.58, lift: 0.0 },
};

/** On-palette hues, from the same Microsoft set the Customizer's presets use,
 *  so a mock built on one of these and recolored with one of those agrees. */
const HUES = [
  { id: 'azure', label: 'Azure', hex: '#0078D4', keywords: ['blue', 'azure'] },
  { id: 'teal', label: 'Teal', hex: '#038387', keywords: ['teal', 'cyan'] },
  { id: 'iris', label: 'Iris', hex: '#8764B8', keywords: ['purple', 'iris', 'violet'] },
  { id: 'berry', label: 'Berry', hex: '#C239B3', keywords: ['magenta', 'berry', 'pink'] },
];

const hex2rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const rgb2hex = (c) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

/**
 * Two blooms and a tilt.
 *
 * One bloom carries the hue, the other a much lighter companion, which is the
 * same pairing the illustration palette uses — a hue on its own goes flat, and
 * a hue beside its lighter self reads as light falling on something. The tilt
 * is what stops the result looking like a radial gradient filter.
 */
function draw({ ground, hue }) {
  const base = ground.base;
  const warm = hex2rgb(hue.hex);
  const companion = mix(warm, [255, 255, 255], ground.label === 'dark' ? 0.42 : 0.3);

  const blooms = [
    { at: [0.26, 0.3], radius: 0.78, color: warm, strength: ground.reach },
    { at: [0.82, 0.86], radius: 0.62, color: companion, strength: ground.reach * 0.68 },
  ];

  const rgb = Buffer.alloc(WIDTH * HEIGHT * 3);
  const diag = Math.hypot(WIDTH, HEIGHT);

  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      let out = base.slice();
      for (const bloom of blooms) {
        const dx = x - bloom.at[0] * WIDTH;
        const dy = y - bloom.at[1] * HEIGHT;
        const d = Math.hypot(dx, dy) / (bloom.radius * diag);
        // smoothstep, so the bloom has no visible edge where it runs out.
        const u = 1 - d;
        const t = d >= 1 ? 0 : u * u * (3 - 2 * u);
        out = mix(out, bloom.color, Math.min(1, t * bloom.strength));
      }
      // A gentle corner-to-corner tilt, under two percent, which the eye reads
      // as depth rather than as a second gradient.
      const tilt = ((x / WIDTH) * 0.6 + (y / HEIGHT) * 0.4 - 0.5) * (ground.label === 'dark' ? 10 : -12);
      const i = (y * WIDTH + x) * 3;
      rgb[i] = clamp(out[0] + tilt);
      rgb[i + 1] = clamp(out[1] + tilt);
      rgb[i + 2] = clamp(out[2] + tilt);
    }
  }

  return { rgb, primary: rgb2hex(warm), secondary: rgb2hex(companion) };
}

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const aspect = aspectOf(WIDTH, HEIGHT);
  let written = 0;

  for (const hue of HUES) {
    for (const key of Object.keys(GROUNDS)) {
      const ground = GROUNDS[key];
      const slug = `${hue.id}-${ground.label}`;
      const dir = join(ROOT, DIR, slug);
      await mkdir(dir, { recursive: true });

      const { rgb, primary, secondary } = draw({ ground, hue });
      const full = `${DIR}/${slug}/${slug}-${WIDTH}.png`;
      const thumb = `${DIR}/${slug}/${slug}-${THUMB}.png`;
      await writeFile(join(ROOT, full), encodePng(WIDTH, HEIGHT, rgb));
      const small = Math.round((THUMB / WIDTH) * HEIGHT);
      await writeFile(
        join(ROOT, thumb),
        encodePng(THUMB, small, downscale(rgb, WIDTH, HEIGHT, THUMB, small))
      );

      const meta = {
        id: `background.${slug}`,
        name: `${hue.label} on ${ground.label}`,
        type: 'background',
        collection: 'background',
        status: 'published',
        description: `A soft ${hue.label.toLowerCase()} gradient on a ${ground.label} ground, for mocking a Windows screen on palette.`,
        keywords: [
          'background', 'wallpaper', 'gradient', 'screen', 'mock', ground.label,
          ...hue.keywords,
        ],
        themes: ['standard'],
        sizes: [THUMB, WIDTH],
        aspect,
        colors: { primary, secondary },
        recolorable: false,
        variants: { standard: { [THUMB]: thumb, [WIDTH]: full } },
        generated: [`standard:${THUMB}`, `standard:${WIDTH}`],
        notes: `Drawn by scripts/generate-backgrounds.mjs. Re-run that script rather than editing the PNGs; both sizes come out of one pass so they cannot drift apart.`,
        version: '1.0.0',
        updated: today,
      };
      await writeFile(join(dir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n', 'utf8');
      written++;
      console.log(`  ${meta.id.padEnd(28)} ${WIDTH}x${HEIGHT} + ${THUMB}px thumb`);
    }
  }

  console.log(`\nWrote ${written} backgrounds. Run \`npm run manifest\` to pick them up.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
