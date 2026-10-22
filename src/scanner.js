import fs from 'node:fs/promises';
import path from 'node:path';
import { assertSafeRoot } from './safety.js';
import { categoryFor, extensionOf } from './categories.js';

const SYSTEM_NAMES = new Set(['desktop.ini', 'thumbs.db']);
const UNFINISHED_EXTENSIONS = new Set(['.crdownload', '.part', '.partial', '.tmp', '.download']);

/** Why a file should be left alone, or null if it is fine to include. */
export function skipReason(name) {
  if (name.startsWith('.')) return 'hidden file';
  if (SYSTEM_NAMES.has(name.toLowerCase())) return 'system file';
  if (UNFINISHED_EXTENSIONS.has(extensionOf(name))) return 'unfinished download or temporary file';
  return null;
}

/**
 * Reads a folder and returns file metadata. Read-only: never changes anything.
 * Problems with individual entries are collected in `errors` instead of aborting the scan.
 *
 * @param {string} root
 * @param {{ recursive?: boolean, signal?: AbortSignal }} [options]
 */
export async function scanFolder(root, { recursive = false, signal } = {}) {
  const base = await assertSafeRoot(root);
  const files = [];
  const skipped = [];
  const errors = [];
  let directories = 0;
  let cancelled = false;

  async function walk(dir) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (err) {
      errors.push({ path: dir, code: err.code, message: err.message });
      return;
    }
    for (const entry of entries) {
      if (signal?.aborted) {
        cancelled = true;
        return;
      }
      const full = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) {
        skipped.push({ path: full, reason: 'symbolic link' });
        continue;
      }
      if (entry.isDirectory()) {
        directories++;
        if (recursive) {
          await walk(full);
          if (cancelled) return;
        }
        continue;
      }
      if (!entry.isFile()) {
        skipped.push({ path: full, reason: 'not a regular file' });
        continue;
      }
      const reason = skipReason(entry.name);
      if (reason) {
        skipped.push({ path: full, reason });
        continue;
      }
      try {
        const stat = await fs.stat(full);
        files.push({
          name: entry.name,
          path: full,
          relPath: path.relative(base, full),
          ext: extensionOf(entry.name),
          category: categoryFor(entry.name),
          size: stat.size,
          modifiedMs: stat.mtimeMs,
        });
      } catch (err) {
        errors.push({ path: full, code: err.code, message: err.message }); // e.g. file vanished or is locked
      }
    }
  }

  await walk(base);
  files.sort((a, b) => a.path.localeCompare(b.path));
  return { root: base, files, skipped, errors, directories, cancelled };
}