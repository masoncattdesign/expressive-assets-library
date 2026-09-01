# Expressive Assets Sync

Builds and updates a Figma page from the library, so a page of artwork can be
kept in step with `manifest.json` instead of being redrawn by hand.

## Running it

Figma desktop, Plugins → Development → Import plugin from manifest, and pick
`plugin/manifest.json`. No build step: the plugin is plain JavaScript.

The plugin fetches over the network, so it needs a source it can reach:

| Source | Use when |
|---|---|
| `https://masoncattdesign.github.io/expressive-assets-library` | Normal. The published site. |
| `http://localhost:4173` | You are running `npm run dev` and want to see local changes before pushing. |

Once the site moves behind Entra sign-in, neither will work: a plugin cannot
carry a browser session. At that point either point it at
`raw.githubusercontent.com` for the repo, or bake the artwork into the plugin at
build time, which is what Bridge Builder does.

## What it does

One direction only, library to Figma. It never writes back, and it never
deletes.

  - Creates the page and the section-per-style, row-per-icon layout if missing.
  - Adds a cell for every style and size in the manifest.
  - Replaces the artwork in a cell when the library's drawing has changed, and
    leaves it alone when it has not.
  - Reports anything on the page that the library does not have, rather than
    removing it. A node the library does not know about is usually a designer's
    work in progress, and deleting it would be the worst possible default.

Every artwork node is named `<asset id>/<style>/<size>`, which is how the
plugin finds it again on the next run and how the importer will read it going
back the other way. Renaming a node breaks the link; moving it does not.

A hash of the drawing is stored on each node with `setPluginData`. That is what
makes "has this changed since last sync" answerable without comparing SVG text
on every run, and it is invisible in the layer panel.

## Placeholders

Cells the library generated rather than authored are drawn on an amber ground.
180 of the 1,620 product icon cells are stand-ins today: 84 are the same drawing
shown at another size, 96 are silhouettes derived from Standard. They are on the
page so the matrix is square and the gaps are visible, not because they are
finished.

## What it does not do

There is no automatic sync. Nothing can push into a Figma file unattended, so
someone opens the file and runs this. Going the other way, `scripts/import-figma.mjs`
already renders Figma nodes back into the library; the policy for what happens
when both sides changed is still to be settled.
