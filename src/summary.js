/** Counts and sizes grouped by category and by extension, biggest first. */
export function summarize(files) {
  const byCategory = new Map();
  const byExtension = new Map();
  let totalBytes = 0;

  const add = (map, key, size) => {
    const row = map.get(key) ?? { key, count: 0, bytes: 0 };
    row.count++;
    row.bytes += size;
    map.set(key, row);
  };

  for (const f of files) {
    totalBytes += f.size;
    add(byCategory, f.category, f.size);
    add(byExtension, f.ext || '(none)', f.size);
  }

  const rows = (map, label) =>
    [...map.values()]
      .map(({ key, count, bytes }) => ({ [label]: key, count, bytes }))
      .sort((a, b) => b.bytes - a.bytes || b.count - a.count);

  return {
    totalFiles: files.length,
    totalBytes,
    byCategory: rows(byCategory, 'category'),
    byExtension: rows(byExtension, 'extension'),
  };
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let i = -1;
  do {
    value /= 1024;
    i++;
  } while (value >= 1024 && i < units.length - 1);
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[i]}`;
}