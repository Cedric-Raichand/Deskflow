import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { scanFolder } from '../src/scanner.js';
import { createPlan } from '../src/planner.js';
import { makeTree, cleanup, listAll } from '../test-utils/tree.js';

const rel = (root, p) => path.relative(root, p).split(path.sep).join('/');

test('plans moves into category folders without touching disk', async () => {
  const root = await makeTree({ 'report.pdf': 'a', 'photo.jpg': 'b', 'setup.exe': 'c', Makefile: 'd' });
  try {
    const before = await listAll(root);
    const { files, root: r } = await scanFolder(root);
    const plan = await createPlan(files, r);
    assert.deepEqual(plan.moves.map((m) => [path.basename(m.from), rel(r, m.to)]).sort(), [
      ['Makefile', 'Other/Makefile'],
      ['photo.jpg', 'Images/photo.jpg'],
      ['report.pdf', 'Documents/report.pdf'],
      ['setup.exe', 'Installers/setup.exe'],
    ]);
    assert.equal(plan.perCategory.Images, 1);
    assert.deepEqual(await listAll(root), before); // dry run changed nothing
  } finally {
    await cleanup(root);
  }
});

test('never plans to overwrite an existing file', async () => {
  const root = await makeTree({ 'report.pdf': 'new', 'Documents/report.pdf': 'old' });
  try {
    const { files, root: r } = await scanFolder(root);
    const plan = await createPlan(files, r);
    assert.equal(plan.moves.length, 1);
    assert.equal(rel(r, plan.moves[0].to), 'Documents/report (1).pdf');
    assert.equal(plan.moves[0].renamed, true);
    assert.equal(plan.renamedCount, 1);
  } finally {
    await cleanup(root);
  }
});

test('names that differ only by case do not collide in the plan', async () => {
  const root = await makeTree({ 'Report.pdf': '1', 'report.pdf': '2' });
  try {
    const { files, root: r } = await scanFolder(root);
    if (files.length < 2) return; // case-insensitive file system: only one file can exist
    const plan = await createPlan(files, r);
    const dests = plan.moves.map((m) => m.to.toLowerCase());
    assert.equal(new Set(dests).size, 2);
  } finally {
    await cleanup(root);
  }
});

test('files inside subfolders are left alone', async () => {
  const root = await makeTree({ 'top.txt': 'x', 'sub/nested.txt': 'x' });
  try {
    const { files, root: r } = await scanFolder(root, { recursive: true });
    const plan = await createPlan(files, r);
    assert.deepEqual(plan.moves.map((m) => path.basename(m.from)), ['top.txt']);
  } finally {
    await cleanup(root);
  }
});

test('re-running on an organised folder plans nothing', async () => {
  const root = await makeTree({ 'Documents/a.pdf': 'x', 'Images/b.jpg': 'x' });
  try {
    const { files, root: r } = await scanFolder(root);
    const plan = await createPlan(files, r);
    assert.equal(plan.moves.length, 0);
  } finally {
    await cleanup(root);
  }
});