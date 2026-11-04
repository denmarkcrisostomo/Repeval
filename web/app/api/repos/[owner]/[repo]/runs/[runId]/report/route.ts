import { DEMO_REPORT_URL } from '@/lib/demo';
import { fetchReportZip, GitHubError } from '@/lib/github';
import { isRepoName, isRunId } from '@/lib/names';
import { getAccess } from '@/lib/session';

type Ctx = { params: Promise<{ owner: string; repo: string; runId: string }> };

/**
 * Streams the run's report zip from GitHub straight to the browser, which unzips it.
 * The bytes pass through this function and are never written to disk or kept in a cache.
 */
export async function GET(req: Request, { params }: Ctx) {
  const { owner, repo, runId } = await params;
  if (!isRepoName(owner) || !isRepoName(repo) || !isRunId(runId)) return new Response('Not found', { status: 404 });
  const access = await getAccess();
  if (!access) return new Response('Signed out', { status: 401 });
  if (access.kind === 'demo') return Response.redirect(new URL(DEMO_REPORT_URL, req.url), 302);
  try {
    const upstream = await fetchReportZip(access.token, owner, repo, runId);
    if (!upstream) return new Response('This run has no report. Reports are kept for 7 days.', { status: 404 });
    return new Response(upstream.body, {
      headers: {
        'Content-Type': 'application/zip',
        'Cache-Control': 'private, no-store',
        ...(upstream.headers.get('content-length') ? { 'Content-Length': upstream.headers.get('content-length')! } : {}),
      },
    });
  } catch (e) {
    return new Response(e instanceof Error ? e.message : 'GitHub did not answer.', { status: e instanceof GitHubError && e.status === 401 ? 401 : 502 });
  }
}
