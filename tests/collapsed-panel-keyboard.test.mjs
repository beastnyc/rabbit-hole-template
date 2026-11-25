import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { collapsedPanelProps } from '../src/collapsedPanel.mjs';

test('collapsed panels become a focusable button named after the note', () => {
  const props = collapsedPanelProps({ collapsed: true, title: 'Soft focus', onActivate() {} });
  assert.equal(props.role, 'button');
  assert.equal(props.tabIndex, 0);
  assert.equal(props['aria-label'], 'Back to Soft focus');
});

test('Enter and Space open the collapsed note; other keys do nothing', () => {
  let opened = 0;
  let prevented = 0;
  const props = collapsedPanelProps({ collapsed: true, title: '', onActivate: () => { opened += 1; } });
  assert.equal(props['aria-label'], 'Back to Note');
  for (const key of ['Enter', ' ', 'Tab', 'a']) {
    props.onKeyDown({ key, preventDefault: () => { prevented += 1; } });
  }
  assert.equal(opened, 2);
  assert.equal(prevented, 2);
});

test('full panels get no button role (their links stay the tab stops)', () => {
  assert.deepEqual(collapsedPanelProps({ collapsed: false, title: 'x', onActivate() {} }), {});
});

test('Panel spreads the props and the strip has a visible focus ring', () => {
  const src = readFileSync(new URL('../src/StackedApp.jsx', import.meta.url), 'utf8');
  assert.match(src, /import \{ collapsedPanelProps \} from '\.\/collapsedPanel\.mjs'/);
  assert.match(src, /\{\.\.\.collapsedPanelProps\(/);
  const build = readFileSync(new URL('../theme/note.css', import.meta.url), 'utf8');
  const m = build.match(/\.note-panel\.collapsed:focus-visible\s*\{([^}]*)\}/);
  assert.ok(m, '.note-panel.collapsed:focus-visible rule');
  assert.match(m[1], /outline:\s*2px solid var\(--text-primary\)/);
});
