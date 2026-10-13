#!/usr/bin/env node
/**
 * Gate for every pull request.
 *
 * ERRORS fail the build — schema violations, missing artwork, broken references.
 * WARNINGS do not. That split is deliberate: the real library lands with 500+
 * assets and mostly empty descriptions, and a CI job that goes red over prose
 * gets switched off within a week. Warnings plus a coverage summary keep the
 * gap visible without making it a blocker.
 *
 * Deliberately dependency-free: a design-system repo that needs an npm install
 * before it can tell you whether an SVG is valid will not get run locally.
 *
 * Run: npm run validate
 */
import { readFile, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectAssets, buildManifest } from './build-manifest.mjs';
import {
  isRasterPath, extOf, formatOf, dimensionsOf, aspectOf,
  RASTER_MAX_BYTES, RASTER_WARN_BYTES,
} from './lib/raster.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const warnings = [];
const fail = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);
const kb = (bytes) => `${Math.round(bytes / 1024)} KB`;
const TODAY = new Date().toISOString().slice(0, 10);

/** Vector artwork the tools parse, recolor and reduce to styles. */
const VECTOR_TYPES = ['icon', 'illustration'];
/** Raster artwork they cannot: a fixed picture, not a drawing with parts. */
const RASTER_TYPES = ['background', 'persona'];

/* -- Minimal JSON Schema (draft-07 subset) validator ----------------- */

function validate(value, schema, path, where) {
  if (schema.enum && !schema.enum.includes(value)) {
    return fail(where, `${path} must be one of ${schema.enum.join(', ')} — got ${JSON.stringify(value)}`);
  }
  if (schema.type === 'object' || schema.properties) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return fail(where, `${path} must be an object`);
    }
    for (const key of schema.required || []) {
      if (!(key in value)) fail(where, `${path}.${key} is required`);
    }
    for (const [key, child] of Object.entries(value)) {
      if (schema.propertyNames?.pattern && !new RegExp(schema.propertyNames.pattern).test(key)) {
        fail(where, `${path} has key "${key}", which does not match ${schema.propertyNames.pattern}`);
      }
      const childSchema = schema.properties?.[key];
      if (!childSchema) {
        if (schema.additionalProperties === false) fail(where, `${path}.${key} is not an allowed property`);
        else if (typeof schema.additionalProperties === 'object') {
          validate(child, schema.additionalProperties, `${path}.${key}`, where);
        }
        continue;
      }
      validate(child, childSchema, `${path}.${key}`, where);
    }
    if (schema.minProperties && Object.keys(value).length < schema.minProperties) {
      fail(where, `${path} needs at least ${schema.minProperties} entries`);
    }
    return;
  }
  if (schema.type === 'array') {
    if (!Array.isArray(value)) return fail(where, `${path} must be an array`);
    if (schema.minItems && value.length < schema.minItems) fail(where, `${path} needs at least ${schema.minItems} items`);
    if (schema.uniqueItems && new Set(value.map(String)).size !== value.length) fail(where, `${path} has duplicate items`);
    if (schema.items) value.forEach((item, i) => validate(item, schema.items, `${path}[${i}]`, where));
    return;
  }
  if (schema.type === 'boolean') {
    if (typeof value !== 'boolean') fail(where, `${path} must be true or false`);
    return;
  }
  if (schema.type === 'string') {
    if (typeof value !== 'string') return fail(where, `${path} must be a string`);
    if (schema.minLength && value.length < schema.minLength) fail(where, `${path} must not be empty`);
    if (schema.maxLength && value.length > schema.maxLength) fail(where, `${path} must be ${schema.maxLength} characters or fewer`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      fail(where, `${path} does not match ${schema.pattern} — got ${JSON.stringify(value)}`);
    }
    return;
  }
  if (schema.type === 'integer') {
    if (!Number.isInteger(value)) return fail(where, `${path} must be an integer`);
    if (schema.minimum !== undefined && value < schema.minimum) fail(where, `${path} must be >= ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) fail(where, `${path} must be <= ${schema.maximum}`);
  }
}

/* -- Checks ---------------------------------------------------------- */

const exists = (p) => stat(p).then(() => true, () => false);

async function main() {
  const schema = JSON.parse(await readFile(join(ROOT, 'schema/asset.schema.json'), 'utf8'));
  const assets = await collectAssets();

  if (assets.length === 0) fail('assets/', 'no assets found — did you run `npm run generate`?');

  const ids = new Map();
  const descriptions = new Map();

  for (const asset of assets) {
    const where = `${asset._dir}/meta.json`;
    const { _dir, ...meta } = asset;

    validate(meta, schema, 'asset', where);

    if (ids.has(meta.id)) fail(where, `duplicate id "${meta.id}" — also used by ${ids.get(meta.id)}`);
    ids.set(meta.id, where);

    // The id encodes the collection; a mismatch means the asset is filed wrong.
    const [prefix] = String(meta.id).split('.');
    if (meta.collection && prefix !== meta.collection) {
      fail(where, `id "${meta.id}" is prefixed "${prefix}" but collection is "${meta.collection}"`);
    }

    for (const theme of meta.themes || []) {
      const drawings = meta.variants?.[theme];
      if (!drawings || !Object.keys(drawings).length) {
        fail(where, `themes lists "${theme}" but variants has no drawings for it`);
        continue;
      }
      for (const [size, rel] of Object.entries(drawings)) {
        if (size !== 'any' && !(meta.sizes || []).includes(Number(size))) {
          fail(where, `variants.${theme} has a ${size}px drawing but sizes does not list ${size}`);
        }
        if (!(await exists(join(ROOT, rel)))) {
          fail(where, `variants.${theme}.${size} points at ${rel}, which does not exist`);
          continue;
        }
        /* Vector and raster are checked for different things. An SVG has to
           parse and has to announce itself, because the tools read it and so
           does a screen reader. A raster is opaque to both, so what matters is
           that it is the format it claims to be, that its real pixels match
           what the metadata promises, and that it is the web copy rather than
           the master somebody dragged in by accident. */
        if (!isRasterPath(rel)) {
          if (!VECTOR_TYPES.includes(meta.type)) {
            fail(where, `is a ${meta.type}, but variants.${theme}.${size} is an SVG — backgrounds and personas are raster artwork`);
          }
          const svg = await readFile(join(ROOT, rel), 'utf8');
          if (!svg.trimStart().startsWith('<svg') || !svg.includes('viewBox=')) {
            fail(rel, 'is not a well-formed SVG with a viewBox');
          }
          if (!svg.includes('role="img"') || !svg.includes('aria-label=')) {
            fail(rel, 'is missing role="img" / aria-label — assets must be announceable');
          }
          continue;
        }

        if (VECTOR_TYPES.includes(meta.type)) {
          fail(where, `variants.${theme}.${size} points at ${rel}, which is raster — an ${meta.type} has to be an SVG the tools can parse and recolor`);
          continue;
        }

        const buf = await readFile(join(ROOT, rel));
        const format = formatOf(buf);
        if (!format) {
          fail(rel, 'carries no PNG, JPEG or WebP signature — whatever the name says, this is not one of those');
          continue;
        }
        if (format !== extOf(rel)) {
          fail(rel, `is really a ${format} but is named .${extOf(rel)}`);
        }
        if (buf.length > RASTER_MAX_BYTES) {
          fail(rel, `is ${kb(buf.length)}, over the ${kb(RASTER_MAX_BYTES)} ceiling — the repo holds the web-sized copy and the master lives outside it`);
        } else if (buf.length > RASTER_WARN_BYTES) {
          warn(rel, `is ${kb(buf.length)}, which is worth another look at the export settings`);
        }

        const dim = dimensionsOf(buf);
        if (!dim) {
          warn(rel, 'has a header this script could not read, so its real size went unchecked');
          continue;
        }
        const long = Math.max(dim.width, dim.height);
        if (size !== 'any' && long !== Number(size)) {
          fail(where, `variants.${theme}.${size} is really ${dim.width}×${dim.height} — the key names the long edge, so it belongs at ${long}`);
        }
        const trueAspect = aspectOf(dim.width, dim.height);
        if (dim.width !== dim.height && !meta.aspect) {
          fail(where, `${rel} is ${dim.width}×${dim.height}, which is not square — set aspect to "${trueAspect}" or a card will crop it`);
        } else if (meta.aspect && meta.aspect !== trueAspect) {
          fail(where, `aspect says ${meta.aspect}, but ${rel} is ${dim.width}×${dim.height}, which is ${trueAspect}`);
        }
      }
    }

    for (const theme of Object.keys(meta.variants || {})) {
      if (!(meta.themes || []).includes(theme)) fail(where, `variants has "${theme}" but themes does not list it`);
    }

    if (meta.status === 'deprecated' && !meta.replacedBy) {
      fail(where, 'status is "deprecated" but replacedBy is not set — consumers need a migration target');
    }

    /* Raster rules. The accent picker and the style toggle are both promises
       about what the artwork can do, and neither is true of a photograph. A
       control that silently does nothing is worse than no control at all. */
    if (RASTER_TYPES.includes(meta.type)) {
      if (meta.recolorable !== false) {
        fail(where, `is a ${meta.type} and has to set recolorable:false — nothing retints a photograph, and the Gallery would offer an accent picker that does nothing`);
      }
      const reductions = (meta.themes || []).filter((t) => t !== 'standard');
      if (reductions.length) {
        fail(where, `is a ${meta.type} and lists ${reductions.join(' and ')} — those styles are monochrome reductions of line work, and raster artwork has none`);
      }
    }

    /* Persona rules. A persona exists in the library so that somebody building
       a screen can tell at a glance that the face in it was cleared. Both
       halves of that have to be present or the category is just a photo dump:
       who the persona represents, and who signed off. */
    if (meta.type === 'persona') {
      if (!meta.persona) {
        fail(where, 'is a persona with no persona block — a persona nobody can describe is a stock photo');
      } else if (meta.status === 'published' && !meta.persona.approval) {
        fail(where, 'is published with no persona.approval — published means cleared, and the clearance has to be written down');
      }
      if (!meta.description) {
        fail(where, 'is a persona with no description — a persona gets picked by reading what it depicts');
      }
      const expires = meta.persona?.approval?.expires;
      if (expires && expires < TODAY && meta.status === 'published') {
        warn(where, `persona approval lapsed on ${expires} and the asset is still published`);
      }
    } else if (meta.persona) {
      fail(where, `carries a persona block, but its type is "${meta.type}"`);
    }

    // Metadata quality: reported, never fatal.
    if (!meta.description && meta.type !== 'persona') warn(where, 'has no description');
    if (!meta.keywords?.length) warn(where, 'has no keywords — findable only by its exact name');
    if (meta.description) {
      const key = meta.description.trim().toLowerCase();
      if (descriptions.has(key)) {
        warn(where, `shares a description with ${descriptions.get(key)} — possible duplicate artwork`);
      } else {
        descriptions.set(key, meta.id);
      }
    }
  }

  // Deprecations must point at something that exists.
  for (const asset of assets) {
    if (asset.replacedBy && !ids.has(asset.replacedBy)) {
      fail(`${asset._dir}/meta.json`, `replacedBy names "${asset.replacedBy}", which is not in the library`);
    }
  }

  if (await exists(join(ROOT, 'manifest.json'))) {
    const onDisk = await readFile(join(ROOT, 'manifest.json'), 'utf8');
    const expected = JSON.stringify(buildManifest(assets), null, 2) + '\n';
    if (onDisk !== expected) fail('manifest.json', 'is out of date — run `npm run manifest` and commit the result');
  } else {
    fail('manifest.json', 'is missing — run `npm run manifest`');
  }

  /* -- Report -------------------------------------------------------- */

  if (warnings.length) {
    const shown = warnings.slice(0, 15);
    console.warn(`\n! ${warnings.length} warning${warnings.length === 1 ? '' : 's'} (not blocking):\n`);
    for (const w of shown) console.warn(`  · ${w}`);
    if (warnings.length > shown.length) console.warn(`  · …and ${warnings.length - shown.length} more`);
  }

  if (errors.length) {
    console.error(`\n✗ ${errors.length} problem${errors.length === 1 ? '' : 's'} found:\n`);
    for (const e of errors) console.error(`  • ${e}`);
    console.error('');
    process.exit(1);
  }

  const n = assets.length;
  const pct = (x) => `${String(Math.round((x / n) * 100)).padStart(3)}%`;
  const withDesc = assets.filter((a) => a.description).length;
  const withKeywords = assets.filter((a) => a.keywords?.length).length;
  const withFigma = assets.filter((a) => a.figma).length;
  const byStatus = assets.reduce((acc, a) => ({ ...acc, [a.status]: (acc[a.status] || 0) + 1 }), {});
  const rasterAssets = assets.filter((a) => RASTER_TYPES.includes(a.type));

  console.log(`\n✓ ${n} assets valid; manifest.json is current.\n`);
  console.log(`  Lifecycle    ${Object.entries(byStatus).map(([k, v]) => `${v} ${k}`).join(', ')}`);
  console.log(`  Keywords     ${pct(withKeywords)}  (${withKeywords}/${n})`);
  console.log(`  Description  ${pct(withDesc)}  (${withDesc}/${n})`);
  console.log(`  Figma link   ${pct(withFigma)}  (${withFigma}/${n})`);
  if (rasterAssets.length) {
    const cleared = rasterAssets.filter((a) => a.persona?.approval).length;
    console.log(`  Raster       ${rasterAssets.length} background/persona asset${rasterAssets.length === 1 ? '' : 's'}, ${cleared} with written approval`);
  }
  console.log('');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
