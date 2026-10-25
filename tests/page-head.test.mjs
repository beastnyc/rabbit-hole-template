import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Run the real note builder against a copy of the repo inputs in a temp dir.
const repo = fileURLToPath(new URL('..', import.meta.url));
const work = mkdtempSync(join(tmpdir(), 'rh-build-'));
for (const name of ['_notes', 'index.html', '404.html', 'favicon.svg']) {
  if (existsSync(join(repo, name))) cpSync(join(repo, name), join(work, name), { recursive: true });
}
execFileSync(process.execPath, [join(repo, '_site', 'build.js')], { cwd: work, stdio: 'ignore' });
const out = join(work, '_site');
const read = (f) => readFileSync(join(out, 'notes', f), 'utf8');
const pages = readdirSync(join(out, 'notes')).filter((f) => f.endsWith('.html') && !read(f).includes('http-equiv="refresh"'));
test.after(() => rmSync(work, { recursive: true, force: true }));

test('builder produced the sample note pages', () => {
  assert.ok(pages.length >= 3, `only ${pages.length} pages`);
});

test('every page has a favicon that ships with the site', () => {
  assert.ok(existsSync(join(out, 'favicon.svg')), 'favicon.svg not copied into _site');
  for (const f of pages) assert.match(read(f), /<link rel="icon" href="\/favicon\.svg" type="image\/svg\+xml">/, f);
  assert.match(readFileSync(join(out, '404.html'), 'utf8'), /<link rel="icon" href="\/favicon\.svg"/);
});

test('search box has an accessible name', () => {
  for (const f of pages) assert.match(read(f), /<input [^>]*id="searchInput"[^>]*aria-label="Search notes"/, f);
});

test('every page has a description and share title taken from the note itself', () => {
  for (const f of pages) {
    const html = read(f);
    const desc = html.match(/<meta name="description" content="([^"]*)">/);
    assert.ok(desc && desc[1].trim().length > 20, `${f}: missing description`);
    assert.match(html, /<meta property="og:title" content="[^"]+">/, f);
    assert.match(html, /<meta property="og:description" content="[^"]+">/, f);
  }
});

test('site title link is a 24px+ tap target', () => {
  assert.match(read(pages[0]), /\.site-title\s*\{[^}]*min-height:\s*24px/);
});
