import fs from 'node:fs/promises';
import path from 'node:path';

// The journal is an append-only JSON-lines file: one record per line, written as things happen,
// so a crash mid-operation still leaves an accurate record of what was already moved.

export async function appendJournal(journalPath, record) {
  await fs.mkdir(path.dirname(journalPath), { recursive: true });
  await fs.appendFile(journalPath, JSON.stringify({ at: new Date().toISOString(), ...record }) + '\n');
}

export async function readJournal(journalPath) {
  let text;
  try {
    text = await fs.readFile(journalPath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
  return text
    .split('\n')
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return []; // a torn final line (e.g. power loss) must not make the whole history unreadable
      }
    });
}

export function buildOperations(records) {
  const ops = new Map();
  for (const r of records) {
    if (r.op === 'begin') {
      ops.set(r.opId, { opId: r.opId, root: r.root, at: r.at, mkdirs: [], moves: [], restored: new Set(), cancelled: false });
      continue;
    }
    const op = ops.get(r.opId);
    if (!op) continue;
    if (r.op === 'mkdir') op.mkdirs.push(r.dir);
    else if (r.op === 'move') op.moves.push({ from: r.from, to: r.to, size: r.size, mtimeMs: r.mtimeMs });
    else if (r.op === 'undo-move') op.restored.add(r.to);
    else if (r.op === 'end') op.cancelled = Boolean(r.cancelled);
  }
  return [...ops.values()].map((op) => {
    const pending = op.moves.filter((m) => !op.restored.has(m.to));
    let status = 'done';
    if (op.moves.length === 0) status = 'empty';
    else if (pending.length === 0) status = 'undone';
    else if (pending.length < op.moves.length) status = 'partially-undone';
    return { opId: op.opId, root: op.root, at: op.at, status, moved: op.moves.length, cancelled: op.cancelled, mkdirs: op.mkdirs, moves: op.moves, pending };
  });
}

/** Operation history, oldest first, without the per-file detail. */
export async function listOperations(journalPath) {
  const ops = buildOperations(await readJournal(journalPath));
  return ops.map(({ mkdirs, moves, pending, ...summary }) => summary);
}

export async function getOperation(journalPath, opId) {
  return buildOperations(await readJournal(journalPath)).find((o) => o.opId === opId) ?? null;
}