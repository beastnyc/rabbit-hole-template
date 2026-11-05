import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The note-page styles live in theme/note.css; check the rules it holds.
const build = readFileSync(new URL('../theme/note.css', import.meta.url), 'utf8');
const rule = (sel) => {
  const m = build.match(new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}'));
  return m ? m[1] : '';
};

test('search box shows a solid keyboard focus ring, not just a faint glow', () => {
  const css = rule('.search-input:focus-visible');
  assert.match(css, /outline:\s*2px solid var\(--text-primary\)/, 'search-input:focus-visible outline');
});

test('search results show keyboard focus like hover', () => {
  const css = rule('.search-result:focus-visible');
  assert.match(css, /outline:\s*2px solid var\(--text-primary\)/, 'search-result:focus-visible outline');
  assert.match(css, /background:\s*rgba\(255, 107, 53, 0\.08\)/, 'same tint as hover');
});
