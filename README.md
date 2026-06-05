# Fieldnotes Template

A static note site for public field notes, rabbit holes, and working ideas.

It gives you:

- contextual note panes
- Obsidian-style wiki links
- hover previews before opening links
- search over public notes
- direct URL trails for shared rabbit holes
- a `fieldnotes: true` publishing guardrail
- no backend required

## Quick Start

```bash
npm install
npm run build
npm run preview
```

Then open the local preview URL shown in your terminal.

## How Notes Publish

Write Markdown files in `_notes/`.

Only notes with this frontmatter publish:

```yaml
fieldnotes: true
```

Private notes can stay in `_notes/` with:

```yaml
fieldnotes: false
```

The build skips private notes.

## Note Links

Use Obsidian-style links:

```md
[[Sample Rabbit Hole]]
[[Sample Rabbit Hole|custom label]]
```

The site turns those into contextual note links.

## Deploying To Vercel

This repo includes `vercel.json`.

Vercel settings:

- Build command: `npm run build`
- Output directory: `_site`
- Install command: `npm install`

## Obsidian

See [OBSIDIAN.md](OBSIDIAN.md).

## What This Template Is Not

This is not a hosted CMS, database app, or full private vault system.

It is a static website that publishes approved Markdown notes.
