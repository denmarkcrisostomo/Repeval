import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const VERSION = '0.1.3';

export interface Paths {
  root: string;
  work: string;
  analysis: string;
  plan: string;
  generated: string;
  unitDir: string;
  e2eDir: string;
  results: string;
  baselines: string;
  baselineEvents: string;
  nodeModules: string;
  vitestConfig: string;
  out: string;
}

export function getPaths(root: string, out?: string): Paths {
  const abs = resolve(root);
  const work = join(abs, '.repeval');
  return {
    root: abs,
    work,
    analysis: join(work, 'analysis.json'),
    plan: join(work, 'repeval-plan.json'),
    generated: join(work, 'generated.json'),
    unitDir: join(work, 'tests', 'unit'),
    e2eDir: join(work, 'e2e'),
    results: join(work, 'results'),
    baselines: join(work, 'baselines'),
    baselineEvents: join(work, 'results', 'baseline-events.jsonl'),
    nodeModules: join(work, 'node_modules'),
    vitestConfig: join(work, 'vitest.config.mjs'),
    out: out ? (isAbsolute(out) ? out : join(abs, out)) : join(abs, 'repeval-report'),
  };
}

/** Create .repeval/ with a .gitignore so it never shows up in `git status`. */
export function ensureWorkDir(p: Paths): void {
  mkdirSync(p.work, { recursive: true });
  const gi = join(p.work, '.gitignore');
  if (!existsSync(gi)) writeFileSync(gi, '# Repeval working files\n*\n');
}

export function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as T;
  } catch {
    return null;
  }
}

export function writeJson(file: string, data: unknown): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

export function writeText(file: string, text: string): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
}

/** Relative path with forward slashes. */
export function rel(from: string, to: string): string {
  return relative(from, to).split(sep).join('/');
}

/** Relative import specifier (always starts with ./ or ../). */
export function importPath(fromDir: string, toFile: string): string {
  const r = rel(fromDir, toFile);
  return r.startsWith('.') ? r : './' + r;
}

/** Find a file shipped with the package, both from dist/ (bundled) and src/ (tests). */
export function packageFile(...parts: string[]): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [join(here, '..', ...parts), join(here, '..', '..', ...parts)];
  for (const c of candidates) if (existsSync(c)) return c;
  return candidates[0];
}
