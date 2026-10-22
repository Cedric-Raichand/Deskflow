#!/usr/bin/env node
import os from 'node:os';
import path from 'node:path';
import { scanFolder, createPlan, executePlan, undoOperation, listOperations, summarize, formatBytes, DeskFlowError } from './index.js';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const valueOf = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};
const journalPath = valueOf('--journal') ?? path.join(os.homedir(), '.deskflow', 'journal.jsonl');
const positional = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--journal');
const [command, target] = positional;

function usage() {
  console.error(`Usage:
  deskflow scan <folder> [--recursive]
  deskflow plan <folder>                 preview only, changes nothing
  deskflow organise <folder> [--yes]     without --yes this is just a preview
  deskflow history
  deskflow undo <operation-id>
Options: --journal <file>   where the undo history is kept (default ~/.deskflow/journal.jsonl)`);
  process.exit(2);
}

function printPlan(plan) {
  const byCategory = new Map();
  for (const m of plan.moves) {
    if (!byCategory.has(m.category)) byCategory.set(m.category, []);
    byCategory.get(m.category).push(m);
  }
  for (const [category, moves] of byCategory) {
    console.log(`\n${category}/  (${moves.length})`);
    for (const m of moves.slice(0, 15)) {
      console.log(`  ${path.basename(m.from)}${m.renamed ? `  ->  ${path.basename(m.to)}  (renamed to avoid a clash)` : ''}`);
    }
    if (moves.length > 15) console.log(`  ... and ${moves.length - 15} more`);
  }
}

async function main() {
  if (!command) usage();

  if (command === 'history') {
    const ops = await listOperations(journalPath);
    if (!ops.length) return console.log('No operations recorded yet.');
    for (const op of ops) console.log(`${op.opId}  ${op.at}  ${op.status.padEnd(16)} ${op.moved} file(s)  ${op.root}`);
    return;
  }

  if (!target) usage();

  if (command === 'undo') {
    const r = await undoOperation(journalPath, target);
    console.log(`Restored ${r.restored} file(s).`);
    for (const f of r.results.filter((x) => x.status === 'failed')) console.log(`  could not restore ${path.basename(f.to)}: ${f.reason}`);
    if (r.failed) console.log('Files listed above were left where they are. You can run undo again later.');
    return;
  }

  if (!['scan', 'plan', 'organise'].includes(command)) usage();
  const scan = await scanFolder(target, { recursive: flag('--recursive') });

  if (command === 'scan') {
    const s = summarize(scan.files);
    console.log(`${s.totalFiles} file(s), ${formatBytes(s.totalBytes)} in ${scan.root}`);
    for (const c of s.byCategory) console.log(`  ${c.category.padEnd(11)} ${String(c.count).padStart(5)} file(s)  ${formatBytes(c.bytes)}`);
    if (scan.skipped.length) console.log(`Skipped ${scan.skipped.length} item(s) (hidden, system, unfinished, or links).`);
    if (scan.errors.length) console.log(`Could not read ${scan.errors.length} item(s), e.g. ${scan.errors[0].path} (${scan.errors[0].code}).`);
    return;
  }

  const plan = await createPlan(scan.files, scan.root);
  if (!plan.moves.length) return console.log('Nothing to organise.');
  printPlan(plan);

  if (command === 'plan' || !flag('--yes')) {
    console.log(`\n${plan.moves.length} file(s) would move. Nothing was changed.`);
    if (command === 'organise') console.log('Re-run with --yes to apply.');
    return;
  }

  const result = await executePlan(plan, { journalPath });
  console.log(`\nMoved ${result.moved}, skipped ${result.skipped}, failed ${result.failed}.`);
  for (const r of result.results.filter((x) => x.status !== 'moved')) console.log(`  ${r.status}: ${path.basename(r.from)} (${r.reason})`);
  console.log(`To undo: deskflow undo ${result.opId}`);
}

main().catch((err) => {
  console.error(`deskflow: ${err instanceof DeskFlowError ? err.message : err.stack ?? err}`);
  process.exit(1);
});