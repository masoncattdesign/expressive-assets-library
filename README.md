# Expressive Assets

The icon and illustration library for **Windows Design Systems** — the artwork, the
metadata that describes it, and the browser designers and engineers use to find it.

| | |
|---|---|
| **Assets** | 38 (32 icons, 6 illustrations) |
| **Browser** | `https://masoncattdesign.github.io/expressive-assets-library/` |
| **Contract** | [`manifest.json`](manifest.json) |
| **Schema** | [`schema/asset.schema.json`](schema/asset.schema.json) |

> **Artwork status: placeholder.** Every SVG in this repo is generated from
> `scripts/sources/specs.mjs` so the pipeline is testable end to end. Swapping in
> the real Windows drawings changes nothing about the schema, the manifest, or
> the site — see [Replacing the placeholders](#replacing-the-placeholders).

---

## Layout

```
assets/
  icons/
    system/      System Icons     — OS surfaces: settings, search, battery…
    product/     Product Icons    — first-party apps: mail, photos, store…
    file/        File Icons       — document types: doc, xls, pdf, zip…
  illustrations/
    windows/     Windows Illustrations
    fluent/      Fluent Illustrations
    product/     Product Illustrations

docs/            The browsing interface (plain HTML/CSS/JS, no build step)
schema/          JSON Schema every asset's meta.json must satisfy
scripts/         Generation, manifest, validation, site assembly
manifest.json    Generated index — the file consumers read
```

Each asset is a folder:

```
assets/icons/system/settings/
  color.svg      Expressive — gradient tile, white glyph
  regular.svg    Outline    — stroked, single color
  filled.svg     Mono       — solid, single color
  meta.json      Metadata for this asset
```

## Metadata

`meta.json` mirrors the property set used by the Figma library, so an export maps
across 1:1 and nothing is lost in translation:

| Field | Notes |
|---|---|
| `id` | `<category>.<slug>`. Stable forever — consumers reference it. |
| `type` | `icon` or `illustration` |
| `category` | `system` · `product` · `file` · `windows` · `fluent` |
| `family` | `windows` · `fluent` · `m365` · `surface` · `gaming` — drives ownership |
| `status` | `active` · `inactive` · `na` |
| `build` | `alpha` · `beta` · `stable` · `deprecated` — release channel |
| `themes` | Which of `color` / `regular` / `filled` exist on disk |
| `sizes` | Pixel sizes the geometry is legible at (12–48 for icons) |
| `colors` | `primary` / `secondary` baked into the Expressive variant |
| `tags` | Search keywords, including synonyms |
| `variants` | Path to each theme's SVG |
| `version`, `updated`, `owner` | Provenance |

**Theme naming.** The library stores `color` / `regular` / `filled`; the UI labels
them **Expressive** / **Outline** / **Mono**. Same three things, two audiences —
the mapping lives in one constant at the top of `docs/app.js`.

## Using the library

Read `manifest.json`, never the folder tree — the tree is an implementation
detail and the manifest is the contract.

```js
const { assets } = await fetch('https://masoncattdesign.github.io/expressive-assets-library/manifest.json')
  .then((r) => r.json());

const shippable = assets.filter((a) => a.status === 'active' && a.build === 'stable');
const settings = assets.find((a) => a.id === 'system.settings');
// settings.variants.color -> "assets/icons/system/settings/color.svg"
```

Every SVG declares its colors as custom properties on the root, so a host page
can retint one without touching the file:

```html
<style>#ea-system-settings { --ea-primary: #107C10; --ea-secondary: #4CAF50; }</style>
```

`--ea-knockout` sets the color that punches through solid shapes (the hole in a
gear, the label on a file icon). It defaults to white — override it if you place
Mono assets on a dark surface.

## Commands

```bash
npm run generate   # rebuild every SVG from scripts/sources/specs.mjs
npm run manifest   # rescan assets/ and rewrite manifest.json
npm run validate   # schema + artwork + manifest-freshness check (what CI runs)
npm run build      # validate, then assemble _site/
npm run dev        # assemble _site/ and serve it at http://localhost:4173
```

No dependencies. Node 18+ and nothing else — a design-system repo that needs an
`npm install` before it can tell you whether an SVG is valid does not get run
locally.

## The browsing interface

`docs/` is three files: `index.html`, `styles.css`, `app.js`. It reads
`manifest.json` and a build-time `sprite.json` (every SVG inlined, so the grid
loads in one request instead of a hundred), and gives you search across names,
ids and tags; sidebar filtering by collection; status and build filters; grid and
list views; live theme, size and Windows-accent switching; and copy/download of
the exact SVG you are looking at.

Because it is unbuilt static files, a designer can edit a color token in
`styles.css` and open a PR without installing a toolchain.

`.github/workflows/pages.yml` publishes it on every push to `main`. The workflow
assembles `_site/` from `docs/` + `assets/` + `manifest.json` rather than keeping
a second copy of the artwork inside `docs/`, which would drift.

**Before the first deploy:** set `REPO` at the top of `docs/app.js` to the repo
URL, and enable Pages under *Settings → Pages → Source: GitHub Actions*.

## Replacing the placeholders

Each icon is authored once on a 24×24 grid and all three themes are derived from
it. Open `scripts/sources/specs.mjs` and replace an entry's `glyph` with the real
path data, using the semantic classes:

| Class | Expressive | Outline | Mono |
|---|---|---|---|
| `.f` | filled white | stroked | filled |
| `.s` | stroked white | stroked | stroked, heavier |
| `.k` | knockout (tile gradient) | stroked | knockout |
| `.lbl` | knockout text | colored text | knockout text |

Two rules that are load-bearing:

1. **Keep every `.f` shape a single path.** A shape composed of overlapping
   circles fills correctly but falls apart in Outline, where each sub-shape gets
   its own visible contour.
2. **Don't overlap `.f` and `.s` in the same region** — in Expressive both are
   white and the detail disappears. Use `.k` for anything that sits on top of a
   filled shape.

Then `npm run generate && npm run manifest && npm run validate`.

If the real artwork arrives as finished per-theme SVGs rather than geometry to
re-author, drop them straight into `assets/<type>/<category>/<slug>/` alongside a
`meta.json`, skip `npm run generate`, and run the manifest and validate steps.
The generator is a convenience for authoring, not a requirement of the format.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE).
