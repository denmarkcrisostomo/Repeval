import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AppBar } from '@/components/AppBar';
import { Report } from '@/components/Report';
import { getRepo, getRunStatus } from '@/lib/data';
import { isRepoName, isRunId } from '@/lib/names';
import { requireAccess } from '@/lib/session';

type Props = { params: Promise<{ owner: string; repo: string; runId: string }> };

export const metadata: Metadata = { title: 'Report' };

export default async function ReportPage({ params }: Props) {
  const { owner, repo, runId } = await params;
  if (!isRepoName(owner) || !isRepoName(repo) || !isRunId(runId)) notFound();
  const access = await requireAccess();
  const [status, info] = await Promise.all([getRunStatus(access, owner, repo, runId), getRepo(access, owner, repo)]);
  if (!status || !info) notFound();
  const save = { defaultBranch: info.defaultBranch, workflowOutdated: !!info.workflowOutdated, demo: access.kind === 'demo' };
  return (
    <>
      <AppBar access={access} repo={{ owner, name: repo }} tab="runs" />
      <main className="wrap app-main page-in">
        <Report owner={owner} repo={repo} run={status} save={save} />
      </main>
    </>
  );
}
