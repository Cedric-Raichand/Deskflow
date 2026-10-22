import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export class DeskFlowError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'DeskFlowError';
    this.code = code;
  }
}

const norm = (p) => (process.platform === 'win32' ? p.toLowerCase() : p);

/** True when `target` is strictly inside `root` (not equal to it, not outside it). */
export function isInside(root, target) {
  const rel = path.relative(norm(path.resolve(root)), norm(path.resolve(target)));
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function systemFolders() {
  if (process.platform === 'win32') {
    return ['SystemRoot', 'ProgramFiles', 'ProgramFiles(x86)', 'ProgramData']
      .map((k) => process.env[k])
      .filter(Boolean);
  }
  return ['/etc', '/usr', '/bin', '/sbin', '/boot', '/System', '/Library'];
}

/**
 * Validates a folder chosen for scanning/organising and returns its resolved path.
 * Refuses: empty input, missing paths, files, drive roots, the home folder itself,
 * and system folders (and anything inside them).
 */
export async function assertSafeRoot(input) {
  if (typeof input !== 'string' || !input.trim()) {
    throw new DeskFlowError('BAD_ROOT', 'Choose a folder first.');
  }
  const root = path.resolve(input);

  if (path.parse(root).root === root) {
    throw new DeskFlowError('UNSAFE_ROOT', 'DeskFlow will not organise a whole drive. Choose a specific folder.');
  }
  if (norm(root) === norm(path.resolve(os.homedir()))) {
    throw new DeskFlowError('UNSAFE_ROOT', 'DeskFlow will not organise your entire home folder. Choose a folder inside it, such as Downloads.');
  }
  for (const sys of systemFolders()) {
    const resolved = path.resolve(sys);
    if (norm(root) === norm(resolved) || isInside(resolved, root)) {
      throw new DeskFlowError('UNSAFE_ROOT', 'That is a system folder. DeskFlow will not touch it.');
    }
  }

  let stat;
  try {
    stat = await fs.stat(root);
  } catch (err) {
    const code = err.code === 'ENOENT' ? 'NOT_FOUND' : 'CANNOT_ACCESS';
    throw new DeskFlowError(code, code === 'NOT_FOUND' ? 'That folder does not exist.' : `Cannot access that folder (${err.code}).`);
  }
  if (!stat.isDirectory()) throw new DeskFlowError('NOT_A_FOLDER', 'That path is a file, not a folder.');
  return root;
}