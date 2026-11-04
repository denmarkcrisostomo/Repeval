import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AppBar } from '@/components/AppBar';
import { LiveRun } from '@/components/LiveRun';
import { getRunStatus } from '@/lib/data';
import { isRepoName, isRunId } from '@/lib/names';
import { requireAccess } from '@/lib/session';

type Props = { params: Promise<{ owner: string; repo: string; runId: string }> };

export const metadata: Metadata = { title: 'Live run' };

export default async function RunPage({ params }: Props) {
  const { owner, repo, runId } = await params;
  if (!isRepoName(owner) || !isRepoName(repo) || !isRunId(runId)) notFound();
  const access = await requireAccess();
  const status = await getRunStatus(access, owner, repo, runId);
  if (!status) notFound();
  return (
    <>
      <AppBar access={access} repo={{ owner, name: repo }} tab="runs" />
      <main className="wrap app-main page-in">
        <LiveRun owner={owner} repo={repo} initial={status} pollMs={access.kind === 'demo' ? 1000 : 3000} />
      </main>
    </>
  );
}
