# Rabbit Hole Template

A static website template for public rabbit holes, research trails, field notes, and working ideas.

It gives you:

- contextual note panes
- an always-visible trail back to the starting note
- Obsidian-style wiki links
- hover previews before opening links
- search over public notes
- direct URL trails for shared rabbit holes
- a `publish: true` guardrail
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
publish: true
```

Private notes can stay in `_notes/` with:

```yaml
publish: false
```

The builder also understands `fieldnotes: true` for older Field Notes setups, but new notes should use `publish`.

## What Makes A Rabbit Hole

A rabbit hole is a trail of linked notes, not a polished essay.

Good starter shape:

- what sent me in
- what I found
- what surprised me
- what it connects to
- what I might do with it
- sources or links

Use `rabbit_hole` frontmatter to group notes that belong to the same trail.

## Note Links

Use Obsidian-style links:

```md
[[Sample Rabbit Hole]]
[[Sample Rabbit Hole|custom label]]
```

The site turns those into contextual note links.

## Recommended Frontmatter

```yaml
---
title: My Note Title
description: A short description for search and previews
last_modified: 2026-06-06
publish: true
type: spark
rabbit_hole: my-rabbit-hole
status: open
energy: low
patterns:
  - attention
  - language
tags:
  - example
---
```

Useful `type` values:

- `spark`
- `field-note`
- `term`
- `pattern`
- `source`
- `project-bridge`
- `index`

Useful `status` values:

- `open`
- `simmering`
- `closed`
- `became-project`

## Deploying To Vercel

This repo includes `vercel.json`.

Vercel settings:

- Build command: `npm run build`
- Output directory: `_site`
- Install command: `npm install`

## GitHub Template Setup

After pushing this repo to GitHub:

1. Open the repository settings.
2. Turn on **Template repository**.
3. Keep the repo public if you want others to use it.
4. Add topics like `digital-garden`, `obsidian`, `markdown`, `static-site`, `rabbit-hole`, and `notes`.

## Obsidian

See [OBSIDIAN.md](OBSIDIAN.md).

## Privacy Checklist

Before publishing a real notes site:

- keep your private vault separate from this repo
- copy or export only public-ready notes into `_notes/`
- confirm private notes use `publish: false`
- run `npm run build`
- check `_site/notes.json` for anything that should not be public

## What This Template Is Not

This is not a hosted CMS, database app, or full private vault system.

It is a static website that publishes approved Markdown notes.
