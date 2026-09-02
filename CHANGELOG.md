# Changelog

What changed, by release. Short entries: enough to remember why, not a second
copy of the commit log. `git log` is still the detailed record.

This file lives in the repo rather than on the site. It is for us.

Versions and what a major, minor or patch means are in [VERSIONING.md](VERSIONING.md).
Assets carry their own `version` and `updated` in `meta.json` and move on their
own schedule; this file tracks the tools and the contract.

---

## Unreleased

- `CLAUDE.md` is the operating manual for anyone, or anything, working in this
  repo: the two rules the library rests on, the house style, what to run before
  a commit, and the traps that have already cost a day between them.

- A 15 second screen recording of the theming story lives at
  `docs/media/expressive-assets-theming.mp4`, so the published site serves it
  as a direct link rather than it living in someone's downloads folder.

- `scripts/record-demo.mjs` records a short screen capture of the theming
  story: cursor, click pulses and highlights are drawn in the page, so the
  browser's own compositor animates them and the capture stays smooth.

**Assets.** 61 third-party brand marks imported (32px, not recolorable, every
one attributed in THIRD-PARTY-NOTICES.md). 32 Windows app tiles imported into
their own `app` collection at 64px. M365 Illustrations replaced: the previous 28
at 160px are gone, 40 new ones at 512px are in. Everything received is now
`published` — 3,234 assets, 14,114 drawings, 980 of them flagged `generated`.

**Structure.** File Icons become their own top-level group, and lose Filled: it
was derived rather than drawn, 799 drawings deleted, and nothing upstream has
one. The `product` collection is labeled Product Icons again, matching Fluent
and Windows, with App Icons as a sibling rather than a suffix on seven ids.
Schema learns `app`, `third-party` and `wip`.

**Tools.** Accent swatches go flat, two colors meeting on a hard edge instead
of blending into a bevel. The Gallery sidebar marks are System Icons from the
library rather than shapes drawn in `app.js`, named by id in
`scripts/inline-nav-icons.mjs`.

**Figma sync.** Fixed a bug where a sync that created nothing also laid out
nothing, so the card layout never once ran on a real file. The plugin now runs
in Node against a fake Figma (`npm run test:plugin`), and both shipped bugs were
reintroduced to confirm the harness fails on them. `figma-sources.json` records
where each collection is pulled from; the pull half is still to build.

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
  properties, laid out by hand into a labeled card. Fixed a bug where a sync
  that changed no artwork also changed no layout.

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

See [NEXT.md](NEXT.md). One list, kept in one place.
