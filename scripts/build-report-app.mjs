// Bundles the React Flow report UI into dist/report-app/main.js + main.css.
// The CLI inlines both into each report's index.html, so reports open offline.
import { build } from 'esbuild';

await build({
  entryPoints: ['src/report-app/main.tsx'],
  outdir: 'dist/report-app',
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2020'],
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  legalComments: 'none',
  logLevel: 'info',
});
