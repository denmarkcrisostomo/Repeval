// Packs the real demo-shop report (examples/express-app/repeval-report) into public/demo/repeval-report.zip,
// laid out the way GitHub's artifact download is: the report folder's contents at the zip root.
// Videos and traces are left out to keep the file small; the website doesn't show them yet.
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { zipSync } from 'fflate';

const src = new URL('../../examples/express-app/repeval-report/', import.meta.url).pathname;
const out = new URL('../public/demo/repeval-report.zip', import.meta.url).pathname;
const SKIP = new Set(['videos', 'traces', 'index.html']);

const files = {};
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const rel = relative(src, full);
    if (SKIP.has(rel.split('/')[0])) continue;
    if (statSync(full).isDirectory()) walk(full);
    else files[rel] = readFileSync(full);
  }
})(src);

mkdirSync(join(out, '..'), { recursive: true });
const zip = zipSync(files, { level: 6 });
writeFileSync(out, zip);
console.log(`wrote ${Object.keys(files).length} files, ${(zip.length / 1024).toFixed(0)} KB -> public/demo/repeval-report.zip`);
