import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import {
  scanFolder, createPlan, executePlan, undoOperation, listOperations, summarize, assertSafeRoot, DeskFlowError,
} from '../src/index.js';
import { toPlanPreview, toApplyProblems, toUndoProblems } from '../src/presenter.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.argv.includes('--dev');
const DEV_URL = 'http://localhost:5173';

let win = null;
let selectedRoot = null; // only ever set from the native folder dialog, never from the window's own text
const plans = new Map(); // planId -> real plan; the window can only ask to apply an id
let running = null; // AbortController of the apply in progress

const journalPath = () => path.join(app.getPath('userData'), 'journal.jsonl');

/** Wraps a handler so errors reach the window as plain { ok:false, error } instead of crashing. */
function handle(channel, fn) {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      return { ok: true, data: await fn(event, ...args) };
    } catch (err) {
      if (!(err instanceof DeskFlowError)) console.error(`[${channel}]`, err);
      const message = err instanceof DeskFlowError ? err.message : err.code ? `${err.code}: ${err.message}` : err.message;
      return { ok: false, error: { code: err.code ?? 'ERROR', message } };
    }
  });
}

handle('folder:choose', async () => {
  const picked = await dialog.showOpenDialog(win, { title: 'Choose a folder to organise', properties: ['openDirectory'] });
  if (picked.canceled || picked.filePaths.length === 0) return null;
  selectedRoot = await assertSafeRoot(picked.filePaths[0]); // throws a friendly error for drives, home, system folders
  plans.clear();
  return { root: selectedRoot };
});

handle('folder:review', async () => {
  if (!selectedRoot) throw new DeskFlowError('NO_FOLDER', 'Choose a folder first.');
  const scan = await scanFolder(selectedRoot);
  const plan = await createPlan(scan.files, scan.root);
  const planId = randomUUID();
  plans.clear();
  plans.set(planId, plan);
  return {
    root: scan.root,
    summary: summarize(scan.files),
    skippedCount: scan.skipped.length,
    errorCount: scan.errors.length,
    plan: toPlanPreview(plan, planId),
  };
});

handle('folder:open', async () => {
  if (selectedRoot) await shell.openPath(selectedRoot);
});

handle('plan:apply', async (event, planId) => {
  const plan = plans.get(planId);
  if (!plan) throw new DeskFlowError('PLAN_EXPIRED', 'That preview is no longer valid. Choose the folder again.');
  if (running) throw new DeskFlowError('BUSY', 'DeskFlow is already organising files.');

  running = new AbortController();
  try {
    const result = await executePlan(plan, {
      journalPath: journalPath(),
      signal: running.signal,
      onProgress: ({ done, total }) => {
        if (done % 10 === 0 || done === total) event.sender.send('apply:progress', { done, total });
      },
    });
    return {
      opId: result.opId,
      moved: result.moved,
      skipped: result.skipped,
      failed: result.failed,
      cancelled: result.cancelled,
      problems: toApplyProblems(result.results),
    };
  } finally {
    running = null;
    plans.delete(planId); // a plan can only be applied once
  }
});

handle('plan:cancel', async () => {
  running?.abort();
});

handle('history:list', async () => (await listOperations(journalPath())).reverse());

handle('history:undo', async (event, opId) => {
  if (typeof opId !== 'string') throw new DeskFlowError('BAD_REQUEST', 'Missing operation id.');
  const result = await undoOperation(journalPath(), opId);
  return { restored: result.restored, failed: result.failed, problems: toUndoProblems(result.results) };
});

function createWindow() {
  win = new BrowserWindow({
    width: 1000,
    height: 740,
    minWidth: 720,
    minHeight: 520,
    title: 'DeskFlow',
    webPreferences: {
      preload: path.join(here, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // The window is a single page: it may not open new windows or navigate anywhere else.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => {
    if (url !== win.webContents.getURL()) event.preventDefault();
  });

  if (isDev) win.loadURL(DEV_URL);
  else win.loadFile(path.join(here, '..', 'dist-renderer', 'index.html'));
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());