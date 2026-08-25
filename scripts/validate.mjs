#!/usr/bin/env node
/**
 * Gate for every pull request. Checks that:
 *   1. every asset's meta.json satisfies schema/asset.schema.json
 *   2. every file named in `variants` actually exists and parses as SVG
 *   3. every theme listed in `themes` has a matching variant entry
 *   4. ids are unique
 *   5. manifest.json is current (nobody added artwork without rebuilding)
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
const fail = (where, msg) => errors.push(`${where}: ${msg}`);

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
  if (schema.type === 'string') {
    if (typeof value !== 'string') return fail(where, `${path} must be a string`);
    if (schema.minLength && value.length < schema.minLength) fail(where, `${path} must not be empty`);
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

  const seen = new Map();
  for (const asset of assets) {
    const where = `${asset._dir}/meta.json`;
    const { _dir, ...meta } = asset;

    validate(meta, schema, 'asset', where);

    if (seen.has(meta.id)) fail(where, `duplicate id "${meta.id}" — also used by ${seen.get(meta.id)}`);
    seen.set(meta.id, where);

    for (const theme of meta.themes || []) {
      const rel = meta.variants?.[theme];
      if (!rel) {
        fail(where, `themes lists "${theme}" but variants has no "${theme}" path`);
        continue;
      }
      if (!(await exists(join(ROOT, rel)))) {
        fail(where, `variants.${theme} points at ${rel}, which does not exist`);
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

    for (const theme of Object.keys(meta.variants || {})) {
      if (!(meta.themes || []).includes(theme)) fail(where, `variants has "${theme}" but themes does not list it`);
    }

    if (meta.build === 'deprecated' && !meta.deprecatedBy) {
      fail(where, 'build is "deprecated" but deprecatedBy is not set — consumers need a migration target');
    }
  }

  if (await exists(join(ROOT, 'manifest.json'))) {
    const onDisk = await readFile(join(ROOT, 'manifest.json'), 'utf8');
    const expected = JSON.stringify(buildManifest(assets), null, 2) + '\n';
    if (onDisk !== expected) fail('manifest.json', 'is out of date — run `npm run manifest` and commit the result');
  } else {
    fail('manifest.json', 'is missing — run `npm run manifest`');
  }

  if (errors.length) {
    console.error(`\n✗ ${errors.length} problem${errors.length === 1 ? '' : 's'} found:\n`);
    for (const e of errors) console.error(`  • ${e}`);
    console.error('');
    process.exit(1);
  }
  console.log(`✓ ${assets.length} assets valid; manifest.json is current.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
