// Public template hygiene (2026-10-25): CI gets a read-only token, and key/env files can't be committed by accident.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('the CI workflow runs with a read-only GITHUB_TOKEN', () => {
  const yml = readFileSync('.github/workflows/build.yml', 'utf8');
  assert.match(yml, /^permissions:\s*\n\s+contents:\s*read\s*$/m);
});

test('.gitignore covers every .env variant and private key files', () => {
  const lines = readFileSync('.gitignore', 'utf8').split('\n').map((l) => l.trim());
  for (const p of ['.env', '.env.*', '!.env.example', '*.pem', '*.key']) assert.ok(lines.includes(p), `missing ${p}`);
});

test('the locked vite is past the 8.0.0-8.1.5 advisory range', () => {
  const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
  const [maj, min, pat] = lock.packages['node_modules/vite'].version.split('.').map(Number);
  assert.ok(maj > 8 || (maj === 8 && (min > 1 || (min === 1 && pat >= 6))), `vite ${maj}.${min}.${pat}`);
});
