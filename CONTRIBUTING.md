# Contributing to Expressive Assets

Every asset in this library ends up in shipping Windows surfaces, so the bar is
about consistency more than volume. This guide covers the two things people
actually come here to do: add an asset, and change one that already exists.

## Before you start

```bash
git clone https://github.com/YOUR-ORG/expressive-assets.git
cd expressive-assets
npm run dev     # http://localhost:4173
```

Node 18 or newer. There is nothing to install.

## Adding an asset

**1. Pick the right home.** Categories are not interchangeable:

| Category | What belongs there |
|---|---|
| `system` | OS-level surfaces — settings, search, network, battery |
| `product` | First-party apps — mail, photos, store, gaming |
| `file` | Document types, built on the shared page silhouette |
| `windows` / `fluent` / `product` (illustrations) | Scenes, empty states, onboarding art |

If you are unsure, open an issue before drawing. Moving an asset later means
changing its `id`, which breaks every consumer that references it.

**2. Author the geometry.** Add an entry to `scripts/sources/specs.mjs` on the
24×24 grid, using the semantic classes (`.f`, `.s`, `.k`, `.lbl`) documented in
the [README](README.md#replacing-the-placeholders). Two rules matter:

- every `.f` shape is a **single path** — composites fall apart in Outline
- never overlap `.f` and `.s` in the same region — in Expressive both are white

**3. Generate and validate.**

```bash
npm run generate && npm run manifest && npm run validate
```

**4. Check all three themes and the small sizes.** `npm run dev`, select your
asset, and drag the size slider to 16px. Most icons that fail review fail here:
detail that reads at 48 turns to mud at 16. Simplify until it survives.

**5. Open a PR.** Include a screenshot of the asset in all three themes. CI runs
`npm run validate` on every PR; a red check means the schema, the artwork, or the
manifest is out of sync, and the error message says which.

## Changing an existing asset

- **Redraw, same silhouette** — bump the minor version in `meta.json`.
- **Shape change that breaks visual continuity** — bump the major version and say
  so in the PR. Consumers may have screenshots and docs pinned to the old look.
- **Retiring an asset** — set `status: "inactive"`, `build: "deprecated"`, and
  `deprecatedBy` to the replacement's id. Validation rejects a deprecated asset
  with no migration target. **Do not delete the folder.** Something is importing
  it; deprecation gives them a route out, deletion gives them a broken build.

## Metadata conventions

- **`id`** is forever. `<category>.<slug>`, lowercase, hyphenated.
- **`tags`** should include the words someone would type when they don't know the
  asset's name. "Trash" carries `recycle bin`, `delete`, `remove` — that is the
  difference between a findable library and a folder of SVGs.
- **`build`** is a release-channel promise. Nothing on `stable` should change
  shape without a major version bump. Draw new work as `alpha`, promote it once
  design review signs off.
- **`sizes`** lists the sizes the geometry is *legible* at, not the sizes it can
  technically scale to. If it turns to mud at 12px, don't list 12.

## Working on the browsing interface

`docs/` is plain HTML, CSS and JavaScript with no build step — edit and refresh.
Color tokens live at the top of `styles.css` for both light and dark themes;
change them there rather than in individual rules. `app.js` reads
`manifest.json`, so any metadata field you add to the schema can be surfaced in
the detail panel without touching the asset pipeline.

## Review

Design review covers silhouette, optical weight against neighbouring icons, and
legibility at 16px. Engineering review covers the metadata: correct category,
honest `build` channel, tags someone would actually search for.
