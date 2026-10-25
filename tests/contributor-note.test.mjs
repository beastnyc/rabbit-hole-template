// Public template (2026-10-25): CLAUDE.md is a short generic contributor note,
// not the maintainer's internal build notes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const note = readFileSync('CLAUDE.md', 'utf8');

test('CLAUDE.md carries no internal build notes', () => {
  for (const s of ['BUILD-CONTRACT', 'Bianca', 'Mission Control', 'mission-control', 'the Mini', 'handoff', 'Codex', 'overnight']) {
    assert.ok(!note.toLowerCase().includes(s.toLowerCase()), `mentions ${s}`);
  }
});

test('CLAUDE.md says how to run, test and contribute', () => {
  for (const cmd of ['npm install', 'npm run build', 'npm run preview', 'npm test']) assert.ok(note.includes(cmd), cmd);
  assert.match(note, /publish: true/);
  assert.match(note, /CONTRIBUTING\.md/);
});

test('CLAUDE.md stays short', () => {
  assert.ok(note.split('\n').length <= 45, `${note.split('\n').length} lines`);
});
