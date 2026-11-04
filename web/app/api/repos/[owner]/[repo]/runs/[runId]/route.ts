import { getRunStatus } from '@/lib/data';
import { GitHubError } from '@/lib/github';
import { isRepoName, isRunId } from '@/lib/names';
import { getAccess } from '@/lib/session';

type Ctx = { params: Promise<{ owner: string; repo: string; runId: string }> };

/** Step-by-step status of one run, polled by the live board. */
export async function GET(_req: Request, { params }: Ctx) {
  const { owner, repo, runId } = await params;
  if (!isRepoName(owner) || !isRepoName(repo) || !isRunId(runId)) return Response.json({ error: 'Not found' }, { status: 404 });
  const access = await getAccess();
  if (!access) return Response.json({ error: 'Signed out. Sign in again to keep watching this run.' }, { status: 401 });
  try {
    const status = await getRunStatus(access, owner, repo, runId);
    if (!status) return Response.json({ error: 'This run was not found.' }, { status: 404 });
    return Response.json(status, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    const code = e instanceof GitHubError ? e.status : 500;
    return Response.json({ error: e instanceof Error ? e.message : 'GitHub did not answer.' }, { status: code === 401 ? 401 : 502 });
  }
}
