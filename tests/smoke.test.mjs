/**
 * Repo smoke tests. Zero dependencies — Node's built-in test runner only.
 *
 *   node --test
 *
 * Guards the failure modes that have actually bitten this fleet:
 *   1. merge-conflict markers reaching a served file (auto-backup.sh only
 *      validates *.json, so a conflicted .html or .mjs ships silently)
 *   2. unparseable JSON (a conflicted data file once wiped live area goals)
 *   3. an asset referenced by HTML that does not exist on disk
 *   4. an HTML page with no <title>
 *
 * Only git-tracked files are inspected, so node_modules and build output are
 * never scanned. Node exits 0 when the glob matches no files, so read the
 * "pass N" line rather than trusting the exit code alone.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const BINARY = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.ico', '.icns',
  '.pdf', '.zip', '.woff', '.woff2', '.ttf', '.otf', '.eot', '.mp4',
  '.mov', '.mp3', '.wav', '.jar', '.gz', '.tgz', '.bin', '.wasm',
]);

function tracked() {
  try {
    return execFileSync('git', ['ls-files', '-z'], { cwd: REPO, maxBuffer: 64 * 1024 * 1024 })
      .toString('utf8').split('\0').filter(Boolean);
  } catch {
    return [];
  }
}

const FILES = tracked();
const EMPTY = FILES.length === 0 ? 'repo has no git-tracked files' : false;
const textFiles = FILES.filter((f) => !BINARY.has(extname(f).toLowerCase()));
const htmlFiles = FILES.filter((f) => /\.html?$/i.test(f));

// tsconfig/jsconfig and .jsonc are JSONC by convention: comments and trailing
// commas are legal there, so JSON.parse is the wrong check for them.
const isJsonc = (f) => /(^|\/)[jt]sconfig[^/]*\.json$/i.test(f) || /\.jsonc$/i.test(f);
const jsonFiles = FILES.filter((f) => /\.json$/i.test(f) && !isJsonc(f));

// A .dc.html is a Claude Design export / template, compiled into a real page
// elsewhere. It is not itself a deployable page.
const isTemplateDoc = (f) => /\.dc\.html?$/i.test(f);

// Vendored or bundled third-party code. Not ours to police, and bundles
// legitimately contain conflict-marker text as documentation (the obsidian-git
// plugin ships a help string showing users what a conflict looks like).
const isVendored = (f) =>
  /(^|\/)(node_modules|vendor|dist|build|_site)\//.test(f) ||
  /(^|\/)\.obsidian\/plugins\//.test(f) ||
  /\.(min|bundle)\.(js|css)$/i.test(f);

// Refs carrying template syntax are resolved by a build step, not the filesystem.
const isTemplated = (ref) => /\{\{|\}\}|\$\{|<%|\{%/.test(ref);

/** A gitignored target is a generated artifact (served HTML, build output).
 *  The repo is only responsible for what it ships, and whether such a file
 *  happens to exist locally varies by machine — so do not assert on it. */
function isIgnored(absPath) {
  try {
    execFileSync('git', ['check-ignore', '-q', absPath], { cwd: REPO, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function read(f) {
  try { return readFileSync(join(REPO, f), 'utf8'); } catch { return null; }
}

/** Roots a root-relative URL may resolve against: the repo, plus any ancestor
 *  directory of the file that looks like an app root (has its own package.json).
 *  A nested Vite app serves "/src/main.tsx" from apps/web, not the repo root. */
let DEPLOY_ROOTS = null;
function deployRoots() {
  if (DEPLOY_ROOTS) return DEPLOY_ROOTS;
  DEPLOY_ROOTS = [];
  try {
    const cfg = JSON.parse(readFileSync(join(REPO, 'vercel.json'), 'utf8'));
    if (cfg.outputDirectory) DEPLOY_ROOTS.push(join(REPO, cfg.outputDirectory));
  } catch { /* no vercel.json, or not JSON */ }
  for (const d of ['_site', 'public', 'dist', 'build', 'out']) {
    const p = join(REPO, d);
    if (existsSync(p)) DEPLOY_ROOTS.push(p);
  }
  return DEPLOY_ROOTS;
}

function rootsFor(file) {
  const roots = [REPO, ...deployRoots()];
  let dir = dirname(join(REPO, file));
  while (dir.startsWith(REPO) && dir !== REPO) {
    if (existsSync(join(dir, 'package.json'))) roots.push(dir);
    dir = dirname(dir);
  }
  return roots;
}

test('repo has git-tracked files (harness is actually wired up)', { skip: EMPTY }, () => {
  assert.ok(FILES.length > 0);
});

test('no merge-conflict markers in tracked text files', { skip: EMPTY }, () => {
  const bad = [];
  // Split the needles so this file never matches itself.
  const needles = ['<'.repeat(7), '>'.repeat(7), '='.repeat(7)];
  for (const f of textFiles) {
    if (isVendored(f)) continue;
    const body = read(f);
    if (body === null) continue;
    const lines = body.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (needles.some((n) => lines[i].startsWith(n))) {
        bad.push(`${f}:${i + 1}: ${lines[i].slice(0, 60)}`);
      }
    }
  }
  assert.deepEqual(bad, [], `conflict markers found:\n${bad.join('\n')}`);
});

test('every tracked .json file parses', { skip: EMPTY }, () => {
  const bad = [];
  for (const f of jsonFiles) {
    const body = read(f);
    if (body === null || body.trim() === '') continue;
    try { JSON.parse(body); } catch (e) { bad.push(`${f}: ${e.message}`); }
  }
  assert.deepEqual(bad, [], `unparseable JSON:\n${bad.join('\n')}`);
});

test('local assets referenced by HTML exist on disk', { skip: EMPTY }, () => {
  const missing = [];
  for (const f of htmlFiles) {
    if (isTemplateDoc(f)) continue;   // design export, not a deployed page
    const raw = read(f);
    if (raw === null) continue;
    // Strip script/style bodies: a src= inside JS is example text a user copies,
    // not an asset this page loads.
    const body = raw
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
    const refs = [...body.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]);
    for (const raw of refs) {
      const ref = raw.trim();
      if (!ref || isTemplated(ref)) continue;
      if (/^(https?:|data:|mailto:|tel:|javascript:|#|\/\/)/i.test(ref)) continue;
      const clean = ref.split('#')[0].split('?')[0];
      if (!clean) continue;
      const candidates = clean.startsWith('/')
        ? rootsFor(f).map((root) => join(root, clean.slice(1)))
        : [join(REPO, dirname(f), clean)];
      if (candidates.some(existsSync)) continue;
      if (candidates.some(isIgnored)) continue;   // generated artifact
      missing.push(`${f} -> ${ref}`);
    }
  }
  assert.deepEqual(missing, [], `referenced files that do not exist:\n${missing.join('\n')}`);
});

test('every HTML page has a non-empty <title>', { skip: EMPTY }, () => {
  const bad = [];
  for (const f of htmlFiles) {
    if (isTemplateDoc(f)) continue;
    const body = read(f);
    if (body === null) continue;
    if (!/<html[\s>]/i.test(body)) continue;   // fragment/partial, not a page
    const m = body.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (!m || !m[1].trim()) bad.push(f);
  }
  assert.deepEqual(bad, [], `HTML pages without a title:\n${bad.join('\n')}`);
});

test('no zero-byte HTML or JSON files', { skip: EMPTY }, () => {
  const bad = [];
  for (const f of [...htmlFiles, ...jsonFiles]) {
    try { if (statSync(join(REPO, f)).size === 0) bad.push(f); } catch { /* raced */ }
  }
  assert.deepEqual(bad, [], `zero-byte files:\n${bad.join('\n')}`);
});
