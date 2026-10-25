import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Build a copy of the sample notes plus one note that links to a note that
// does not exist yet and to the private sample draft.
const repo = fileURLToPath(new URL('..', import.meta.url));
const work = mkdtempSync(join(tmpdir(), 'rh-links-'));
cpSync(join(repo, '_notes'), join(work, '_notes'), { recursive: true });
writeFileSync(join(work, '_notes', 'Link Test.md'), [
  '---', 'title: Link Test', 'publish: true', '---', '',
  'Published: [[Evergreen Notes]]. Not written yet: [[Some Future Note|future]]. Private: [[Private Draft]].', '',
].join('\n'));
execFileSync(process.execPath, [join(repo, '_site', 'build.js')], { cwd: work, stdio: 'ignore' });
const html = readFileSync(join(work, '_site', 'notes', 'link-test.html'), 'utf8');
test.after(() => rmSync(work, { recursive: true, force: true }));

test('a link to a published note stays a note link', () => {
  assert.match(html, /<a href="\/notes\/evergreen-notes\.html" class="note-link" data-note="evergreen-notes">Evergreen Notes<\/a>/);
});

test('a link to a note that does not exist renders as plain text, not a 404 link', () => {
  assert.ok(!existsSync(join(work, '_site', 'notes', 'some-future-note.html')));
  assert.doesNotMatch(html, /some-future-note\.html/);
  assert.match(html, /<span class="note-link-missing">future<\/span>/);
});

test('a link to a private note does not point at it', () => {
  assert.doesNotMatch(html, /private-draft\.html/);
  assert.match(html, /<span class="note-link-missing">Private Draft<\/span>/);
});
