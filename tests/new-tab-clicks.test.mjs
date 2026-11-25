import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Cmd/Ctrl/Shift-click on a note link was swallowed by the stack, so a note
// could not be opened in a new tab or window.
const src = readFileSync(new URL('../src/StackedApp.jsx', import.meta.url), 'utf8');
const build = readFileSync(new URL('../_site/build.js', import.meta.url), 'utf8');
const { isPlainClick } = await import('../src/plainClick.mjs').catch(() => ({}));
const ev = (o = {}) => ({ button: 0, defaultPrevented: false, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, ...o });

test('a plain left click opens in the stack', () => {
  assert.equal(isPlainClick(ev()), true);
});
for (const k of ['metaKey', 'ctrlKey', 'shiftKey', 'altKey']) {
  test(`${k} click is left to the browser`, () => assert.equal(isPlainClick(ev({ [k]: true })), false));
}
test('middle click and already-handled clicks are left alone', () => {
  assert.equal(isPlainClick(ev({ button: 1 })), false);
  assert.equal(isPlainClick(ev({ defaultPrevented: true })), false);
});
test('the React stack checks before taking over the click', () => {
  const fn = src.slice(src.indexOf('const handleClick'), src.indexOf('const handlePreviewOver'));
  assert.ok(fn.indexOf('isPlainClick(e)') > -1 && fn.indexOf('isPlainClick(e)') < fn.indexOf('e.preventDefault()'));
});
test('the no-React fallback makes the same check', () => {
  const fn = build.slice(build.indexOf('// Intercept internal note links broadly'), build.indexOf('// Determine which panel the click came from'));
  assert.match(fn, /e\.metaKey \|\| e\.ctrlKey \|\| e\.shiftKey \|\| e\.altKey/);
});
test('a modified click on a link in an earlier note does not close the notes after it', () => {
  const panel = src.slice(src.indexOf('const Panel ='), src.indexOf('export default'));
  assert.match(panel, /closest\('a\[href\]'\) && !isPlainClick\(e\)\) return;/);
  assert.doesNotMatch(panel, /onClick=\{shouldHandleClick \? onClick : undefined\}/);
});
