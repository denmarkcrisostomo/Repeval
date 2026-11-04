import fg from 'fast-glob';
import { statSync } from 'node:fs';
import { join } from 'node:path';

export const IGNORE = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/out/**',
  '**/.next/**',
  '**/.nuxt/**',
  '**/.svelte-kit/**',
  '**/.vercel/**',
  '**/.turbo/**',
  '**/.cache/**',
  '**/coverage/**',
  '**/.repeval/**',
  '**/repeval-report/**',
  '**/playwright-report/**',
  '**/test-results/**',
  '**/*.d.ts',
  '**/*.min.js',
];

const MAX_FILE_BYTES = 200_000;

export interface FileSet {
  /** Every candidate file (code, .svelte, .vue, .html), relative to root. */
  all: string[];
  /** JS/TS source files that are not tests or configs. */
  source: string[];
  tests: string[];
}

const TEST_RE = /(^|\/)(__tests__|__mocks__)\/|\.(test|spec)\.[cm]?[jt]sx?$/;
const CONFIG_RE = /(^|\/)[^/]*\.config\.[cm]?[jt]s$|(^|\/)\.[^/]*rc\.[cm]?js$/;
const CODE_RE = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;

export function listFiles(root: string): FileSet {
  const all = fg
    .sync(['**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs,svelte,vue,astro,html}'], {
      cwd: root,
      ignore: IGNORE,
      dot: false,
      followSymbolicLinks: false,
    })
    .filter((f) => {
      try {
        return statSync(join(root, f)).size <= MAX_FILE_BYTES;
      } catch {
        return false;
      }
    })
    .sort();
  const tests = all.filter((f) => CODE_RE.test(f) && TEST_RE.test(f));
  const source = all.filter((f) => CODE_RE.test(f) && !TEST_RE.test(f) && !CONFIG_RE.test(f));
  return { all, source, tests };
}
