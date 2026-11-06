import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The trail bar was a <div aria-label="Rabbit hole trail">: screen readers ignore
// aria-label on a plain div, so the trail had no name and no "you are here".
const src = readFileSync(new URL('../src/StackedApp.jsx', import.meta.url), 'utf8');
const bar = src.slice(src.indexOf('className="trail-bar"') - 60, src.indexOf('id="stack"'));

test('the trail bar is a named nav landmark', () => {
  assert.match(bar, /<nav className="trail-bar" aria-label="Rabbit hole trail">/);
  assert.match(bar, /<\/nav>/);
  assert.doesNotMatch(bar, /<div className="trail-bar"/);
});

test('the chip for the note you are on carries aria-current', () => {
  // start chip when it is the only panel, otherwise the last path chip (the .active one)
  assert.match(bar, /aria-current=\{panels\.length === 1 \? 'location' : undefined\}/);
  assert.match(bar, /aria-current=\{panelIndex === panels\.length - 1 \? 'location' : undefined\}/);
});
