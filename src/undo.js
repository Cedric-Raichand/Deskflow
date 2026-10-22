import fs from 'node:fs/promises';
import { appendJournal, getOperation } from './journal.js';
import { isInside, DeskFlowError } from './safety.js';
import { pathExists } from './fsutil.js';

const TOLERANCE_MS = 1;

async function undoMove(move, root, journalPath, opId) {
  if (!isInside(root, move.to) || !isInside(root, move.from)) {
    return { ...move, status: 'failed', reason: 'journal path is outside the organised folder' };
  }
  let stat;
  try {
    stat = await fs.lstat(move.to);
  } catch {
    return { ...move, status: 'failed', reason: 'file is no longer where DeskFlow put it' };
  }
  if (!stat.isFile() || stat.size !== move.size || Math.abs(stat.mtimeMs - move.mtimeMs) > TOLERANCE_MS) {
    return { ...move, status: 'failed', reason: 'file was modified after it was moved' };
  }
  if (await pathExists(move.from)) {
    return { ...move, status: 'failed', reason: 'something else now exists at the original location' };
  }
  try {
    await fs.rename(move.to, move.from);
  } catch (err) {
    return { ...move, status: 'failed', reason: err.code ? `${err.code}: ${err.message}` : err.message };
  }
  await appendJournal(journalPath, { op: 'undo-move', opId, from: move.from, to: move.to });
  return { ...move, status: 'restored' };
}

/**
 * Reverses an operation as far as it safely can. Files that were changed, removed, or whose
 * original location is now occupied are left exactly where they are and reported.
 * Safe to run again later: only moves not yet restored are attempted.
 */
export async function undoOperation(journalPath, opId, { signal } = {}) {
  const op = await getOperation(journalPath, opId);
  if (!op) throw new DeskFlowError('NO_SUCH_OPERATION', 'No operation with that id in the history.');
  if (op.status === 'empty') throw new DeskFlowError('NOTHING_TO_UNDO', 'That operation did not move any files.');
  if (op.status === 'undone') throw new DeskFlowError('ALREADY_UNDONE', 'That operation was already undone.');

  const results = [];
  for (const move of [...op.pending].reverse()) {
    if (signal?.aborted) break;
    results.push(await undoMove(move, op.root, journalPath, opId));
  }

  // Remove category folders this operation created, but only if they are now empty (rmdir refuses otherwise).
  for (const dir of [...op.mkdirs].reverse()) {
    if (!isInside(op.root, dir)) continue;
    await fs.rmdir(dir).catch(() => {});
  }

  const count = (status) => results.filter((r) => r.status === status).length;
  return { opId, results, restored: count('restored'), failed: count('failed') };
}