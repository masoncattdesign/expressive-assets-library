# Changelog

What changed, by release. Short entries: enough to remember why, not a second
copy of the commit log. `git log` is still the detailed record.

This file lives in the repo rather than on the site. It is for us.

Versions and what a major, minor or patch means are in [VERSIONING.md](VERSIONING.md).
Assets carry their own `version` and `updated` in `meta.json` and move on their
own schedule; this file tracks the tools and the contract.

---

## 2.0 — 1 September 2026

**Contract break.** A consumer reading `manifest.json` has to change.

- `groups` entries carry an `id` and no longer map one-to-one onto `type`.
  Product Icons and System Icons are both `icon`, and both Product Icons and
  Illustrations own a collection called `product`, so code that found a group
  by `type` alone no longer works.
- The asset field `placeholders` became `generated`, and widened: it now marks
  any drawing produced here rather than received, not only matrix filler.

Also in this release:

- Sidebar splits into Product Icons, System Icons and Illustrations, because
  the three work differently in structure, customisation and tooling. Groups
  are clickable rows; Third Party and In Progress are declared and waiting for
  artwork.
- Theme control and a page menu move to the toolbar. Auto is gone: Bridge has
  no theme control at all and nothing in it follows the operating system, so
  there was no third state to mirror.
- Every asset is now `published`. 1,836 of 14,808 drawings carry `generated`.
  Published is a claim about the drawing, not about the id.
- File Icons: what shipped as Filled was really Outline. Renamed, and a true
  Filled added, with white areas cut as real holes via an SVG mask rather than
  painted over.
- Figma sync plugin: one component set per icon with Style and Size as variant
  properties, laid out by hand into a labelled card. Fixed a bug where a sync
  that changed no artwork also changed no layout.

## Unreleased

- **Third-party icons imported.** 61 brand marks, 118 drawings, one size (32).
  Not recolourable, since altering a third-party mark is the thing brand
  guidelines exist to prevent. Every one names a holder in
  THIRD-PARTY-NOTICES.md; attribution is best effort and wants confirming.
  Outline and the missing sizes are still to derive.
- Customizer: canvas controls moved onto the canvas, sidebar nav removed in
  favour of the toolbar menu, "Icon style" renamed "Asset style", and the style
  cards rebuilt around their preview and drawn from the current asset set.

- `figma-sources.json` records where each collection is pulled from. Product
  Icons now pull from the sync board the plugin writes (node `582216:23014`),
  not the original authoring page, so edits made to the generated components
  come back. See "The round trip" in the README.
- `npm run test:plugin` runs the sync plugin against a fake Figma in Node.
- Accent swatches are flat circles with a hard two-tone split, replacing the
  beveled gradient tiles. Bridge has no gloss and no shadow, and the pair still
  has to read, so the two colours meet on an edge rather than blending.
- An import plan for the App Icons section: 32 Windows app tiles at 64px.
- The Gallery sidebar marks are System Icons from the library rather than
  shapes drawn by hand in `app.js`. `scripts/inline-nav-icons.mjs` names each
  pick by asset id and regenerates the block, so swapping one is a line edit.

## 1.2 — 1 September 2026

- Aligned to Bridge: ink accent, pill controls, no shadows, Bridge's neutral
  ramp and type scale.
- Dark theme kept rather than dropped, and given an explicit control. Checking
  artwork against both grounds is the job here, not a preference.
- Product icon matrix completed: 90 icons, three styles, six sizes, with the
  180 generated cells recorded rather than hidden.
- A Figma sync plugin, because the REST API cannot write file content and MCP
  cannot carry the artwork.

## 1.1 — 1 September 2026

- Customizer rebuilt inside the Gallery shell, keeping its whole engine.
- The detail panel takes its shape from the asset's family, so a System icon
  never offers a Standard it was never drawn in.
- About, System Map and Asset Anatomy added as one set of documents.

## 1.0 — 25 August to 31 August 2026

First working library and tools.

- Schema, per-size artwork, `manifest.json` as the only public contract.
- 90 Product Icons, 88 File Icons and 2,891 Fluent System Icons imported.
- OOBE, M365 and Product Illustrations.
- Gallery, and the first Customizer.

---

## Not yet done

Carried between sessions so it does not get lost.

- **Naming grammar.** 2,665 of 3,129 ids carry a hyphen inside a name segment,
  which Bridge's scheme does not allow. Either the ids change or the grammar
  does, and the rename gets more expensive the longer it waits.
- **Access control.** The site is on GitHub Pages, which has none. `DEPLOY.md`
  has the Azure Static Web Apps and Entra path; the tenant id is still a
  placeholder.
- **Matrix gaps** for System Icons and Illustrations, the way Product Icons
  were filled.
- **The pull half of the round trip.** The plugin writes to Figma; nothing
  reads that page back yet. First step is proving the REST API returns
  `sharedPluginData`, which the whole design depends on.
- **Figma sync policy.** On a conflict: overwrite, skip, or flag for review.
- **3P licence review.** The 61 marks are now imported and public. The review
  has not happened. If it lands badly the collection has to come out of the
  repo and the site, which is one gitignore line and one build exclusion, but
  the git history keeps them either way.
- **Outline and sizes for third-party.** Only 32px exists upstream, and Outline
  does not exist at all.
- **Publishing bar.** Everything is published on the basis that the artwork was
  received. There is no review step behind that, and `deprecated` has never
  been used.
