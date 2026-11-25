import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stackScrollTarget } from '../src/stackScroll.mjs';

// Run the real note builder against a copy of the repo inputs in a temp dir.
const repo = fileURLToPath(new URL('..', import.meta.url));
const work = mkdtempSync(join(tmpdir(), 'rh-landmarks-'));
for (const name of ['_notes', 'index.html', 'favicon.svg', 'og.png']) {
  if (existsSync(join(repo, name))) cpSync(join(repo, name), join(work, name), { recursive: true, filter: (p) => !p.includes('node_modules') });
}
execFileSync(process.execPath, [join(repo, '_site', 'build.js')], { cwd: work, stdio: 'ignore' });
const out = join(work, '_site');
const notePages = readdirSync(join(out, 'notes')).filter((f) => f.endsWith('.html'));
const read = (f) => readFileSync(join(out, 'notes', f), 'utf8');
const publicPages = notePages.filter((f) => !read(f).includes('http-equiv="refresh"'));
test.after(() => rmSync(work, { recursive: true, force: true }));

test('every note page has one header (site nav) and one main landmark around the notes', () => {
  assert.ok(publicPages.length >= 3);
  for (const f of publicPages) {
    const html = read(f);
    assert.equal((html.match(/<header\b/g) || []).length, 1, `${f}: header count`);
    assert.match(html, /<header class="top-nav">[\s\S]*?id="searchInput"[\s\S]*?<\/header>/, `${f}: nav + search live in the header`);
    assert.equal((html.match(/<main\b/g) || []).length, 1, `${f}: main count`);
    assert.match(html, /<main[^>]*>[\s\S]*id="container"[\s\S]*id="stack-root"[\s\S]*<\/main>/, `${f}: notes live inside main`);
  }
});

test('the main landmark keeps the full-height stack layout', () => {
  const html = read('index.html');
  assert.match(html, /\.note-main\s*\{[^}]*flex:\s*1 1 auto;[^}]*min-height:\s*0;/);
});

test('note pages calm animations and smooth scrolling for reduced-motion users', () => {
  const html = read('index.html');
  const block = html.match(/@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n        \}/);
  assert.ok(block, 'no prefers-reduced-motion block');
  assert.match(block[1], /transition:\s*none\s*!important/);
  assert.match(block[1], /scroll-behavior:\s*auto\s*!important/);
});

test('stack scroll jumps instead of gliding when reduced motion is on', () => {
  assert.deepEqual(
    stackScrollTarget({ flexDirection: 'column', panelCount: 2, lastPanelOffsetTop: 741, reducedMotion: true }),
    { top: 741, behavior: 'auto' }
  );
  assert.deepEqual(
    stackScrollTarget({ flexDirection: 'row', panelCount: 3, lastPanelOffsetTop: 0, reducedMotion: true }),
    { left: 0, behavior: 'auto' }
  );
});

test('StackedApp tells the scroll helper about prefers-reduced-motion', () => {
  const src = readFileSync(join(repo, 'src', 'StackedApp.jsx'), 'utf8');
  assert.match(src, /reducedMotion:\s*[^,}]*matchMedia(?:\?\.)?\(['"]\(prefers-reduced-motion: reduce\)['"]\)/);
});
