import 'server-only';
import { cookies } from 'next/headers';
import DEMO_PROGRESS from './demo-progress.json';
import { STEPS } from './steps';
import type { Progress, Repo, RunStatus, RunStep, RunSummary } from './types';

// Demo mode: example repos and a simulated run of the real demo-shop example, so the whole flow
// can be tried without a GitHub App. State lives in two small cookies; nothing is stored anywhere else.

const OWNER = 'you';
const HOUR = 3600_000;
const REPOS: Repo[] = [
  { owner: OWNER, name: 'demo-shop', private: false, defaultBranch: 'main', pushedAt: new Date(Date.now() - 2 * HOUR).toISOString() },
  { owner: OWNER, name: 'ts-lib', private: false, defaultBranch: 'main', pushedAt: new Date(Date.now() - 26 * HOUR).toISOString() },
  { owner: OWNER, name: 'portfolio-site', private: true, defaultBranch: 'main', pushedAt: new Date(Date.now() - 72 * HOUR).toISOString() },
  { owner: OWNER, name: 'notes-api', private: true, defaultBranch: 'main', pushedAt: new Date(Date.now() - 8 * 24 * HOUR).toISOString() },
];
const READY = new Set(['demo-shop', 'ts-lib']);
/** Has the workflow, but an older version, to show the "update" notice. */
const OUTDATED = new Set(['ts-lib']);

const WF_COOKIE = 'repeval-demo-wf';
const RUNS_COOKIE = 'repeval-demo-runs';
const cookieOpts = { httpOnly: true, sameSite: 'lax' as const, path: '/', maxAge: 8 * 60 * 60 };

async function addedWorkflows(): Promise<string[]> {
  const v = (await cookies()).get(WF_COOKIE)?.value ?? '';
  return v.split(',').filter(Boolean);
}

export async function listRepos(): Promise<Repo[]> {
  const added = await addedWorkflows();
  return REPOS.map((r) => ({
    ...r,
    hasWorkflow: READY.has(r.name) || added.includes(r.name),
    workflowOutdated: OUTDATED.has(r.name) && !added.includes(r.name),
  }));
}

export async function getRepo(name: string): Promise<Repo | null> {
  return (await listRepos()).find((r) => r.name === name) ?? null;
}

/** Stands in for the user committing (or updating) the workflow file on GitHub. */
export async function markWorkflowAdded(name: string): Promise<void> {
  const added = new Set(await addedWorkflows());
  added.add(name);
  (await cookies()).set(WF_COOKIE, [...added].join(','), cookieOpts);
}

/* ---------- simulated runs ---------- */

// Seconds per step, roughly a real demo-shop run sped up so it finishes in about half a minute.
const DUR = [2, 3, 4, 2, 2, 12, 2];
const QUEUED = 3;
const TOTAL = DUR.reduce((a, b) => a + b, 0);
const PAST_RUN = 'd' + Math.floor(Date.parse('2026-11-04T09:12:00Z') / 1000).toString(36);

const startOf = (id: string) => parseInt(id.slice(1), 36) * 1000;
const newId = () => 'd' + Math.floor(Date.now() / 1000).toString(36);

async function runsFor(repo: string): Promise<string[]> {
  let list: { repo: string; id: string }[] = [];
  try {
    list = JSON.parse((await cookies()).get(RUNS_COOKIE)?.value ?? '[]');
  } catch {
    list = [];
  }
  const mine = list.filter((r) => r.repo === repo && /^d[0-9a-z]+$/.test(r.id)).map((r) => r.id);
  return repo === 'demo-shop' ? [...mine, PAST_RUN] : mine;
}

export async function startRun(repo: string): Promise<string> {
  const id = newId();
  let list: { repo: string; id: string }[] = [];
  try {
    list = JSON.parse((await cookies()).get(RUNS_COOKIE)?.value ?? '[]');
  } catch {
    list = [];
  }
  list.unshift({ repo, id });
  (await cookies()).set(RUNS_COOKIE, JSON.stringify(list.slice(0, 6)), cookieOpts);
  return id;
}

function simulate(repo: string, id: string): RunStatus {
  const start = startOf(id);
  const t = (Date.now() - start) / 1000;
  const run = t - QUEUED;
  let acc = 0;
  const steps: RunStep[] = STEPS.map((s, i) => {
    const from = acc;
    acc += DUR[i];
    // The demo shop has a real bug on /cart, so its Test step fails like it does on GitHub.
    const failing = s.key === 'test' && repo === 'demo-shop';
    if (run >= acc) return { key: s.key, name: s.name, state: failing ? 'failed' : 'passed', seconds: DUR[i] };
    if (run >= from) return { key: s.key, name: s.name, state: 'running' };
    return { key: s.key, name: s.name, state: 'waiting' };
  });
  const done = run >= TOTAL;
  const iso = (ms: number) => new Date(ms).toISOString();
  return {
    id,
    phase: done ? 'done' : run >= 0 ? 'running' : 'queued',
    conclusion: done ? (repo === 'demo-shop' ? 'failure' : 'success') : null,
    branch: 'main',
    createdAt: iso(start),
    startedAt: run >= 0 ? iso(start + QUEUED * 1000) : null,
    updatedAt: iso(Math.min(Date.now(), start + (QUEUED + TOTAL) * 1000)),
    actor: OWNER,
    htmlUrl: null,
    steps,
    hasReport: done,
  };
}

export async function listRuns(repo: string): Promise<RunSummary[]> {
  return (await runsFor(repo)).map((id) => {
    const { steps: _steps, hasReport: _r, ...summary } = simulate(repo, id);
    return summary;
  });
}

/* ---------- simulated "Commit to a branch" ---------- */

const SAVE_SECONDS = 6;

/** Save runs carry their start time in the id ("s" + base-36 seconds), so no state is needed. */
export function startSave(): string {
  return 's' + Math.floor(Date.now() / 1000).toString(36);
}

function simulateSave(id: string): RunStatus {
  const start = startOf(id);
  const done = Date.now() - start >= SAVE_SECONDS * 1000;
  const iso = (ms: number) => new Date(ms).toISOString();
  return {
    id,
    phase: done ? 'done' : 'running',
    conclusion: done ? 'success' : null,
    branch: 'main',
    createdAt: iso(start),
    startedAt: iso(start),
    updatedAt: iso(Math.min(Date.now(), start + SAVE_SECONDS * 1000)),
    actor: OWNER,
    htmlUrl: null,
    steps: [],
    hasReport: false,
  };
}

export async function getRunStatus(repo: string, id: string, checked = 0): Promise<RunStatus | null> {
  if (id.startsWith('s')) return Date.now() - startOf(id) < 3600_000 ? simulateSave(id) : null;
  if (!(await runsFor(repo)).includes(id)) return null;
  const status = simulate(repo, id);
  if (status.phase === 'done') return status;
  // Like workflow v3: a names-only progress file once Analyze, Plan and Generate are done.
  const shared = ['analyze', 'plan', 'generate'].filter((k) => status.steps.find((s) => s.key === k)?.state === 'passed').length;
  if (shared <= checked) return { ...status, progressChecked: checked };
  const full = DEMO_PROGRESS as Progress;
  const progress: Progress = {
    version: 1,
    stage: (['analyze', 'plan', 'generate'] as const)[shared - 1],
    found: full.found,
    ...(shared >= 2 ? { plan: full.plan } : {}),
    ...(shared >= 3 ? { tests: full.tests } : {}),
  };
  return { ...status, progressChecked: shared, progress };
}

/** The demo report is the real report from examples/express-app, bundled as a static file. */
export const DEMO_REPORT_URL = '/demo/repeval-report.zip';
