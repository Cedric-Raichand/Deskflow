import fs from 'node:fs/promises';
import path from 'node:path';
import { isInside } from './safety.js';

const pathExists = (p) => fs.lstat(p).then(() => true, () => false);

/**
 * Builds a preview of the moves needed to sort the files that sit directly in `root`
 * into category folders. Pure planning: nothing on disk is changed.
 * Files inside subfolders are left alone. Name clashes get a " (1)", " (2)"... suffix
 * so nothing is ever overwritten.
 */
export async function createPlan(files, root, { exists = pathExists } = {}) {
  const taken = new Set(); // destinations reserved by this plan, lower-cased (Windows is case-insensitive)
  const moves = [];

  for (const file of files) {
    if (path.dirname(file.path) !== root) continue;

    const dir = path.join(root, file.category);
    const { name: stem, ext } = path.parse(file.name);
    let to = path.join(dir, file.name);
    let renamed = false;
    for (let n = 1; taken.has(to.toLowerCase()) || (await exists(to)); n++) {
      to = path.join(dir, `${stem} (${n})${ext}`);
      renamed = true;
    }
    if (!isInside(root, to)) throw new Error(`Refusing to plan a move outside the chosen folder: ${to}`);

    taken.add(to.toLowerCase());
    moves.push({
      from: file.path,
      to,
      category: file.category,
      size: file.size,
      modifiedMs: file.modifiedMs,
      renamed,
    });
  }

  const perCategory = {};
  for (const m of moves) perCategory[m.category] = (perCategory[m.category] ?? 0) + 1;
  return { root, moves, perCategory, renamedCount: moves.filter((m) => m.renamed).length };
}