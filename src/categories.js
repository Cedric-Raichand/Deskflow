import path from 'node:path';

const CATEGORY_EXTENSIONS = {
  Documents: ['.pdf', '.doc', '.docx', '.txt', '.rtf', '.odt', '.md', '.xls', '.xlsx', '.csv', '.ppt', '.pptx'],
  Images: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.heic', '.tiff', '.ico'],
  Videos: ['.mp4', '.mkv', '.mov', '.avi', '.wmv', '.webm', '.flv'],
  Audio: ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a'],
  Archives: ['.zip', '.rar', '.7z', '.tar', '.gz', '.tgz', '.bz2'],
  Installers: ['.exe', '.msi', '.dmg', '.pkg', '.deb', '.appimage'],
  Code: ['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.c', '.cpp', '.cs', '.go', '.rs', '.html', '.css', '.json', '.sh', '.ps1', '.sql', '.php', '.rb'],
};

export const OTHER = 'Other';
export const CATEGORY_NAMES = [...Object.keys(CATEGORY_EXTENSIONS), OTHER];

const EXT_TO_CATEGORY = new Map();
for (const [category, exts] of Object.entries(CATEGORY_EXTENSIONS)) {
  for (const ext of exts) EXT_TO_CATEGORY.set(ext, category);
}

/** Lower-cased extension including the dot, or '' when there is none. */
export function extensionOf(fileName) {
  return path.extname(fileName).toLowerCase();
}

// Note: this trusts the extension. An extension is not proof of what a file really contains.
export function categoryFor(fileName) {
  return EXT_TO_CATEGORY.get(extensionOf(fileName)) ?? OTHER;
}