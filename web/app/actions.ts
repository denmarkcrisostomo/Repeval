'use server';

import { redirect } from 'next/navigation';
import { DEMO, signIn, signOut } from '@/auth';
import { getRepo, startRun } from '@/lib/data';
import { markWorkflowAdded } from '@/lib/demo';
import { GitHubError } from '@/lib/github';
import { isRepoName } from '@/lib/names';
import { requireAccess } from '@/lib/session';
import { TEST_CHOICES, type TestChoice } from '@/lib/types';

export async function signInAction() {
  await signIn(DEMO ? 'demo' : 'github', { redirectTo: '/repos' });
}

export async function signOutAction() {
  await signOut({ redirectTo: '/' });
}

const repoUrl = (owner: string, repo: string) => `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

/** Starts the workflow with the chosen tests, then opens the live board. */
export async function startRunAction(owner: string, name: string, form: FormData) {
  if (!isRepoName(owner) || !isRepoName(name)) redirect('/repos');
  const access = await requireAccess();
  const tests = String(form.get('tests') ?? 'all');
  if (!TEST_CHOICES.includes(tests as TestChoice)) redirect(`${repoUrl(owner, name)}?error=tests`);
  const repo = await getRepo(access, owner, name);
  if (!repo) redirect('/repos');
  if (!repo.hasWorkflow) redirect(repoUrl(owner, name));
  let runId: string;
  try {
    runId = await startRun(access, repo, tests as TestChoice);
  } catch (e) {
    const reason = e instanceof GitHubError && e.status === 403 ? 'denied' : 'start';
    redirect(`${repoUrl(owner, name)}?error=${reason}`);
  }
  redirect(`${repoUrl(owner, name)}/runs/${runId}`);
}

/** "Check again" after the user commits the workflow on GitHub: the page re-renders and looks it up. */
export async function checkWorkflowAction(owner: string, name: string) {
  if (!isRepoName(owner) || !isRepoName(name)) redirect('/repos');
  redirect(`${repoUrl(owner, name)}?checked=1`);
}

/** Demo only: stands in for committing the file on GitHub. */
export async function demoAddWorkflowAction(name: string) {
  const access = await requireAccess();
  if (access.kind !== 'demo' || !isRepoName(name)) redirect('/repos');
  await markWorkflowAdded(name);
  redirect(`${repoUrl(access.login, name)}?checked=1`);
}
