import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Strict content policy for the packaged app only (dev mode needs inline scripts for hot reload).
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'";
const productionCsp = {
  name: 'deskflow-csp',
  apply: 'build',
  transformIndexHtml: (html) => html.replace('</head>', `  <meta http-equiv="Content-Security-Policy" content="${CSP}" />\n  </head>`),
};

export default defineConfig({
  root: 'renderer',
  base: './', // relative paths, so the built page also works when loaded from a file
  plugins: [react(), productionCsp],
  server: { port: 5173, strictPort: true },
  build: { outDir: '../dist-renderer', emptyOutDir: true },
});