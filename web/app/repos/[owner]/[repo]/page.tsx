import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { checkWorkflowAction, demoAddWorkflowAction, startRunAction } from '@/app/actions';
import { AppBar } from '@/components/AppBar';
import { CopyButton } from '@/components/CopyButton';
import { Icon } from '@/components/Sprite';
import { SubmitButton } from '@/components/SubmitButton';
import { getRepo, listRuns } from '@/lib/data';
import { highlightYaml } from '@/lib/highlight';
import { isRepoName } from '@/lib/names';
import { requireAccess } from '@/lib/session';
import { ago } from '@/lib/time';
import type { RunSummary } from '@/lib/types';
import { editFileUrl, newFileUrl, WORKFLOW_PATH, WORKFLOW_YAML } from '@/lib/workflow';

type Props = { params: Promise<{ owner: string; repo: string }>; searchParams: Promise<{ error?: string; checked?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { repo } = await params;
  return { title: repo };
}

const ERRORS: Record<string, string> = {
  start: 'GitHub did not start the run. Check that Actions is turned on for this repo, then try again.',
  denied: 'GitHub refused to start the run. The Repeval app may not have access to this repo any more: allow it on GitHub, then try again.',
  tests: 'Pick which tests to run.',
};

function runLabel(r: RunSummary): { cls: string; text: string } {
  if (r.phase === 'queued') return { cls: 'run', text: 'Queued' };
  if (r.phase === 'running') return { cls: 'run', text: 'Running' };
  if (r.conclusion === 'success') return { cls: 'ok', text: 'Passed' };
  if (r.conclusion === 'failure') return { cls: 'bug', text: 'Found problems' };
  return { cls: 'skip', text: r.conclusion === 'cancelled' ? 'Cancelled' : 'Did not finish' };
}

export default async function RepoPage({ params, searchParams }: Props) {
  const { owner, repo: name } = await params;
  const { error, checked } = await searchParams;
  if (!isRepoName(owner) || !isRepoName(name)) notFound();
  const access = await requireAccess();
  const repo = await getRepo(access, owner, name);
  if (!repo) notFound();
  const base = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;

  if (!repo.hasWorkflow) {
    return (
      <>
        <AppBar access={access} repo={repo} tab="runs" />
        <main className="wrap app-main page-in">
          <h1 className="page-title">Add the workflow to {repo.name}</h1>
          <p className="page-sub">
            Repeval runs inside your repo&apos;s GitHub Actions, so the repo needs one small file. You add it yourself: Repeval can&apos;t write to your repo.
          </p>
          <div className="setup">
            <ol className="setup-steps">
              <li>
                <h3>Read the file</h3>
                <p>It&apos;s on the right. Every line is plain text, and it only runs when you press Run.</p>
              </li>
              <li>
                <h3>Commit it on GitHub</h3>
                <p>This opens GitHub&apos;s own &quot;new file&quot; page with the file filled in. Check it, then press Commit.</p>
                <div>
                  {access.kind === 'demo' ? (
                    <form action={demoAddWorkflowAction.bind(null, repo.name)}>
                      <SubmitButton className="btn btn-primary btn-small" pendingLabel="Adding">
                        <Icon name="gh" />
                        Add it (demo)
                      </SubmitButton>
                    </form>
                  ) : (
                    <a className="btn btn-primary btn-small" href={newFileUrl(repo.owner, repo.name, repo.defaultBranch)} target="_blank" rel="noopener noreferrer">
                      <Icon name="gh" />
                      Open GitHub to add it
                    </a>
                  )}
                </div>
              </li>
              <li>
                <h3>Come back and check</h3>
                <p>
                  Repeval looks for <code>{WORKFLOW_PATH}</code> in your repo.
                </p>
                <form action={checkWorkflowAction.bind(null, repo.owner, repo.name)}>
                  <SubmitButton className="btn btn-soft btn-small" pendingLabel="Checking">
                    Check again
                  </SubmitButton>
                </form>
                {checked && <p className="notice warn" style={{ marginTop: 0 }}>Not found yet. Commit the file on GitHub first, then check again.</p>}
              </li>
            </ol>
            <div className="yaml-wrap">
              <div className="code-actions">
                <p>{WORKFLOW_PATH}</p>
                <CopyButton text={WORKFLOW_YAML} label="Copy file" code={false} className="btn btn-soft btn-small" />
              </div>
              <pre className="codebox" data-ui dangerouslySetInnerHTML={{ __html: highlightYaml(WORKFLOW_YAML) }} />
            </div>
          </div>
        </main>
      </>
    );
  }

  const runs = await listRuns(access, owner, name);
  return (
    <>
      <AppBar access={access} repo={repo} tab="runs" />
      <main className="wrap app-main page-in">
        <h1 className="page-title">{repo.name}</h1>
        <p className="page-sub">
          Runs happen on GitHub Actions in this repo, on the {repo.defaultBranch} branch. Free for public repos; private repos use your plan&apos;s Actions minutes.
        </p>
        {checked && !repo.workflowOutdated && <p className="notice"><b>Found {WORKFLOW_PATH}.</b> This repo is ready to run.</p>}
        {repo.workflowOutdated && (
          <section className="panel update-panel" id="update">
            <h2>Update the workflow file</h2>
            <p>
              This repo has an older <code>{WORKFLOW_PATH}</code>. Runs still work, but the new version adds <b>Commit to a branch</b> for saving tests,
              and picks up Repeval bug fixes by itself from now on. Repeval can&apos;t edit your repo, so you paste it in yourself.
            </p>
            <ol className="update-steps">
              <li>
                <CopyButton text={WORKFLOW_YAML} label="Copy the new file" code={false} className="btn btn-soft btn-small" />
              </li>
              <li>
                {access.kind === 'demo' ? (
                  <form action={demoAddWorkflowAction.bind(null, repo.name)}>
                    <SubmitButton className="btn btn-primary btn-small" pendingLabel="Updating">
                      <Icon name="gh" />
                      Update it (demo)
                    </SubmitButton>
                  </form>
                ) : (
                  <a className="btn btn-primary btn-small" href={editFileUrl(repo.owner, repo.name, repo.defaultBranch)} target="_blank" rel="noopener noreferrer">
                    <Icon name="gh" />
                    Open it on GitHub
                  </a>
                )}
                <span>Select everything, paste, and commit.</span>
              </li>
              <li>
                <form action={checkWorkflowAction.bind(null, repo.owner, repo.name)}>
                  <SubmitButton className="btn btn-soft btn-small" pendingLabel="Checking">
                    Check again
                  </SubmitButton>
                </form>
                {checked && <span className="warn-text">Still the old version. Commit the new file on GitHub, then check again.</span>}
              </li>
            </ol>
          </section>
        )}
        {error && ERRORS[error] && <p className="notice warn">{ERRORS[error]}</p>}
        <div className="repo-page">
          <form className="panel" style={{ width: '100%' }} action={startRunAction.bind(null, repo.owner, repo.name)}>
            <h2 style={{ fontSize: 24 }}>Start a run</h2>
            <div className="options">
              <div className="opt">
                <h2 id="o-tests">Which tests</h2>
                <div className="seg" role="radiogroup" aria-labelledby="o-tests">
                  <input type="radio" name="tests" id="t-all" value="all" defaultChecked />
                  <label htmlFor="t-all">All</label>
                  <input type="radio" name="tests" id="t-unit" value="unit" />
                  <label htmlFor="t-unit">Unit</label>
                  <input type="radio" name="tests" id="t-e2e" value="e2e" />
                  <label htmlFor="t-e2e">Pages and API</label>
                  <input type="radio" name="tests" id="t-load" value="load" disabled />
                  <label htmlFor="t-load">
                    Load<small>soon</small>
                  </label>
                </div>
              </div>
              <div className="opt">
                <h2 id="o-ai">AI</h2>
                <div className="seg" role="radiogroup" aria-labelledby="o-ai">
                  <input type="radio" name="ai" id="a-none" value="none" defaultChecked />
                  <label htmlFor="a-none">Off</label>
                  <input type="radio" name="ai" id="a-anthropic" value="anthropic" disabled />
                  <label htmlFor="a-anthropic">
                    Anthropic<small>soon</small>
                  </label>
                  <input type="radio" name="ai" id="a-openai" value="openai" disabled />
                  <label htmlFor="a-openai">
                    OpenAI<small>soon</small>
                  </label>
                </div>
                <p>With AI off, Repeval uses proven templates: page checks, API checks and baseline tests.</p>
              </div>
            </div>
            <div className="actions">
              <SubmitButton pendingLabel="Starting on GitHub">Run tests</SubmitButton>
            </div>
          </form>
          <section>
            <h2>Recent runs</h2>
            {runs.length === 0 ? (
              <p className="empty" style={{ paddingTop: 12 }}>No runs yet. Start one and it shows up here.</p>
            ) : (
              <ul className="runs">
                {runs.map((r) => {
                  const l = runLabel(r);
                  return (
                    <li key={r.id}>
                      <Link className="run-row" href={`${base}/runs/${r.id}`}>
                        <span>
                          <b>Run on {r.branch}</b>
                          <br />
                          <span className="meta">
                            Started by {r.actor} {ago(r.createdAt)}
                          </span>
                        </span>
                        <span className={`status ${l.cls}`}>{l.text}</span>
                        <span className="meta">Open</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="note-band">Reports are kept in your repo for 7 days. Repeval keeps no copy.</p>
          </section>
        </div>
      </main>
    </>
  );
}
