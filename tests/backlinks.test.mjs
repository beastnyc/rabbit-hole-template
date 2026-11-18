import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Each note lists the published notes that link to it ("Linked from"), so a
// reader can follow a rabbit hole backwards. A private note that links to a
// public one must never show up there.
const repo = fileURLToPath(new URL('..', import.meta.url));
const work = mkdtempSync(join(tmpdir(), 'rh-backlinks-'));
cpSync(join(repo, '_notes'), join(work, '_notes'), { recursive: true });
writeFileSync(join(work, '_notes', 'Private Draft.md'), [
  '---', 'title: Private Draft', 'publish: false', '---', '',
  'Secretly about [[Evergreen Notes]].', '',
].join('\n'));
writeFileSync(join(work, '_notes', 'Odd Title.md'), [
  '---', 'title: "Cats <3 & Dogs"', 'publish: true', '---', '',
  'Twice: [[Evergreen Notes|here]] and [[Evergreen Notes]]. Myself: [[Odd Title]].', '',
].join('\n'));
execFileSync(process.execPath, [join(repo, '_site', 'build.js')], { cwd: work, stdio: 'ignore' });
const page = (id) => readFileSync(join(work, '_site', 'notes', `${id}.html`), 'utf8');
const backlinks = (id) => {
  const body = page(id).match(/<div class="note-body">([\s\S]*?)<\/div>\n/)[1];
  const nav = body.match(/<nav class="note-backlinks" aria-label="Linked from">([\s\S]*?)<\/nav>/);
  return nav ? [...nav[1].matchAll(/<a href="\/notes\/([^"]+)\.html" class="note-link" data-note="\1">([^<]*)<\/a>/g)].map(m => [m[1], m[2]]) : null;
};
test.after(() => rmSync(work, { recursive: true, force: true }));

test('a note lists the published notes that link to it, by title, once each', () => {
  // The sample note's title starts with "§", which sorts before letters.
  assert.deepEqual(backlinks('evergreen-notes'), [
    ['what-s-top-of-mind', "§What's Top Of Mind"],
    ['odd-title', 'Cats &lt;3 &amp; Dogs'],
    ['sample-rabbit-hole', 'Sample Rabbit Hole'],
  ]);
});

test('a private note that links here is never listed or named', () => {
  assert.doesNotMatch(page('evergreen-notes'), /private-draft|Private Draft|Secretly/);
});

test('a note does not list itself', () => {
  assert.equal(backlinks('odd-title'), null);
});

test('the list has a visible heading', () => {
  assert.match(page('sample-rabbit-hole'), /<nav class="note-backlinks" aria-label="Linked from"><h2 class="note-backlinks-title">Linked from<\/h2><ul>/);
});

test('the theme styles it', () => {
  assert.match(readFileSync(join(repo, 'theme', 'note.css'), 'utf8'), /\.note-backlinks\s*\{/);
});
