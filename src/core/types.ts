import { z } from 'zod';

/* ---------- Analysis (step 2: understand the repo) ---------- */

export interface FrameworkInfo {
  id: string;
  label: string;
  version: string | null;
}

export interface StackInfo {
  name: string;
  language: 'typescript' | 'javascript';
  packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun';
  moduleType: 'esm' | 'cjs';
  frameworks: FrameworkInfo[];
  testTools: string[];
  scripts: Record<string, string>;
  hasPackageJson: boolean;
}

export interface ParamInfo {
  name: string;
  type: string;
  optional: boolean;
  /** Sample values as JavaScript source, first one is the "typical" value. null = no safe sample. */
  samples: string[] | null;
}

export interface FunctionInfo {
  /** `<file>#<exportName>` */
  id: string;
  file: string;
  name: string;
  exportName: string;
  async: boolean;
  params: ParamInfo[];
  returnType: string;
  lines: number;
  isComponent: boolean;
  /** Why calling it in a test could have side effects. Empty = looks pure. */
  impureReasons: string[];
  /** True when Repeval can call it with generated sample arguments. */
  callable: boolean;
  /** Argument lists as JavaScript source, used for baseline tests. */
  cases: string[][];
}

export interface SkippedFile {
  file: string;
  reason: string;
}

export interface PageInfo {
  route: string;
  file: string;
  dynamic: boolean;
  source: string;
}

export interface EndpointInfo {
  method: string;
  path: string;
  file: string;
  dynamic: boolean;
  source: string;
}

export interface BootInfo {
  command: string | null;
  port: number | null;
  envVars: { name: string; present: boolean }[];
  note: string;
}

export interface Analysis {
  version: 1;
  generatedAt: string;
  repeval: string;
  stack: StackInfo;
  sourceFiles: number;
  testFiles: string[];
  functions: FunctionInfo[];
  classes: { id: string; file: string; exportName: string }[];
  skippedFiles: SkippedFile[];
  pages: PageInfo[];
  endpoints: EndpointInfo[];
  boot: BootInfo;
  durationMs: number;
}

/* ---------- Plan (step 3) ---------- */

export const TestKind = z.enum(['unit', 'e2e', 'api', 'load']);
export type TestKind = z.infer<typeof TestKind>;

export const TestsFilter = z.enum(['all', 'unit', 'e2e', 'load']);
export type TestsFilter = z.infer<typeof TestsFilter>;

export const TargetSchema = z.object({
  id: z.string(),
  type: TestKind,
  target: z.string(),
  label: z.string(),
  framework: z.enum(['vitest', 'playwright', 'k6']),
  priority: z.enum(['high', 'medium', 'low']),
  enabled: z.boolean(),
  reason: z.string().optional(),
});
export type Target = z.infer<typeof TargetSchema>;

export const PlanSchema = z.object({
  version: z.literal(1),
  createdAt: z.string(),
  tests: TestsFilter,
  targets: z.array(TargetSchema),
});
export type Plan = z.infer<typeof PlanSchema>;

/* ---------- Generated tests (step 4) ---------- */

export interface GeneratedFile {
  /** Path relative to the repo root. */
  path: string;
  kind: 'unit' | 'e2e' | 'api' | 'config' | 'helper';
  framework: 'vitest' | 'playwright';
  targets: string[];
}

export interface GeneratedManifest {
  version: 1;
  createdAt: string;
  ai: string;
  writer: 'templates';
  files: GeneratedFile[];
}

/* ---------- Results (steps 5 and 6) ---------- */

export type TestStatus = 'passed' | 'broken' | 'possible-bug' | 'skipped';

export interface TestResult {
  id: string;
  suite: TestKind;
  title: string;
  /** Plan target id this test covers, when known. */
  target?: string;
  file?: string;
  status: TestStatus;
  message?: string;
  durationMs: number;
  /** Paths relative to the report folder. */
  screenshots: string[];
  trace?: string;
  video?: string;
  note?: string;
}

export interface SuiteRun {
  kind: 'unit' | 'e2e' | 'load';
  framework: 'vitest' | 'playwright' | 'k6';
  status: 'ran' | 'skipped' | 'error';
  message?: string;
  durationMs: number;
}

export interface RunResults {
  version: 1;
  startedAt: string;
  finishedAt: string;
  suites: SuiteRun[];
  tests: TestResult[];
  baselines: { recorded: number; matched: number; changed: number };
}
