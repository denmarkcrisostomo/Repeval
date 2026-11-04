import type { TestResult } from './types.js';

export type StageStatus = 'done' | 'warn' | 'fail' | 'skipped' | 'off';

export interface Stage {
  id: string;
  label: string;
  group: 'input' | 'understand' | 'plan' | 'make' | 'run' | 'results';
  status: StageStatus;
  detail: string;
  /** Longer explanation shown when the node is clicked. */
  info: string[];
  counts?: Partial<Record<TestResult['status'], number>>;
  /** Test result ids that belong to this stage (for test stages). */
  tests?: string[];
}

export interface ReportData {
  meta: {
    repo: string;
    repeval: string;
    generatedAt: string;
    durationMs: number;
    ai: string;
    stack: string[];
    startCommand: string | null;
  };
  summary: Record<TestResult['status'], number> & { total: number };
  baselines: { recorded: number; matched: number; changed: number };
  stages: Stage[];
  edges: { from: string; to: string; kind?: 'ai' | 'muted' }[];
  tests: TestResult[];
  suites: { kind: string; framework: string; status: string; message?: string }[];
  generated: { path: string; framework: string; kind: string; code: string }[];
}
