// CI must run the test suite, not just the build, so a PR that breaks the
// template's guarantees (head tags, share image, link handling) is caught.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync(new URL('../.github/workflows/build.yml', import.meta.url), 'utf8');

test('CI runs npm test after the build', () => {
  const build = workflow.indexOf('run: npm run build');
  const tests = workflow.indexOf('run: npm test');
  assert.ok(build > -1, 'build step present');
  assert.ok(tests > build, 'npm test step runs after the build');
});
