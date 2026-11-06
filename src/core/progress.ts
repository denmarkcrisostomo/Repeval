import { join } from 'node:path';
import type { Analysis, GeneratedManifest, Plan } from './types.js';
import { readJson, rel, writeJson, type Paths } from './paths.js';

// Names-only progress for the website's live flow view: what each stage found, planned and wrote.
// It holds file paths, routes, function names and skip reasons, never any code. It is written only
// when REPEVAL_PROGRESS names a folder (the GitHub workflow sets it). The workflow uploads that folder
// after Analyze, Plan and Generate, and the website streams it to the browser without keeping a copy.

export interface Progress {
  version: 1;
  stage: 'analyze' | 'plan' | 'generate';
  /** Every page, endpoint and exported function, with the file it was found in. Ids match the plan's target ids. */
  found: { id: string; kind: 'page' | 'endpoint' | 'function'; label: string; source: string }[];
  /** Every planned target, load tests included, and why it was skipped. */
  plan?: { id: string; enabled: boolean; reason?: string }[];
  /** Test files written, by file name, with the targets each one covers. */
  tests?: { file: string; targets: string[] }[];
}

function file(): string | null {
  const dir = process.env.REPEVAL_PROGRESS?.trim();
  return dir ? join(dir, 'progress.json') : null;
}

function update(stage: Progress['stage'], change: (p: Progress) => void): void {
  const f = file();
  if (!f) return;
  const p = readJson<Progress>(f) ?? { version: 1, stage, found: [] };
  p.stage = stage;
  change(p);
  writeJson(f, p);
}

export function progressAnalyzed(a: Analysis, p: Paths): void {
  update('analyze', (x) => {
    x.found = [
      ...a.pages.map((pg) => ({ id: `page:${pg.route}`, kind: 'page' as const, label: pg.route, source: pg.file })),
      ...a.endpoints.map((e) => ({ id: `api:${e.method} ${e.path}`, kind: 'endpoint' as const, label: `${e.method} ${e.path}`, source: e.file })),
      ...a.functions.map((fn) => ({
        id: `unit:${fn.id}`,
        kind: 'function' as const,
        label: fn.exportName === 'default' ? `${fn.name}() (default export)` : `${fn.exportName}()`,
        source: fn.file,
      })),
    ].map((f) => ({ ...f, source: f.source.startsWith('/') ? rel(p.root, f.source) : f.source }));
    delete x.plan;
    delete x.tests;
  });
}

export function progressPlanned(plan: Plan): void {
  update('plan', (x) => {
    x.plan = plan.targets.map((t) => ({ id: t.id, enabled: t.enabled, ...(t.enabled || !t.reason ? {} : { reason: t.reason }) }));
    delete x.tests;
  });
}

export function progressGenerated(m: GeneratedManifest): void {
  update('generate', (x) => {
    x.tests = m.files
      .filter((f) => f.kind === 'unit' || f.kind === 'e2e' || f.kind === 'api')
      .map((f) => ({ file: f.path.split('/').pop()!, targets: f.targets }));
  });
}
