import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { writeJson, writeText, type Paths } from '../core/paths.js';
import type { Analysis, GeneratedManifest, Plan } from '../core/types.js';
import { generateE2E } from './playwright.js';
import { generateUnit } from './vitest.js';

/** Template writer: turns the approved plan into test files under .repeval/. */
export function generateTests(a: Analysis, plan: Plan, p: Paths, ai: string): GeneratedManifest {
  // Start clean so tests for removed targets don't linger.
  rmSync(join(p.work, 'tests'), { recursive: true, force: true });
  rmSync(p.e2eDir, { recursive: true, force: true });

  const unit = generateUnit(a, plan, p);
  const e2e = generateE2E(plan, p);
  for (const [path, text] of [...unit.contents, ...e2e.contents]) writeText(path, text);

  const manifest: GeneratedManifest = {
    version: 1,
    createdAt: new Date().toISOString(),
    ai,
    writer: 'templates',
    files: [...unit.files, ...e2e.files],
  };
  writeJson(p.generated, manifest);
  return manifest;
}
