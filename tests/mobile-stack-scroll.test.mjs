import test from 'node:test';
import assert from 'node:assert/strict';
import { stackScrollTarget } from '../src/stackScroll.mjs';

test('phone layout (panels stacked in a column) scrolls down to the newest note', () => {
  assert.deepEqual(
    stackScrollTarget({ flexDirection: 'column', panelCount: 2, lastPanelOffsetTop: 741 }),
    { top: 741, behavior: 'smooth' }
  );
});

test('phone layout with only the start note stays at the top', () => {
  assert.deepEqual(
    stackScrollTarget({ flexDirection: 'column', panelCount: 1, lastPanelOffsetTop: 0 }),
    { top: 0, behavior: 'smooth' }
  );
});

test('desktop layout (panels side by side) keeps the existing left reset', () => {
  assert.deepEqual(
    stackScrollTarget({ flexDirection: 'row', panelCount: 3, lastPanelOffsetTop: 0 }),
    { left: 0, behavior: 'smooth' }
  );
});

test('StackedApp uses the helper when panels change', async () => {
  const { readFile } = await import('node:fs/promises');
  const src = await readFile(new URL('../src/StackedApp.jsx', import.meta.url), 'utf8');
  assert.match(src, /import \{ stackScrollTarget \} from '\.\/stackScroll\.mjs'/);
  assert.match(src, /container\.scrollTo\(\s*stackScrollTarget\(/);
});
