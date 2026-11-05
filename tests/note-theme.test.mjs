import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Note-page styles live in one plain stylesheet people can edit to theme their
// site; the builder inlines it into every note page.
const repo = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => readFileSync(join(repo, p), 'utf8');

test('theme/note.css is a real stylesheet with the color variables', () => {
  assert.ok(existsSync(join(repo, 'theme', 'note.css')), 'theme/note.css missing');
  const css = read('theme/note.css');
  assert.match(css, /^:root \{/m, ':root at the left margin, not indented like a JS string');
  assert.match(css, /--bg-primary:/);
  assert.match(css, /\.note-panel\s*\{/);
});

test('the builder no longer carries the CSS as a JS string', () => {
  const build = read('_site/build.js');
  assert.doesNotMatch(build, /--bg-primary:/);
  assert.match(build, /theme', 'note\.css'/);
});

test('built note pages inline theme/note.css', () => {
  const work = mkdtempSync(join(tmpdir(), 'rh-theme-'));
  try {
    for (const name of ['_notes', 'index.html', '404.html', 'favicon.svg']) {
      if (existsSync(join(repo, name))) cpSync(join(repo, name), join(work, name), { recursive: true });
    }
    execFileSync(process.execPath, [join(repo, '_site', 'build.js')], { cwd: work, stdio: 'ignore' });
    const dir = join(work, '_site', 'notes');
    const pages = readdirSync(dir).filter((f) => f.endsWith('.html') && !readFileSync(join(dir, f), 'utf8').includes('http-equiv="refresh"'));
    assert.ok(pages.length >= 3, `only ${pages.length} pages`);
    const marker = read('theme/note.css').split('\n').find((l) => l.includes('--bg-primary:')).trim();
    for (const f of pages) assert.ok(readFileSync(join(dir, f), 'utf8').includes(marker), `${f} lacks theme CSS`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test('README points people at theme/note.css', () => {
  assert.match(read('README.md'), /## Theming[\s\S]*theme\/note\.css/);
});
