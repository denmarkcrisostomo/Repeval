// Shapes the pages work with. GitHub data is reduced to these on the server, so only
// what a page shows ever reaches the browser.

export interface Repo {
  owner: string;
  name: string;
  private: boolean;
  defaultBranch: string;
  pushedAt: string | null;
  /** Whether .github/workflows/repeval.yml exists. Only filled in where a page needs it. */
  hasWorkflow?: boolean;
  /** The workflow file is there but older than the current template. */
  workflowOutdated?: boolean;
}

export type StepState = 'waiting' | 'running' | 'passed' | 'failed' | 'skipped';

export interface RunStep {
  key: string;
  name: string;
  state: StepState;
  /** Seconds the step took, once it has finished. */
  seconds?: number;
}

export type RunPhase = 'queued' | 'running' | 'done';

export interface RunSummary {
  id: string;
  phase: RunPhase;
  /** GitHub's conclusion once done: success, failure, cancelled, timed_out… */
  conclusion: string | null;
  branch: string;
  createdAt: string;
  startedAt: string | null;
  updatedAt: string;
  actor: string;
  htmlUrl: string | null;
}

export interface RunStatus extends RunSummary {
  steps: RunStep[];
  /** True when the repeval-report artifact exists and has not expired. */
  hasReport: boolean;
  /** The latest progress stage the server looked for (1 Analyze, 2 Plan, 3 Generate), found or not. */
  progressChecked?: number;
  /** Names-only progress from workflow v3, when a newer stage than the browser asked about was found. */
  progress?: Progress;
}

/** What the run has found, planned and written so far. Names only, never code (see the CLI's src/core/progress.ts). */
export interface Progress {
  version: 1;
  stage: 'analyze' | 'plan' | 'generate';
  found: { id: string; kind: 'page' | 'endpoint' | 'function'; label: string; source: string }[];
  plan?: { id: string; enabled: boolean; reason?: string }[];
  tests?: { file: string; targets: string[] }[];
}

export const TEST_CHOICES = ['all', 'unit', 'e2e'] as const;
export type TestChoice = (typeof TEST_CHOICES)[number];
