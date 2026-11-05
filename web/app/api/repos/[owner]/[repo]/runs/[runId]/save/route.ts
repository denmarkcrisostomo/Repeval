import { getRepo, startSave } from '@/lib/data';
import { GitHubError } from '@/lib/github';
import { isRepoName, isRunId } from '@/lib/names';
import { getAccess } from '@/lib/session';

type Ctx = { params: Promise<{ owner: string; repo: string; runId: string }> };

/**
 * "Commit to a branch": starts the workflow's save-tests job, which pushes this run's generated
 * tests to the repeval-tests branch with the repo's own token. Answers with the new run's id,
 * which the report page then polls like any other run.
 */
export async function POST(req: Request, { params }: Ctx) {
  const { owner, repo: name, runId } = await params;
  if (!isRepoName(owner) || !isRepoName(name) || !isRunId(runId)) return Response.json({ error: 'Not found' }, { status: 404 });
  // Only this site's own pages may start a save.
  const origin = req.headers.get('origin');
  if (!origin || origin !== new URL(req.url).origin) return Response.json({ error: 'Not allowed' }, { status: 403 });
  const access = await getAccess();
  if (!access) return Response.json({ error: 'Signed out. Sign in again, then try again.' }, { status: 401 });
  try {
    const repo = await getRepo(access, owner, name);
    if (!repo) return Response.json({ error: 'This repo was not found.' }, { status: 404 });
    if (!repo.hasWorkflow || repo.workflowOutdated)
      return Response.json({ error: 'Update the workflow file first, then try again.', outdated: true }, { status: 409 });
    const id = await startSave(access, repo, runId);
    return Response.json({ runId: id }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    const status = e instanceof GitHubError ? e.status : 500;
    const error =
      status === 401
        ? 'Your GitHub sign-in has expired. Sign out and sign in again.'
        : status === 403
          ? 'GitHub refused to start the save. The Repeval app may not have access to this repo any more.'
          : 'GitHub did not start the save. Try again in a moment.';
    return Response.json({ error }, { status: status === 401 ? 401 : 502 });
  }
}
