import fs from 'node:fs/promises';

/** True if anything (file, folder, or link) exists at the path. */
export const pathExists = (p) => fs.lstat(p).then(() => true, () => false);