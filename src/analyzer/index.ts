import { VERSION } from '../core/paths.js';
import type { Analysis } from '../core/types.js';
import { detectBoot } from './boot.js';
import { mapCode } from './codemap.js';
import { listFiles } from './files.js';
import { findRoutes } from './routes.js';
import { detectStack } from './stack.js';

export function analyze(root: string): Analysis {
  const started = Date.now();
  const stack = detectStack(root);
  const files = listFiles(root);
  const code = mapCode(root, files.source);
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
