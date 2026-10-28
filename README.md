# DeskFlow

A safe file-organising assistant for Windows. Pick a folder, see exactly what DeskFlow would do, approve it, and undo it if you change your mind.

Messy Downloads folder? DeskFlow sorts the loose files into `Documents`, `Images`, `Videos`, `Audio`, `Archives`, `Installers`, `Code` and `Other` folders inside it. It only moves files after you approve a preview, never overwrites anything, and never deletes.

## Features

- **Preview first:** see every file and its destination before anything moves.
- **Approve to apply:** nothing changes until you confirm.
- **Undo:** every move is recorded in a history; undo restores files that are still where DeskFlow put them.
- **No overwrites:** a name clash becomes `report (1).pdf` instead of replacing a file.
- **Progress and cancel:** stop part-way; files already moved stay undoable.
- **Storage summary:** counts and sizes per category before you decide.

## How it keeps your files safe

- Refuses whole drives, your home folder itself, and system folders.
- Leaves hidden files, system files, unfinished downloads, and shortcuts (symlinks) alone.
- Re-checks each file immediately before moving it: still there, unchanged, destination free.
- Undo refuses to touch files that were edited, moved or replaced since, and says why.
- The window never gets real paths or the real plan, only a preview and an id. The folder can only be chosen through the native dialog, and a plan can be applied once.
- Journal is append-only, so a crash mid-operation still leaves an accurate record.

## Install (Windows)

Download `DeskFlow Setup x.y.z.exe` from the [Releases](../../releases) page and run it.

Windows may show "Windows protected your PC" because the installer is not code-signed. Choose **More info**, then **Run anyway**.

## Run from source

Requires Node.js 20 or newer.

```bash
npm install
npm run renderer:dev     # terminal 1: serves the interface
npm run app:dev          # terminal 2: opens the DeskFlow window
```

Other commands:

```bash
npm start        # build the interface and open the app without the dev server
npm test         # 40 automated tests for the engine
npm run pack     # unpacked app in release/ (quick check)
npm run dist     # Windows installer in release/
```

There is also a command-line version of the engine:

```bash
node src/cli.js plan ./folder              # preview only
node src/cli.js organise ./folder --yes
node src/cli.js history
node src/cli.js undo <operation-id>
```

## How it works

```
renderer/   React interface (Vite)
electron/   main process: native dialogs, validated actions; preload.cjs is the only bridge
src/        file engine with no dependencies
            scanner -> planner -> executor -> journal -> undo
test/       engine and CLI tests (node:test)
```

The engine is independent of the interface: the same code powers the CLI and the window.

## Built with

Electron, React, Vite, and plain Node.js (`node:fs`, `node:path`, `node:test`).

## Roadmap

- Duplicate detection (compare sizes, then SHA-256 hashes), report-only
- Storage analysis: largest files and space by type
- Custom category folders and sorting by date

## License

MIT
