# Vendored dependencies

These files are committed directly (no npm, no build step) so the app stays a
self-contained set of static files.

- `preact.module.js` — Preact 10.29.7, fetched from
  `https://unpkg.com/preact@10.29.7/dist/preact.module.js`
- `htm.module.js` — htm 3.1.1, fetched from
  `https://unpkg.com/htm@3.1.1/dist/htm.module.js`

Both are ES modules, imported via relative path — no CDN or network access
is required at runtime.
