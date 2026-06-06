# Security

This template is a static site builder for public Markdown notes.

## Main Risk

The main risk is publishing a note, attachment, or generated search index that should have stayed private.

## Safe Publishing Pattern

- Keep your real private vault separate.
- Copy or export only public-ready notes into `_notes/`.
- Use `publish: true` only on notes meant for the public site.
- Run `npm run build`.
- Review `_site/notes.json` before deployment.

## Reporting Issues

If you find a security issue in the template code, open a private security advisory on GitHub if available. If not, open an issue with a minimal description and avoid including private data.
