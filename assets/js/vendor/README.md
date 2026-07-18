# Vendored dependencies

These files are committed directly (no npm, no build step) so the app stays a
self-contained set of static files.

- `preact.min.js` — Preact 10.29.7 UMD build, fetched from
  `https://unpkg.com/preact@10.29.7/dist/preact.min.js`
- `htm.js` — htm 3.1.1 UMD build, fetched from
  `https://unpkg.com/htm@3.1.1/dist/htm.js`

Both are loaded as plain classic `<script>` tags (not ES modules) and attach
`self.preact` / `self.htm` globals. This matters because ES module scripts
are fetched with CORS mode, which browsers refuse for `file://` origins —
that would break opening `index.html` directly without a server. Classic
scripts have no such restriction, so the zero-build, open-directly workflow
keeps working.
