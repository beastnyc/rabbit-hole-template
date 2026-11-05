import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';

// A template people copy shouldn't phone Google on every page view by default
// (privacy, and it fails offline). Fonts fall back to the system stack.
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('builder and 404 page load no web fonts from Google', () => {
  for (const file of ['_site/build.js', 'theme/note.css', '404.html', 'index.html']) {
    assert.doesNotMatch(read(file), /fonts\.(googleapis|gstatic)\.com/, file);
  }
});

test('font stack still prefers Inter, then the system font', () => {
  assert.match(read('theme/note.css'), /font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;/);
  assert.match(read('404.html'), /font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;/);
});

test('built note pages make no font requests either', () => {
  const dir = new URL('../_site/notes/', import.meta.url);
  const pages = readdirSync(dir).filter((f) => f.endsWith('.html'));
  assert.ok(pages.length > 0, 'run npm run build first');
  for (const page of pages) {
    assert.doesNotMatch(readFileSync(new URL(page, dir), 'utf8'), /fonts\.(googleapis|gstatic)\.com/, page);
  }
});

test('README says how to add a web font back', () => {
  assert.match(read('README.md'), /## Fonts[\s\S]*system font[\s\S]*self-host/i);
});
