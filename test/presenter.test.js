import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { toPlanPreview, toApplyProblems, toUndoProblems } from '../src/presenter.js';

const root = path.join(path.sep, 'tmp', 'x');
const move = (name, category, renamed = false) => ({
  from: path.join(root, name),
  to: path.join(root, category, renamed ? `${name} (1)` : name),
  category,
  renamed,
});

test('plan preview gives counts and capped samples, never full paths', () => {
  const moves = Array.from({ length: 5 }, (_, i) => move(`f${i}.pdf`, 'Documents'));
  const plan = { root, moves, perCategory: { Documents: 5 }, renamedCount: 0 };
  const p = toPlanPreview(plan, 'plan-1', 3);
  assert.equal(p.planId, 'plan-1');
  assert.equal(p.total, 5);
  assert.equal(p.samples.Documents.length, 3);
  assert.deepEqual(p.samples.Documents[0], { name: 'f0.pdf', toName: 'f0.pdf', renamed: false });
  assert.ok(!JSON.stringify(p).includes(root));
});

test('apply problems list only unmoved files', () => {
  const results = [
    { from: path.join(root, 'a.pdf'), status: 'moved' },
    { from: path.join(root, 'b.pdf'), status: 'skipped', reason: 'file changed since the preview' },
  ];
  assert.deepEqual(toApplyProblems(results), [{ name: 'b.pdf', status: 'skipped', reason: 'file changed since the preview' }]);
});

test('undo problems list only failures', () => {
  const results = [
    { to: path.join(root, 'Documents', 'a.pdf'), status: 'restored' },
    { to: path.join(root, 'Documents', 'b.pdf'), status: 'failed', reason: 'file was modified after it was moved' },
  ];
  assert.deepEqual(toUndoProblems(results), [{ name: 'b.pdf', reason: 'file was modified after it was moved' }]);
});