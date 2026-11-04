import type { Metadata } from 'next';
import { AppBar } from '@/components/AppBar';
import { RepoList } from '@/components/RepoList';
import { listRepos } from '@/lib/data';
import { GitHubError } from '@/lib/github';
import { requireAccess } from '@/lib/session';
import { APP_INSTALL_URL } from '@/lib/site';

export const metadata: Metadata = { title: 'Pick a repo' };

export default async function Repos() {
  const access = await requireAccess();
  let error: string | null = null;
  let repos: Awaited<ReturnType<typeof listRepos>> = [];
  try {
    repos = await listRepos(access);
  } catch (e) {
    error = e instanceof GitHubError && e.status === 401 ? 'Your GitHub sign-in has expired. Sign out and sign in again.' : 'GitHub did not answer. Try again in a moment.';
  }
  return (
    <>
      <AppBar access={access} tab="repos" />
      <main className="wrap app-main page-in">
        <h1 className="page-title">Pick a repo</h1>
        <p className="page-sub">These are the repos you allowed on GitHub. Repos with the workflow file can run right away.</p>
        {error ? (
          <p className="notice warn">{error}</p>
        ) : (
          <RepoList repos={repos} installUrl={access.kind === 'demo' ? null : APP_INSTALL_URL} now={Date.now()} />
        )}
        {access.kind === 'demo' && <p className="note-band">Example repos for the demo. demo-shop runs the real example from the Repeval repo.</p>}
      </main>
    </>
  );
}
