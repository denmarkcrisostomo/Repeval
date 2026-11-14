import { VERSION } from '../core/paths.js';
import type { Analysis } from '../core/types.js';
import { detectBoot } from './boot.js';
import { mapCode } from './codemap.js';
import { listFiles } from './files.js';
import { findRoutes } from './routes.js';
import { detectStack } from './stack.js';

/** Progress for the CLI's indicator: the files found, then each file as its code is read. */
export interface AnalyzeProgress {
  files?(source: number, tests: number): void;
  code?(done: number, total: number): void;
}

export function analyze(root: string, progress: AnalyzeProgress = {}): Analysis {
  const started = Date.now();
  const stack = detectStack(root);
  const files = listFiles(root);
  progress.files?.(files.source.length, files.tests.length);
  const code = mapCode(root, files.source, progress.code);
  const routes = findRoutes(root, stack, files.all);
  const boot = detectBoot(root, stack, files.source);
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    repeval: VERSION,
    stack,
    sourceFiles: files.source.length,
    testFiles: files.tests,
    functions: code.functions,
    classes: code.classes,
    skippedFiles: code.skippedFiles,
    pages: routes.pages,
    endpoints: routes.endpoints,
    boot,
    durationMs: Date.now() - started,
  };
}
