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

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const warnings = [];
const fail = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

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
        const svg = await readFile(join(ROOT, rel), 'utf8');
        if (!svg.trimStart().startsWith('<svg') || !svg.includes('viewBox=')) {
          fail(rel, 'is not a well-formed SVG with a viewBox');
        }
        if (!svg.includes('role="img"') || !svg.includes('aria-label=')) {
          fail(rel, 'is missing role="img" / aria-label — assets must be announceable');
        }
      }
    }

    for (const theme of Object.keys(meta.variants || {})) {
      if (!(meta.themes || []).includes(theme)) fail(where, `variants has "${theme}" but themes does not list it`);
    }

    if (meta.status === 'deprecated' && !meta.replacedBy) {
      fail(where, 'status is "deprecated" but replacedBy is not set — consumers need a migration target');
    }

    // Metadata quality: reported, never fatal.
    if (!meta.description) warn(where, 'has no description');
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

  console.log(`\n✓ ${n} assets valid; manifest.json is current.\n`);
  console.log(`  Lifecycle    ${Object.entries(byStatus).map(([k, v]) => `${v} ${k}`).join(', ')}`);
  console.log(`  Keywords     ${pct(withKeywords)}  (${withKeywords}/${n})`);
  console.log(`  Description  ${pct(withDesc)}  (${withDesc}/${n})`);
  console.log(`  Figma link   ${pct(withFigma)}  (${withFigma}/${n})\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
