# Contributing to Expressive Assets

Every asset in this library ends up in shipping Windows surfaces, so the bar is
about consistency more than volume. This guide covers the two things people
actually come here to do: add an asset, and change one that already exists.

## Before you start

```bash
git clone https://github.com/masoncattdesign/expressive-assets-library.git
cd expressive-assets-library
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
- **Renaming** — change `name` and push the old name into `aliases`. Never change
  `id`; every consumer references it, and search matches aliases so the people
  who learned the old name still find it.
- **Retiring an asset** — set `status: "deprecated"` and `replacedBy` to the
  replacement's id. Validation rejects a deprecation with no migration target,
  and rejects one pointing at an id that isn't in the library. **Do not delete
  the folder.** Something is importing it; deprecation gives them a route out,
  deletion gives them a broken build.

## Metadata conventions

- **`id`** is forever. `<collection>.<slug>`, lowercase, hyphenated.
- **`keywords`** should include the words someone would type when they don't know
  the asset's name. "Trash" carries `recycle bin`, `delete`, `remove` — that is
  the difference between a findable library and a folder of SVGs.
- **`description`** is one line on what the artwork depicts. It is also how
  duplicates get caught: validation warns when two assets describe themselves
  identically, which usually means the same idea got drawn twice.
- **`status`** is the only lifecycle axis. New work starts at `draft`; it becomes
  `published` when design review signs off. Nothing `published` should change
  shape without a major version bump.
- **`sizes`** lists the sizes the geometry is *legible* at, not the sizes it can
  technically scale to. If it turns to mud at 12px, don't list 12.
- **`recolorable`** is false only for trademarked brand marks that must ship in
  their own colors. Everything systemic stays true.

`npm run validate` splits errors from warnings. Errors — schema violations,
missing artwork, broken references — fail CI. Missing keywords and descriptions
are warnings with a coverage summary, so the gap stays visible without a red
build that everyone learns to ignore.

## Working on the browsing interface

`docs/` is plain HTML, CSS and JavaScript with no build step — edit and refresh.
Color tokens live at the top of `styles.css` for both light and dark themes;
change them there rather than in individual rules. `app.js` reads
`manifest.json`, so any metadata field you add to the schema can be surfaced in
the detail panel without touching the asset pipeline.

## Review

Design review covers silhouette, optical weight against neighbouring icons, and
legibility at 16px. Engineering review covers the metadata: correct collection,
honest `status`, and keywords someone would actually search for.
