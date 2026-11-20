import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// A note that teaches the [[link]] syntax shows it in code. Inside inline
// code or a code block it must stay literal text: no link, and no entry in
// the target's "Linked from" list.
const repo = fileURLToPath(new URL('..', import.meta.url));
const work = mkdtempSync(join(tmpdir(), 'rh-code-links-'));
cpSync(join(repo, '_notes'), join(work, '_notes'), { recursive: true });
writeFileSync(join(work, '_notes', 'Syntax Help.md'), [
  '---', 'title: Syntax Help', 'publish: true', '---', '',
  'Write `[[Evergreen Notes]]` to link a note.', '',
  '```', '[[Evergreen Notes|fenced]]', '```', '',
  '~~~md', '[[Evergreen Notes]]', '~~~', '',
  '    [[Evergreen Notes]] indented', '',
].join('\n'));
writeFileSync(join(work, '_notes', 'Mixed Help.md'), [
  '---', 'title: Mixed Help', 'publish: true', '---', '',
  'Like `[[Evergreen Notes]]`, which renders as [[Evergreen Notes|this]].', '',
].join('\n'));
execFileSync(process.execPath, [join(repo, '_site', 'build.js')], { cwd: work, stdio: 'ignore' });
const page = (id) => readFileSync(join(work, '_site', 'notes', `${id}.html`), 'utf8');
const body = (id) => page(id).match(/<div class="note-body">([\s\S]*?)<\/div>\n/)[1];
test.after(() => rmSync(work, { recursive: true, force: true }));

test('[[links]] in inline code and code blocks stay literal', () => {
  const html = body('syntax-help');
  assert.doesNotMatch(html, /note-link/);
  assert.match(html, /<code>\[\[Evergreen Notes\]\]<\/code>/);
  assert.match(html, /<pre><code>\[\[Evergreen Notes\|fenced\]\]/);
});

test('a note that only shows the syntax in code is not a backlink', () => {
  assert.doesNotMatch(page('evergreen-notes'), /syntax-help|Syntax Help/);
});

test('a real link next to a code sample still links and counts', () => {
  const html = body('mixed-help');
  assert.match(html, /<code>\[\[Evergreen Notes\]\]<\/code>/);
  assert.match(html, /<a href="\/notes\/evergreen-notes.html" class="note-link" data-note="evergreen-notes">this<\/a>/);
  assert.match(page('evergreen-notes'), /data-note="mixed-help">Mixed Help<\/a>/);
});
