import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

// Search results were built by gluing note titles/excerpts straight into innerHTML,
// so a note called "Tags <b> & friends" rendered broken (and a stray tag could run).
// Build a note page, run its search script against a stub DOM, check text stays text.
const root = fileURLToPath(new URL('..', import.meta.url));
execFileSync(process.execPath, ['_site/build.js'], { cwd: root, stdio: 'ignore' });
const page = readFileSync(new URL('../_site/notes/sample-rabbit-hole.html', import.meta.url), 'utf8');
const start = page.indexOf("const input = document.getElementById('searchInput');");
const end = page.indexOf('// Multi-panel navigation');
assert.ok(start > 0 && end > start, 'search script not found in the built note page');
const script = '(async function(){' + page.slice(start, page.lastIndexOf('})();', end)) + '})()';

async function search(notes, query) {
  const handlers = {};
  const input = { addEventListener: (t, fn) => { handlers[t] = fn; } };
  const results = { innerHTML: '', classList: { add() {}, remove() {} }, contains: () => false };
  const document = {
    getElementById: (id) => (id === 'searchInput' ? input : id === 'searchResults' ? results : null),
    addEventListener() {},
  };
  const fetch = async () => ({ json: async () => notes });
  await vm.runInNewContext(script, { document, fetch, String, Array, Promise });
  await new Promise((r) => setTimeout(r, 0));
  handlers.input({ target: { value: query } });
  return results.innerHTML;
}

test('note titles and excerpts with < and & show as text in search results', async () => {
  const html = await search([{
    title: 'Tags <img src=x onerror=alert(1)> & friends',
    excerpt: 'a < b && c',
    type: 'note', status: '<i>draft</i>',
    url: '/notes/x.html" onmouseover="alert(1)',
  }], 'tags');
  assert.ok(!html.includes('<img'), 'title tag was injected: ' + html);
  assert.ok(!html.includes('<i>'), 'status tag was injected');
  assert.match(html, /Tags &lt;img src=x onerror=alert\(1\)&gt; &amp; friends/);
  assert.match(html, /a &lt; b &amp;&amp; c/);
  assert.match(html, /href="\/notes\/x\.html&quot; onmouseover=&quot;alert\(1\)"/);
});

test('ordinary results still render as links', async () => {
  const html = await search([{ title: 'Evergreen notes', excerpt: 'grow', url: '/notes/evergreen-notes.html', type: 'note' }], 'evergreen');
  assert.match(html, /<a class="search-result" href="\/notes\/evergreen-notes\.html">/);
  assert.match(html, /<div class="search-result-title">Evergreen notes<\/div>/);
});
