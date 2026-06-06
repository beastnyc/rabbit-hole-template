# Using This With Obsidian

This template does not require Obsidian, but it works well with it.

There are two good workflows.

## Option 1: Use This Repo As A Small Obsidian Vault

Open this repo folder as a vault in Obsidian.

Write public notes in:

```text
_notes/
```

Add this to notes you want published:

```yaml
publish: true
```

Use this for notes you do not want published:

```yaml
publish: false
```

This is the simplest setup.

## Option 2: Keep Your Real Vault Separate

Keep your private vault wherever it already lives.

When a note is ready for the website, copy or export it into this repo's `_notes/` folder and add:

```yaml
publish: true
```

This is safer if your real vault contains private material.

## Recommended Frontmatter

```yaml
---
layout: note
title: My Note Title
description: A short description for search and previews
last_modified: 2026-06-05
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

## Safety Rule

Do not point the builder at your whole private vault unless you are comfortable with every note being scanned.

The safer pattern is:

```text
private vault -> selected public notes -> _notes/
```

The `publish: true` guardrail is helpful, but a small public publishing folder is easier to audit.
