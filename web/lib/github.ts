import 'server-only';
import { unzipSync } from 'fflate';
import { findStep } from './steps';
import type { Progress, Repo, RunPhase, RunStatus, RunStep, RunSummary, StepState, TestChoice } from './types';
import { ARTIFACT_NAME, PROGRESS_ARTIFACT, SAVE_RUN_TITLE, WORKFLOW_FILE, WORKFLOW_NAME } from './workflow';

// Thin GitHub REST client. Runs on the server only, with the signed-in user's own token.
// The GitHub App behind that token has Actions (read/write) and Metadata (read) permissions
// and no Contents permission, so none of these calls can read the repo's code.

const API = 'https://api.github.com';

export class GitHubError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function call(token: string, path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(path.startsWith('http') ? path : API + path, {
    ...init,
    cache: 'no-store',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'repeval-web',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  return res;
}

async function json<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await call(token, path, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { message?: string });
    throw new GitHubError(res.status, (body as { message?: string }).message ?? res.statusText);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

const repoPath = (owner: string, repo: string) => `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

/* ---------- repos ---------- */

interface GhRepo {
  name: string;
  owner: { login: string };
  private: boolean;
  default_branch: string;
  pushed_at: string | null;
}
const toRepo = (r: GhRepo): Repo => ({
  owner: r.owner.login,
  name: r.name,
  private: r.private,
  defaultBranch: r.default_branch,
  pushedAt: r.pushed_at,
});

/** Repos the user allowed the Repeval app to see, across every account where it is installed. */
export async function listRepos(token: string): Promise<Repo[]> {
  const { installations } = await json<{ installations: { id: number }[] }>(token, '/user/installations?per_page=100');
  const all: Repo[] = [];
  for (const inst of installations) {
    for (let page = 1; page <= 5; page++) {
      const data = await json<{ repositories: GhRepo[]; total_count: number }>(
        token,
        `/user/installations/${inst.id}/repositories?per_page=100&page=${page}`,
      );
      all.push(...data.repositories.map(toRepo));
      if (all.length >= data.total_count || data.repositories.length < 100) break;
    }
  }
  return all.sort((a, b) => (b.pushedAt ?? '').localeCompare(a.pushedAt ?? ''));
}

export async function getRepo(token: string, owner: string, repo: string): Promise<Repo> {
  const r = toRepo(await json<GhRepo>(token, repoPath(owner, repo)));
  Object.assign(r, await workflowState(token, owner, repo));
  return r;
}

/**
 * Looks the workflow up through the Actions API, which needs no access to the repo's files.
 * The API returns the workflow's name, and the name carries the template version ("workflow v2").
 */
export async function workflowState(token: string, owner: string, repo: string): Promise<Pick<Repo, 'hasWorkflow' | 'workflowOutdated'>> {
  const res = await call(token, `${repoPath(owner, repo)}/actions/workflows/${WORKFLOW_FILE}`);
  if (res.status === 404) return { hasWorkflow: false, workflowOutdated: false };
  if (!res.ok) throw new GitHubError(res.status, res.statusText);
  const { name } = (await res.json()) as { name?: string };
  return { hasWorkflow: true, workflowOutdated: name !== WORKFLOW_NAME };
}

/* ---------- runs ---------- */

interface GhRun {
  id: number;
  status: string;
  conclusion: string | null;
  head_branch: string;
  created_at: string;
  run_started_at: string | null;
  updated_at: string;
  actor: { login: string } | null;
  html_url: string;
  display_title?: string;
}

const phaseOf = (status: string): RunPhase =>
  status === 'completed' ? 'done' : status === 'in_progress' ? 'running' : 'queued';

const toSummary = (r: GhRun): RunSummary => ({
  id: String(r.id),
  phase: phaseOf(r.status),
  conclusion: r.conclusion,
  branch: r.head_branch,
  createdAt: r.created_at,
  startedAt: r.run_started_at,
  updatedAt: r.updated_at,
  actor: r.actor?.login ?? 'someone',
  htmlUrl: r.html_url,
});

export async function listRuns(token: string, owner: string, repo: string): Promise<RunSummary[]> {
  const res = await call(token, `${repoPath(owner, repo)}/actions/workflows/${WORKFLOW_FILE}/runs?per_page=10`);
  if (res.status === 404) return [];
  if (!res.ok) throw new GitHubError(res.status, res.statusText);
  const { workflow_runs } = (await res.json()) as { workflow_runs: GhRun[] };
  // "Commit to a branch" runs are not test runs, so they stay out of the run history.
  return workflow_runs.filter((r) => r.display_title !== SAVE_RUN_TITLE).map(toSummary);
}

/**
 * Starts the workflow on the repo's default branch and returns the new run's id.
 * GitHub can return the run id directly; if it doesn't, the newest run this user started is used.
 */
async function dispatch(token: string, owner: string, repo: string, branch: string, inputs: Record<string, string>, login: string): Promise<string> {
  const since = Date.now();
  const res = await call(token, `${repoPath(owner, repo)}/actions/workflows/${WORKFLOW_FILE}/dispatches`, {
    method: 'POST',
    body: JSON.stringify({ ref: branch, inputs, return_run_details: true }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new GitHubError(res.status, body.message ?? res.statusText);
  }
  if (res.status === 200) {
    const body = (await res.json().catch(() => ({}))) as { workflow_run_id?: number };
    if (body.workflow_run_id) return String(body.workflow_run_id);
  }
  // Older behaviour: 204 with no body. The run shows up in the list within a few seconds.
  for (let attempt = 0; attempt < 8; attempt++) {
    await new Promise((r) => setTimeout(r, 1500));
    const runs = await json<{ workflow_runs: GhRun[] }>(
      token,
      `${repoPath(owner, repo)}/actions/workflows/${WORKFLOW_FILE}/runs?event=workflow_dispatch&actor=${encodeURIComponent(login)}&per_page=5`,
    );
    const fresh = runs.workflow_runs.find((r) => new Date(r.created_at).getTime() >= since - 30_000);
    if (fresh) return String(fresh.id);
  }
  throw new GitHubError(504, 'The run was started, but GitHub has not listed it yet. Open the repo again in a moment.');
}

export function startRun(token: string, owner: string, repo: string, branch: string, tests: TestChoice, login: string): Promise<string> {
  return dispatch(token, owner, repo, branch, { ai: 'none', tests }, login);
}

/** Starts the workflow's save-tests job, which pushes the tests from fromRunId to the repeval-tests branch. */
export function startSave(token: string, owner: string, repo: string, branch: string, fromRunId: string, login: string): Promise<string> {
  return dispatch(token, owner, repo, branch, { ai: 'none', tests: 'all', save_from_run: fromRunId }, login);
}

interface GhStep {
  name: string;
  status: string;
  conclusion: string | null;
  started_at: string | null;
  completed_at: string | null;
}

function stepState(s: GhStep): StepState {
  if (s.status !== 'completed') return s.status === 'in_progress' ? 'running' : 'waiting';
  if (s.conclusion === 'success') return 'passed';
  if (s.conclusion === 'skipped') return 'skipped';
  return 'failed';
}

// Workflow v3 saves a names-only progress file after these steps.
const SHARE_STEP: Record<string, number> = {
  'share progress after analyze': 1,
  'share progress after plan': 2,
  'share progress after generate': 3,
};

/**
 * Status of one run. `checked` is the progress stage the browser already has (or knows is missing), so the
 * artifact list is only asked for when the run has just shared something newer: a few extra calls per run.
 */
export async function getRunStatus(token: string, owner: string, repo: string, runId: string, checked = 0): Promise<RunStatus> {
  const base = repoPath(owner, repo);
  const run = await json<GhRun>(token, `${base}/actions/runs/${runId}`);
  const { jobs } = await json<{ jobs: { name: string; conclusion: string | null; steps?: GhStep[] }[] }>(
    token,
    `${base}/actions/runs/${runId}/jobs?per_page=10`,
  );
  // The workflow has two jobs and only one runs; the other is skipped.
  const job = jobs.find((j) => j.name === 'repeval') ?? jobs.find((j) => j.conclusion !== 'skipped') ?? jobs[0];
  const ghSteps = job?.steps ?? [];
  const steps: RunStep[] = [];
  for (const s of ghSteps) {
    const info = findStep(s.name);
    if (!info) continue; // GitHub's own setup and cleanup steps
    const seconds =
      s.started_at && s.completed_at ? Math.max(0, Math.round((Date.parse(s.completed_at) - Date.parse(s.started_at)) / 1000)) : undefined;
    steps.push({ key: info.key, name: info.name, state: stepState(s), seconds });
  }
  const summary = toSummary(run);
  let hasReport = false;
  if (summary.phase === 'done') {
    hasReport = (await findReportArtifact(token, owner, repo, runId)) !== null;
    return { ...summary, steps, hasReport };
  }
  const shared = Math.max(
    0,
    ...ghSteps.filter((s) => s.status === 'completed' && s.conclusion === 'success').map((s) => SHARE_STEP[s.name.trim().toLowerCase()] ?? 0),
  );
  if (shared <= checked) return { ...summary, steps, hasReport, progressChecked: checked };
  try {
    // null: the run shared nothing (its Repeval is older than 0.1.4). Then the browser stops asking for this stage.
    const progress = await fetchProgress(token, owner, repo, runId, shared);
    return { ...summary, steps, hasReport, progressChecked: shared, ...(progress ? { progress } : {}) };
  } catch {
    // GitHub hiccup: leave `checked` as it was so the next poll tries again.
    return { ...summary, steps, hasReport, progressChecked: checked };
  }
}

/* ---------- the report artifact ---------- */

interface GhArtifact {
  id: number;
  name: string;
  expired: boolean;
  size_in_bytes: number;
  archive_download_url: string;
}

async function findReportArtifact(token: string, owner: string, repo: string, runId: string): Promise<GhArtifact | null> {
  const { artifacts } = await json<{ artifacts: GhArtifact[] }>(
    token,
    `${repoPath(owner, repo)}/actions/runs/${runId}/artifacts?per_page=20`,
  );
  return artifacts.find((a) => a.name === ARTIFACT_NAME && !a.expired) ?? null;
}

const str = (v: unknown, max = 300): string | null => (typeof v === 'string' && v.length <= max ? v : null);

/** Keeps only the fields the flow view uses, with sane sizes, from a progress file the run wrote. */
function cleanProgress(raw: unknown): Progress | null {
  const r = raw as Partial<Progress> | null;
  if (!r || r.version !== 1 || !Array.isArray(r.found)) return null;
  const stage = r.stage === 'plan' || r.stage === 'generate' ? r.stage : 'analyze';
  const found = r.found.slice(0, 2000).flatMap((f) => {
    const id = str(f?.id), label = str(f?.label), source = str(f?.source);
    const kind = f?.kind === 'page' || f?.kind === 'endpoint' || f?.kind === 'function' ? f.kind : null;
    return id && label && source && kind ? [{ id, kind, label, source }] : [];
  });
  const out: Progress = { version: 1, stage, found };
  if (Array.isArray(r.plan))
    out.plan = r.plan.slice(0, 4000).flatMap((t) => {
      const id = str(t?.id);
      const reason = str(t?.reason);
      return id ? [{ id, enabled: t.enabled === true, ...(reason ? { reason } : {}) }] : [];
    });
  if (Array.isArray(r.tests))
    out.tests = r.tests.slice(0, 500).flatMap((t) => {
      const file = str(t?.file);
      return file && Array.isArray(t.targets) ? [{ file, targets: t.targets.slice(0, 2000).flatMap((x) => str(x) ?? []) }] : [];
    });
  return out;
}

/**
 * The newest names-only progress file the run has shared. It is unzipped in memory and only the
 * names the flow view draws are passed on to the browser. Nothing is written anywhere.
 */
async function fetchProgress(token: string, owner: string, repo: string, runId: string, upTo: number): Promise<Progress | null> {
  const { artifacts } = await json<{ artifacts: GhArtifact[] }>(token, `${repoPath(owner, repo)}/actions/runs/${runId}/artifacts?per_page=20`);
  for (let n = upTo; n >= 1; n--) {
    const a = artifacts.find((x) => x.name === PROGRESS_ARTIFACT + n && !x.expired);
    if (!a || a.size_in_bytes > 2_000_000) continue;
    const res = await call(token, a.archive_download_url, { redirect: 'follow' });
    if (!res.ok) continue;
    const files = unzipSync(new Uint8Array(await res.arrayBuffer()));
    const entry = files['progress.json'];
    if (!entry) continue;
    return cleanProgress(JSON.parse(new TextDecoder().decode(entry)));
  }
  return null;
}

/**
 * Fetches the report zip from GitHub and hands back the response to stream straight to the browser.
 * Nothing is written anywhere on the way through.
 */
export async function fetchReportZip(token: string, owner: string, repo: string, runId: string): Promise<Response | null> {
  const artifact = await findReportArtifact(token, owner, repo, runId);
  if (!artifact) return null;
  // GitHub answers with a redirect to a short-lived signed URL; fetch follows it without the token.
  const res = await call(token, artifact.archive_download_url, { redirect: 'follow' });
  if (!res.ok || !res.body) throw new GitHubError(res.status, 'Could not download the report from GitHub.');
  return res;
}

/** Revokes the user's token when they sign out, so it stops working right away. */
export async function revokeToken(token: string): Promise<void> {
  const id = process.env.AUTH_GITHUB_ID;
  const secret = process.env.AUTH_GITHUB_SECRET;
  if (!id || !secret) return;
  await fetch(`${API}/applications/${encodeURIComponent(id)}/token`, {
    method: 'DELETE',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
      'Content-Type': 'application/json',
      'User-Agent': 'repeval-web',
    },
    body: JSON.stringify({ access_token: token }),
  }).catch(() => undefined);
}
