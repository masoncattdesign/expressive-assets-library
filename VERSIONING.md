# Versions

One version for the whole surface. Gallery, Customizer and the documents move
together and carry the same number, because the point is that people read them
as one system; a Gallery 1.4 sitting next to a Customizer 1.1 says the opposite.

The number is shown in each tool's sidebar and on About.

## What each part means

**Major — 2.0**
The contract breaks. `manifest.json` changes shape, asset ids change, a theme or
size vocabulary is renamed. Anything a consumer would have to rewrite code for.

**Minor — 1.2**
The tools visibly change. A new tool, a new page, a restyle, a layout people
have to relearn. Users notice and may need telling.

**Patch — 1.2.1**
Fixes, copy, corrections, a wrong drawing replaced. Real work, but nobody needs
to be told.

Note that 1.12 is not a thing. It sorts before 1.2 and reads as a typo.

## History

| Version | What changed |
|---|---|
| 1.0 | Gallery, and the first Customizer. |
| 1.1 | Customizer rebuilt in the Gallery shell; the panel takes its shape from the asset family; About, System Map and Asset Anatomy added as one set of documents. |
| 1.2 | Aligned to Bridge: ink accent, pill controls, no shadows, Bridge's neutral ramp and type scale. Dark theme kept and given an explicit control. |
| 2.0 | **Contract break.** `manifest.json` groups gained an `id` and no longer map one-to-one onto `type`, so a consumer keyed on `type` to find a group has to change. The asset field `placeholders` became `generated` and widened to mean any drawing produced here rather than received. Also in this release, and not the reason for the major: the sidebar splits into Product Icons, System Icons and Illustrations; the theme control and a page menu move to the toolbar and Auto is dropped; every asset is published. |

## The asset library is versioned separately

Assets carry their own `version` and `updated` in `meta.json`, and change on
their own schedule. A new drawing for one icon is not a release of the tools.
