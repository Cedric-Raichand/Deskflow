import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { assertSafeRoot, isInside } from './safety.js';
import { appendJournal } from './journal.js';
import { pathExists } from './fsutil.js';

const TOLERANCE_MS = 1;

async function runMove(move, root, journalPath, opId) {
  try {
    if (!isInside(root, move.to) || !isInside(root, move.from)) {
      return { ...move, status: 'failed', reason: 'path is outside the chosen folder' };
    }

    // Re-check reality right before acting: the folder may have changed since the preview.
    let stat;
    try {
      stat = await fs.lstat(move.from);
    } catch {
      return { ...move, status: 'skipped', reason: 'source file no longer exists' };
    }
    if (!stat.isFile()) return { ...move, status: 'skipped', reason: 'source is no longer a regular file' };
    if (stat.size !== move.size || Math.abs(stat.mtimeMs - move.modifiedMs) > TOLERANCE_MS) {
      return { ...move, status: 'skipped', reason: 'file changed since the preview' };
    }
    if (await pathExists(move.to)) {
      return { ...move, status: 'skipped', reason: 'destination already exists' };
    }

    const dir = path.dirname(move.to);
    if (!(await pathExists(dir))) {
      await fs.mkdir(dir, { recursive: true });
      await appendJournal(journalPath, { op: 'mkdir', opId, dir });
    }
    await fs.rename(move.from, move.to);
    await appendJournal(journalPath, { op: 'move', opId, from: move.from, to: move.to, size: stat.size, mtimeMs: stat.mtimeMs });
    return { ...move, status: 'moved' };
  } catch (err) {
    return { ...move, status: 'failed', reason: err.code ? `${err.code}: ${err.message}` : err.message };
  }
}

/**
 * Carries out an approved plan. Every move is journalled so it can be undone.
 * A problem with one file never stops the rest; each result says what happened.
 *
 * @param {object} plan from createPlan()
 * @param {{ journalPath: string, signal?: AbortSignal, onProgress?: Function, opId?: string }} options
 */
export async function executePlan(plan, { journalPath, signal, onProgress, opId = randomUUID() } = {}) {
  if (!journalPath) throw new Error('journalPath is required so the operation can be undone.');
  const root = await assertSafeRoot(plan.root);

  await appendJournal(journalPath, { op: 'begin', opId, root });
  const results = [];
  let cancelled = false;

  for (const [i, move] of plan.moves.entries()) {
    if (signal?.aborted) {
      cancelled = true;
      break;
    }
    const result = await runMove(move, root, journalPath, opId);
    results.push(result);
    onProgress?.({ done: i + 1, total: plan.moves.length, result });
  }

  await appendJournal(journalPath, { op: 'end', opId, cancelled });
  const count = (status) => results.filter((r) => r.status === status).length;
  return { opId, results, moved: count('moved'), skipped: count('skipped'), failed: count('failed'), cancelled };
}