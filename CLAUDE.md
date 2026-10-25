# rabbit-hole-template

Notes for anyone (person or coding assistant) working in this repo.

## Run it

```bash
npm install
npm run build     # _notes/ → static pages in _site/, then the Vite bundle
npm run preview   # serves the built site
```

`npm run dev` runs only the React UI in `src/`; it does not rebuild note pages.
Re-run `npm run build` after editing `_notes/`.

## Notes

Markdown lives in `_notes/`. Only notes with `publish: true` in their
frontmatter are built; everything else stays private.

## Test it

```bash
npm test
```

Node's built-in test runner, no extra dependencies. Tests live in
`tests/<name>.test.mjs`. Read the `pass N` line: Node exits 0 when it finds
no test files at all.

## Contribute

See [CONTRIBUTING.md](CONTRIBUTING.md). In short:

- keep the template generic and the sample content small
- never commit private notes, personal paths, API keys or secrets
- one focused change per pull request, with a test for new behavior
- run `npm test` and `npm run build` before opening it
