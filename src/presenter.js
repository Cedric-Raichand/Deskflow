import path from 'node:path';

// Shapes engine results into small, safe objects for the window.
// The window never receives the real plan: it gets a preview and an id, and the app keeps the plan.

/** Small preview of a plan: counts per category and a few example files each. */
export function toPlanPreview(plan, planId, samplesPerCategory = 50) {
  const samples = {};
  for (const m of plan.moves) {
    const list = (samples[m.category] ??= []);
    if (list.length < samplesPerCategory) {
      list.push({ name: path.basename(m.from), toName: path.basename(m.to), renamed: m.renamed });
    }
  }
  return {
    planId,
    total: plan.moves.length,
    perCategory: plan.perCategory,
    renamedCount: plan.renamedCount,
    samples,
  };
}

/** Files that were not moved (skipped or failed), with the reason. */
export function toApplyProblems(results, limit = 50) {
  return results
    .filter((r) => r.status !== 'moved')
    .slice(0, limit)
    .map((r) => ({ name: path.basename(r.from), status: r.status, reason: r.reason }));
}

/** Files that could not be restored by an undo, with the reason. */
export function toUndoProblems(results, limit = 50) {
  return results
    .filter((r) => r.status === 'failed')
    .slice(0, limit)
    .map((r) => ({ name: path.basename(r.to), reason: r.reason }));
}