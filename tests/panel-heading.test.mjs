import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// With several notes open every panel title was an h1; only the note being read is.
const { panelHeadingTag } = await import('../src/panelHeading.mjs').catch(() => ({}));

test('only the rightmost open note is the h1', () => {
  assert.equal(panelHeadingTag(0, 1), 'h1');
  assert.deepEqual([0, 1, 2].map((i) => panelHeadingTag(i, 3)), ['h2', 'h2', 'h1']);
});

test('Panel uses it for the note title', () => {
  const src = readFileSync(new URL('../src/StackedApp.jsx', import.meta.url), 'utf8');
  assert.match(src, /panelHeadingTag\(index, totalPanels\)/);
  assert.match(src, /<Heading className="note-title">/);
});
