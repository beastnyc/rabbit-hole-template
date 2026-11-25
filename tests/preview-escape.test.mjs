import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The hover/focus preview covers text and could only be dismissed by moving
// away (WCAG 1.4.13: must be dismissible without moving pointer or focus).
const src = readFileSync(new URL('../src/StackedApp.jsx', import.meta.url), 'utf8');

test('Escape dismisses the link preview and cancels one still loading', () => {
  const i = src.indexOf('dismissOnEscape');
  assert.ok(i > -1);
  const fn = src.slice(i, src.indexOf("removeEventListener('keydown', dismissOnEscape)"));
  assert.match(fn, /e\.key !== 'Escape'/);
  assert.match(fn, /previewRequestRef\.current \+= 1/);
  assert.match(fn, /setPreview\(null\)/);
});
