import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { scanFolder } from '../src/scanner.js';
import { createPlan } from '../src/planner.js';
import { executePlan } from '../src/executor.js';
import { readJournal } from '../src/journal.js';
import { makeTree, cleanup, listAll, exists } from '../test-utils/tree.js';

async function setup(files) {
  const root = await makeTree(files);
  const logDir = await makeTree(); // the journal lives outside the organised folder
  const journalPath = path.join(logDir, 'journal.jsonl');
  const scan = await scanFolder(root);
  const plan = await createPlan(scan.files, scan.root);
  return { root: scan.root, plan, journalPath, done: () => Promise.all([cleanup(root), cleanup(logDir)]) };
}

test('moves files into category folders and journals every step', async () => {
  const s = await setup({ 'a.pdf': 'AAA', 'b.jpg': 'BBB', 'c.pdf': 'CCC' });
  try {
    const r = await executePlan(s.plan, { journalPath: s.journalPath });
    assert.equal(r.moved, 3);
    assert.equal(r.failed, 0);
    assert.deepEqual(await listAll(s.root), ['Documents/a.pdf', 'Documents/c.pdf', 'Images/b.jpg']);
    assert.equal(await fs.readFile(path.join(s.root, 'Documents', 'a.pdf'), 'utf8'), 'AAA'); // contents intact
    const ops = (await readJournal(s.journalPath)).map((x) => x.op);
    assert.equal(ops[0], 'begin');
    assert.equal(ops.at(-1), 'end');
    assert.equal(ops.filter((o) => o === 'move').length, 3);
    assert.equal(ops.filter((o) => o === 'mkdir').length, 2);
  } finally {
    await s.done();
  }
});

test('requires a journal path', async () => {
  const s = await setup({ 'a.pdf': 'A' });
  try {
    await assert.rejects(executePlan(s.plan, {}), /journalPath/);
    assert.deepEqual(await listAll(s.root), ['a.pdf']);
  } finally {
    await s.done();
  }
});

test('a file that disappears after the preview is skipped; the rest still move', async () => {
  const s = await setup({ 'a.pdf': 'A', 'b.jpg': 'B' });
  try {
    await fs.unlink(path.join(s.root, 'b.jpg'));
    const r = await executePlan(s.plan, { journalPath: s.journalPath });
    assert.equal(r.moved, 1);
    assert.equal(r.skipped, 1);
    assert.match(r.results.find((x) => x.status === 'skipped').reason, /no longer exists/);
    assert.ok(await exists(path.join(s.root, 'Documents', 'a.pdf')));
  } finally {
    await s.done();
  }
});

test('a file changed after the preview is not moved', async () => {
  const s = await setup({ 'a.pdf': 'short' });
  try {
    await fs.writeFile(path.join(s.root, 'a.pdf'), 'much longer content now');
    const r = await executePlan(s.plan, { journalPath: s.journalPath });
    assert.equal(r.moved, 0);
    assert.match(r.results[0].reason, /changed since the preview/);
    assert.ok(await exists(path.join(s.root, 'a.pdf')));
  } finally {
    await s.done();
  }
});

test('never overwrites a file that appeared at the destination after the preview', async () => {
  const s = await setup({ 'a.pdf': 'mine' });
  try {
    await fs.mkdir(path.join(s.root, 'Documents'));
    await fs.writeFile(path.join(s.root, 'Documents', 'a.pdf'), 'precious');
    const r = await executePlan(s.plan, { journalPath: s.journalPath });
    assert.equal(r.skipped, 1);
    assert.match(r.results[0].reason, /already exists/);
    assert.equal(await fs.readFile(path.join(s.root, 'Documents', 'a.pdf'), 'utf8'), 'precious');
    assert.equal(await fs.readFile(path.join(s.root, 'a.pdf'), 'utf8'), 'mine');
  } finally {
    await s.done();
  }
});

test('cancelling stops between files and keeps a valid record', async () => {
  const s = await setup({ 'a.pdf': 'A', 'b.pdf': 'B', 'c.pdf': 'C' });
  try {
    const ctl = new AbortController();
    const r = await executePlan(s.plan, { journalPath: s.journalPath, signal: ctl.signal, onProgress: () => ctl.abort() });
    assert.equal(r.cancelled, true);
    assert.equal(r.moved, 1);
    assert.equal((await listAll(s.root)).filter((f) => f.startsWith('Documents/')).length, 1);
    const last = (await readJournal(s.journalPath)).at(-1);
    assert.deepEqual([last.op, last.cancelled], ['end', true]);
  } finally {
    await s.done();
  }
});

test('refuses to run against an unsafe root', async () => {
  const s = await setup({ 'a.pdf': 'A' });
  try {
    await assert.rejects(executePlan({ ...s.plan, root: path.parse(s.root).root }, { journalPath: s.journalPath }), { code: 'UNSAFE_ROOT' });
  } finally {
    await s.done();
  }
});