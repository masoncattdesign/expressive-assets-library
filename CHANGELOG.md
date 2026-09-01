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
- **Figma sync policy.** On a conflict: overwrite, skip, or flag for review.
- **3P icons.** 70 third-party trademarks, deliberately unimported pending a
  licence review.
- **Publishing bar.** Everything is published on the basis that the artwork was
  received. There is no review step behind that, and `deprecated` has never
  been used.
