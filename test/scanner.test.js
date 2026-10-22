import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { scanFolder } from '../src/scanner.js';
import { summarize, formatBytes } from '../src/summary.js';
import { makeTree, cleanup } from '../test-utils/tree.js';

test('lists files with metadata and categories', async () => {
  const root = await makeTree({ 'report.pdf': 'twelve bytes', 'photo.JPG': 'img', Makefile: 'all:' });
  try {
    const r = await scanFolder(root);
    assert.deepEqual(r.files.map((f) => [f.name, f.category]), [
      ['Makefile', 'Other'],
      ['photo.JPG', 'Images'],
      ['report.pdf', 'Documents'],
    ]);
    const pdf = r.files.find((f) => f.name === 'report.pdf');
    assert.equal(pdf.size, 12);
    assert.equal(pdf.ext, '.pdf');
    assert.ok(pdf.modifiedMs > 0);
  } finally {
    await cleanup(root);
  }
});

test('empty folder is fine', async () => {
  const root = await makeTree();
  try {
    const r = await scanFolder(root);
    assert.deepEqual(r.files, []);
    assert.equal(r.cancelled, false);
  } finally {
    await cleanup(root);
  }
});

test('skips hidden, system, and unfinished files, and says why', async () => {
  const root = await makeTree({ '.secret': 'x', 'desktop.ini': 'x', 'movie.mp4.crdownload': 'x', 'ok.txt': 'x' });
  try {
    const r = await scanFolder(root);
    assert.deepEqual(r.files.map((f) => f.name), ['ok.txt']);
    assert.equal(r.skipped.length, 3);
    assert.ok(r.skipped.every((s) => s.reason));
  } finally {
    await cleanup(root);
  }
});

test('recursive scan finds nested files; default scan does not', async () => {
  const root = await makeTree({ 'a.txt': 'x', 'sub/b.txt': 'x', 'sub/deep/c.txt': 'x' });
  try {
    const flat = await scanFolder(root);
    assert.deepEqual(flat.files.map((f) => f.relPath), ['a.txt']);
    assert.equal(flat.directories, 1);
    const deep = await scanFolder(root, { recursive: true });
    assert.equal(deep.files.length, 3);
  } finally {
    await cleanup(root);
  }
});

test('refuses unsafe or invalid roots', async () => {
  await assert.rejects(scanFolder(os.homedir()), { code: 'UNSAFE_ROOT' });
  await assert.rejects(scanFolder(path.parse(os.tmpdir()).root), { code: 'UNSAFE_ROOT' });
  await assert.rejects(scanFolder(path.join(os.tmpdir(), 'deskflow-does-not-exist-xyz')), { code: 'NOT_FOUND' });
  await assert.rejects(scanFolder(''), { code: 'BAD_ROOT' });
  const root = await makeTree({ 'file.txt': 'x' });
  try {
    await assert.rejects(scanFolder(path.join(root, 'file.txt')), { code: 'NOT_A_FOLDER' });
  } finally {
    await cleanup(root);
  }
});

test('symbolic links are skipped, not followed', async (t) => {
  const root = await makeTree({ 'real.txt': 'x' });
  try {
    try {
      await fs.symlink(path.join(root, 'real.txt'), path.join(root, 'link.txt'));
    } catch {
      return t.skip('cannot create symlinks here');
    }
    const r = await scanFolder(root);
    assert.deepEqual(r.files.map((f) => f.name), ['real.txt']);
    assert.equal(r.skipped[0].reason, 'symbolic link');
  } finally {
    await cleanup(root);
  }
});

test('an already-aborted scan reports cancelled', async () => {
  const root = await makeTree({ 'a.txt': 'x', 'b.txt': 'x' });
  try {
    const ctl = new AbortController();
    ctl.abort();
    const r = await scanFolder(root, { signal: ctl.signal });
    assert.equal(r.cancelled, true);
    assert.equal(r.files.length, 0);
  } finally {
    await cleanup(root);
  }
});

test('summary groups by category and extension, biggest first', () => {
  const files = [
    { category: 'Images', ext: '.jpg', size: 500 },
    { category: 'Images', ext: '.png', size: 100 },
    { category: 'Documents', ext: '.pdf', size: 2000 },
    { category: 'Other', ext: '', size: 1 },
  ];
  const s = summarize(files);
  assert.equal(s.totalFiles, 4);
  assert.equal(s.totalBytes, 2601);
  assert.equal(s.byCategory[0].category, 'Documents');
  assert.deepEqual(s.byCategory.find((c) => c.category === 'Images'), { category: 'Images', count: 2, bytes: 600 });
  assert.ok(s.byExtension.some((e) => e.extension === '(none)'));
});

test('formatBytes', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(1536), '1.5 KB');
  assert.equal(formatBytes(5 * 1024 * 1024), '5.0 MB');
});