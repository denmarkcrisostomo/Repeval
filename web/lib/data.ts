import 'server-only';
import * as demo from './demo';
import * as gh from './github';
import type { Access } from './session';
import type { Repo, RunStatus, RunSummary, TestChoice } from './types';

// One place the pages call. It picks GitHub or the demo based on who is signed in.

/** Lists repos and, for the most recently pushed ones, whether the workflow file is there yet. */
export async function listRepos(a: Access): Promise<Repo[]> {
  if (a.kind === 'demo') return demo.listRepos();
  const repos = await gh.listRepos(a.token);
  const checked = await Promise.allSettled(repos.slice(0, 30).map((r) => gh.workflowState(a.token, r.owner, r.name)));
  checked.forEach((c, i) => {
    if (c.status === 'fulfilled') Object.assign(repos[i], c.value);
  });
  return repos;
}

export async function getRepo(a: Access, owner: string, name: string): Promise<Repo | null> {
  if (a.kind === 'demo') return owner === a.login ? demo.getRepo(name) : null;
  try {
    return await gh.getRepo(a.token, owner, name);
  } catch (e) {
    if (e instanceof gh.GitHubError && (e.status === 404 || e.status === 403)) return null;
    throw e;
  }
}

export async function listRuns(a: Access, owner: string, name: string): Promise<RunSummary[]> {
  return a.kind === 'demo' ? demo.listRuns(name) : gh.listRuns(a.token, owner, name);
}

export async function startRun(a: Access, repo: Repo, tests: TestChoice): Promise<string> {
  return a.kind === 'demo' ? demo.startRun(repo.name) : gh.startRun(a.token, repo.owner, repo.name, repo.defaultBranch, tests, a.login);
}

/** Pushes the tests from an earlier run to the repeval-tests branch, through the repo's own workflow. */
export async function startSave(a: Access, repo: Repo, fromRunId: string): Promise<string> {
  return a.kind === 'demo' ? demo.startSave() : gh.startSave(a.token, repo.owner, repo.name, repo.defaultBranch, fromRunId, a.login);
}

export async function getRunStatus(a: Access, owner: string, name: string, runId: string): Promise<RunStatus | null> {
  if (a.kind === 'demo') return demo.getRunStatus(name, runId);
  try {
    return await gh.getRunStatus(a.token, owner, name, runId);
  } catch (e) {
    if (e instanceof gh.GitHubError && e.status === 404) return null;
    throw e;
  }
}
