import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

/** Creates a temp folder containing the given { 'relative/path': 'content' } files. */
export async function makeTree(files = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'deskflow-test-'));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(root, rel);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, content);
  }
  return root;
}

export const cleanup = (root) => fs.rm(root, { recursive: true, force: true });

export async function exists(p) {
  return fs.lstat(p).then(() => true, () => false);
}

export async function listAll(root, dir = root) {
  const out = [];
  for (const d of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, d.name);
    if (d.isDirectory()) out.push(...(await listAll(root, full)));
    else out.push(path.relative(root, full).split(path.sep).join('/'));
  }
  return out.sort();
}