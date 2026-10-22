import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { scanFolder } from '../src/scanner.js';
import { createPlan } from '../src/planner.js';
import { executePlan } from '../src/executor.js';
import { undoOperation } from '../src/undo.js';
import { listOperations } from '../src/journal.js';
import { makeTree, cleanup, listAll, exists } from '../test-utils/tree.js';

async function organised(files) {
  const root = await makeTree(files);
  const logDir = await makeTree();
  const journalPath = path.join(logDir, 'journal.jsonl');
  const scan = await scanFolder(root);
  const plan = await createPlan(scan.files, scan.root);
  const run = await executePlan(plan, { journalPath });
  return { root: scan.root, journalPath, opId: run.opId, done: () => Promise.all([cleanup(root), cleanup(logDir)]) };
}

test('undo restores every file and removes the folders it created', async () => {
  const before = { 'a.pdf': 'AAA', 'b.jpg': 'BBB' };
  const s = await organised(before);
  try {
    const r = await undoOperation(s.journalPath, s.opId);
    assert.equal(r.restored, 2);
    assert.equal(r.failed, 0);
    assert.deepEqual(await listAll(s.root), ['a.pdf', 'b.jpg']);
    assert.equal(await fs.readFile(path.join(s.root, 'a.pdf'), 'utf8'), 'AAA');
    assert.equal(await exists(path.join(s.root, 'Documents')), false);
    assert.equal((await listOperations(s.journalPath))[0].status, 'undone');
  } finally {
    await s.done();
  }
});

test('an operation cannot be undone twice', async () => {
  const s = await organised({ 'a.pdf': 'A' });
  try {
    await undoOperation(s.journalPath, s.opId);
    await assert.rejects(undoOperation(s.journalPath, s.opId), { code: 'ALREADY_UNDONE' });
  } finally {
    await s.done();
  }
});

test('unknown operation id is rejected', async () => {
  const s = await organised({ 'a.pdf': 'A' });
  try {
    await assert.rejects(undoOperation(s.journalPath, 'nope'), { code: 'NO_SUCH_OPERATION' });
  } finally {
    await s.done();
  }
});

test('folders that existed before are kept after undo', async () => {
  const s = await organised({ 'a.pdf': 'A', 'Documents/old.pdf': 'old' });
  try {
    await undoOperation(s.journalPath, s.opId);
    assert.deepEqual(await listAll(s.root), ['Documents/old.pdf', 'a.pdf']);
  } finally {
    await s.done();
  }
});

test('a file modified after the move is left alone and reported', async () => {
  const s = await organised({ 'a.pdf': 'AAA', 'b.jpg': 'BBB' });
  try {
    await fs.writeFile(path.join(s.root, 'Documents', 'a.pdf'), 'edited by the user, longer');
    const r = await undoOperation(s.journalPath, s.opId);
    assert.equal(r.restored, 1);
    assert.equal(r.failed, 1);
    assert.match(r.results.find((x) => x.status === 'failed').reason, /modified/);
    assert.equal(await fs.readFile(path.join(s.root, 'Documents', 'a.pdf'), 'utf8'), 'edited by the user, longer');
    assert.ok(await exists(path.join(s.root, 'b.jpg')));
    assert.equal((await listOperations(s.journalPath))[0].status, 'partially-undone');
  } finally {
    await s.done();
  }
});

test('never overwrites something now at the original location; retry works once it is cleared', async () => {
  const s = await organised({ 'a.pdf': 'AAA' });
  try {
    await fs.writeFile(path.join(s.root, 'a.pdf'), 'a different file');
    const first = await undoOperation(s.journalPath, s.opId);
    assert.equal(first.failed, 1);
    assert.match(first.results[0].reason, /original location/);
    assert.equal(await fs.readFile(path.join(s.root, 'a.pdf'), 'utf8'), 'a different file');

    await fs.unlink(path.join(s.root, 'a.pdf'));
    const second = await undoOperation(s.journalPath, s.opId);
    assert.equal(second.restored, 1);
    assert.equal(await fs.readFile(path.join(s.root, 'a.pdf'), 'utf8'), 'AAA');
  } finally {
    await s.done();
  }
});

test('a file the user moved away is reported, not invented', async () => {
  const s = await organised({ 'a.pdf': 'AAA' });
  try {
    await fs.unlink(path.join(s.root, 'Documents', 'a.pdf'));
    const r = await undoOperation(s.journalPath, s.opId);
    assert.equal(r.failed, 1);
    assert.match(r.results[0].reason, /no longer where/);
  } finally {
    await s.done();
  }
});

test('a corrupted journal line does not hide the history', async () => {
  const s = await organised({ 'a.pdf': 'A' });
  try {
    await fs.appendFile(s.journalPath, '{"op":"mov');
    const ops = await listOperations(s.journalPath);
    assert.equal(ops.length, 1);
    assert.equal(ops[0].moved, 1);
  } finally {
    await s.done();
  }
});

test('a tampered journal cannot make undo touch files outside the folder', async () => {
  const s = await organised({ 'a.pdf': 'A' });
  try {
    const victim = await makeTree({ 'victim.txt': 'safe' });
    const text = await fs.readFile(s.journalPath, 'utf8');
    const evil = text.replaceAll(JSON.stringify(path.join(s.root, 'a.pdf')), JSON.stringify(path.join(victim, 'x.txt')));
    await fs.writeFile(s.journalPath, evil);
    const r = await undoOperation(s.journalPath, s.opId);
    assert.equal(r.failed, 1);
    assert.deepEqual(await listAll(victim), ['victim.txt']);
    await cleanup(victim);
  } finally {
    await s.done();
  }
});