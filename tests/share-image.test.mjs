import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('..', import.meta.url));
const dirs = [];
function build(env) {
  const work = mkdtempSync(join(tmpdir(), 'rh-og-'));
  dirs.push(work);
  for (const name of ['_notes', 'index.html', '404.html', 'favicon.svg', 'og.png']) {
    if (existsSync(join(repo, name))) cpSync(join(repo, name), join(work, name), { recursive: true });
  }
  const cleanEnv = { ...process.env };
  delete cleanEnv.SITE_URL;
  delete cleanEnv.VERCEL_PROJECT_PRODUCTION_URL;
  execFileSync(process.execPath, [join(repo, '_site', 'build.js')], { cwd: work, stdio: 'ignore', env: { ...cleanEnv, ...env } });
  return join(work, '_site');
}
test.after(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

test('og.png is a 1200x630 PNG shipped with the site', () => {
  const out = build({});
  const png = readFileSync(join(out, 'og.png'));
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 630);
});

test('on Vercel, pages point at an absolute share image for the production domain', () => {
  const html = readFileSync(join(build({ VERCEL_PROJECT_PRODUCTION_URL: 'my-hole.vercel.app' }), 'notes', 'index.html'), 'utf8');
  assert.match(html, /<meta property="og:image" content="https:\/\/my-hole\.vercel\.app\/og\.png">/);
  assert.match(html, /<meta name="twitter:card" content="summary_large_image">/);
});

test('SITE_URL overrides the Vercel domain (custom domains)', () => {
  const html = readFileSync(join(build({ SITE_URL: 'https://notes.example.com/', VERCEL_PROJECT_PRODUCTION_URL: 'x.vercel.app' }), 'notes', 'index.html'), 'utf8');
  assert.match(html, /<meta property="og:image" content="https:\/\/notes\.example\.com\/og\.png">/);
});

test('with no known domain, no half-broken relative og:image is emitted', () => {
  const html = readFileSync(join(build({}), 'notes', 'index.html'), 'utf8');
  assert.doesNotMatch(html, /og:image/);
});

test('the root URL (the one people share) carries the share tags too', () => {
  const html = readFileSync(join(build({ VERCEL_PROJECT_PRODUCTION_URL: 'my-hole.vercel.app' }), 'index.html'), 'utf8');
  assert.match(html, /<meta property="og:image" content="https:\/\/my-hole\.vercel\.app\/og\.png">/);
  assert.match(html, /<meta property="og:title" content="[^"]+">/);
  assert.match(html, /<meta name="description" content="[^"]+">/);
  assert.doesNotMatch(html, /<!-- share-image -->/);
});

test('root page has no og:image when no domain is known', () => {
  const html = readFileSync(join(build({}), 'index.html'), 'utf8');
  assert.doesNotMatch(html, /og:image/);
  assert.doesNotMatch(html, /<!-- share-image -->/);
});
