import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// iPhone Safari zooms the whole page in when you tap an input whose text is under 16px,
// and leaves it zoomed. The phone layout must give the search box 16px text.
const build = readFileSync(new URL('../theme/note.css', import.meta.url), 'utf8');

test('phone search box text is at least 16px so tapping it does not zoom the page', () => {
  const start = build.indexOf('@media (max-width: 900px)');
  assert.ok(start > 0, 'phone media block exists');
  const block = build.slice(start, build.indexOf('.container,', start));
  const m = block.match(/\.search-input\s*\{([^}]*)\}/);
  assert.ok(m, 'phone .search-input rule');
  const size = m[1].match(/font-size:\s*(\d+)px/);
  assert.ok(size, 'phone .search-input sets a font-size');
  assert.ok(Number(size[1]) >= 16, `font-size ${size[1]}px >= 16px`);
});

test('phone search box never grows wider than its row', () => {
  const start = build.indexOf('@media (max-width: 900px)');
  const block = build.slice(start, build.indexOf('.container,', start));
  assert.match(block, /\.search-input\s*\{[^}]*max-width:\s*100%/);
});
