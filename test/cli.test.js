import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { makeTree, cleanup, listAll } from '../test-utils/tree.js';

const run = promisify(execFile);
const cli = (args) => run('node', ['src/cli.js', ...args]);

test('plan previews, organise needs --yes, undo reverses', async () => {
  const root = await makeTree({ 'a.pdf': 'A', 'b.jpg': 'B' });
  const logDir = await makeTree();
  const journal = path.join(logDir, 'j.jsonl');
  try {
    const plan = await cli(['plan', root, '--journal', journal]);
    assert.match(plan.stdout, /Nothing was changed/);
    assert.deepEqual(await listAll(root), ['a.pdf', 'b.jpg']);

    const preview = await cli(['organise', root, '--journal', journal]);
    assert.match(preview.stdout, /Re-run with --yes/);
    assert.deepEqual(await listAll(root), ['a.pdf', 'b.jpg']);

    const applied = await cli(['organise', root, '--yes', '--journal', journal]);
    assert.match(applied.stdout, /Moved 2/);
    assert.deepEqual(await listAll(root), ['Documents/a.pdf', 'Images/b.jpg']);

    const opId = /deskflow undo (\S+)/.exec(applied.stdout)[1];
    const hist = await cli(['history', '--journal', journal]);
    assert.match(hist.stdout, new RegExp(opId));

    const undone = await cli(['undo', opId, '--journal', journal]);
    assert.match(undone.stdout, /Restored 2/);
    assert.deepEqual(await listAll(root), ['a.pdf', 'b.jpg']);
  } finally {
    await Promise.all([cleanup(root), cleanup(logDir)]);
  }
});

test('scan reports sizes; unsafe folder fails cleanly', async () => {
  const root = await makeTree({ 'a.pdf': 'A' });
  try {
    assert.match((await cli(['scan', root])).stdout, /1 file\(s\)/);
    await assert.rejects(cli(['scan', path.parse(root).root]), (e) => e.code === 1 && /whole drive/.test(e.stderr));
  } finally {
    await cleanup(root);
  }
});