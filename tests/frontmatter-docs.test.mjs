// README frontmatter (2026-11-10): the recommended block listed energy,
// patterns, tags and rabbit_hole, but never said what any of them do, so a
// fork couldn't tell which fields show on the page and which only feed search.
// Every field the builder reads is now explained, and the wording matches the code.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const readme = readFileSync('README.md', 'utf8');
const build = readFileSync('_site/build.js', 'utf8');
const app = readFileSync('src/StackedApp.jsx', 'utf8');

const section = () => {
  const start = readme.indexOf('### What each field does');
  assert.ok(start > -1, 'README has a "What each field does" section');
  return readme.slice(start, readme.indexOf('\n## ', start));
};

test('every frontmatter field the builder reads is explained', () => {
  const s = section();
  for (const field of ['title', 'description', 'last_modified', 'publish', 'type', 'status', 'rabbit_hole', 'energy', 'patterns', 'tags']) {
    assert.match(s, new RegExp('`' + field + '`'), `explains ${field}`);
    assert.ok(build.includes('attributes.' + field), `builder really reads ${field}`);
  }
});

test('docs match what the note panel shows: type, status, rabbit_hole, energy chips', () => {
  assert.match(app, /meta\?\.type, meta\?\.status, meta\?\.rabbitHole, meta\?\.energy/);
  assert.match(section(), /chips under the note/i);
});

test('docs say patterns and tags are search-only', () => {
  assert.match(section(), /`patterns`[^\n]*search/i);
  assert.match(section(), /`tags`[^\n]*search/i);
});
