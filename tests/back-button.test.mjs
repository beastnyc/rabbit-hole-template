import test from 'node:test';
import assert from 'node:assert/strict';
import { panelsToKeep } from '../src/stackHistory.mjs';

// Opening a note pushes a history entry (?stackedNotes=index&stackedNotes=a…),
// but nothing listened for Back, so the URL changed and the panels stayed put.

test('Back to a shorter trail keeps just those leading panels', () => {
  assert.equal(panelsToKeep(['index', 'a', 'b'], ['index', 'a']), 2);
});

test('Back to the bare start page (no stackedNotes) keeps only the first panel', () => {
  assert.equal(panelsToKeep(['index', 'a', 'b'], []), 1);
});

test('a trail that matches what is open changes nothing', () => {
  assert.equal(panelsToKeep(['index', 'a'], ['index', 'a']), 2);
});

test('Forward into a closed note, or a different branch, asks for a reload (-1)', () => {
  assert.equal(panelsToKeep(['index'], ['index', 'a']), -1);
  assert.equal(panelsToKeep(['index', 'c'], ['index', 'a', 'b']), -1);
});

test('StackedApp listens for popstate and uses the helper', async () => {
  const { readFile } = await import('node:fs/promises');
  const src = await readFile(new URL('../src/StackedApp.jsx', import.meta.url), 'utf8');
  assert.match(src, /import \{ panelsToKeep \} from '\.\/stackHistory\.mjs'/);
  assert.match(src, /addEventListener\('popstate'/);
  assert.match(src, /removeEventListener\('popstate'/);
  assert.match(src, /panelsToKeep\(/);
});
