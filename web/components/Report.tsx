'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { loadReport, STATUS_CLASS, STATUS_LABEL, type LoadedReport, type ReportTest } from '@/lib/report-client';
import { setupProblem } from '@/lib/setup-problem';
import type { RunStatus } from '@/lib/types';
import { clock } from '@/lib/time';
import { testsPullRequestUrl, TESTS_BRANCH } from '@/lib/workflow';
import { RunFlow } from './RunFlowLazy';
import { SetupNotice } from './SetupNotice';

const GROUPS: { suite: ReportTest['suite']; label: string }[] = [
  { suite: 'e2e', label: 'Pages' },
  { suite: 'api', label: 'API' },
  { suite: 'unit', label: 'Functions' },
  { suite: 'load', label: 'Load' },
];
const ORDER = { 'possible-bug': 0, broken: 1, passed: 2, skipped: 3 } as const;
type Tab = 'tests' | 'shots' | 'code' | 'steps';

function explain(t: ReportTest): string | null {
  if (t.status === 'possible-bug')
    return 'The test ran and your app did something wrong. The message below shows what the browser or server reported.';
  if (t.status === 'broken') return "The generated test itself couldn't run. This is Repeval's problem, not your app's: please report it.";
  if (t.status === 'skipped') return t.note ? `Skipped: ${t.note}.` : 'Skipped.';
  if (t.note) return `Passed. ${t.note.charAt(0).toUpperCase()}${t.note.slice(1)}.`;
  return null;
}

/** What the "Commit to a branch" button needs to know about the repo. */
export interface SaveTarget {
  defaultBranch: string;
  workflowOutdated: boolean;
  demo: boolean;
}

export function Report({ owner, repo, run, save }: { owner: string; repo: string; run: RunStatus; save: SaveTarget }) {
  const [report, setReport] = useState<LoadedReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('tests');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [file, setFile] = useState(0);
  const tabs = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState({ x: 0, w: 0 });
  // The app didn't start (or the page tests couldn't run): the pages and API weren't tested.
  const setup = setupProblem(report?.results);

  useEffect(() => {
    loadReport(owner, repo, run.id).then(
      (r) => {
        setReport(r);
        setOpen(new Set(r.results.tests.filter((t) => t.status === 'possible-bug' || t.status === 'broken').map((t) => t.id)));
      },
      (e: Error) => setError(e.message),
    );
  }, [owner, repo, run.id]);

  useLayoutEffect(() => {
    const b = tabs.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]');
    if (b) setPill({ x: b.offsetLeft - 4, w: b.offsetWidth });
  }, [tab, report]);

  const duration = run.startedAt ? (Date.parse(run.updatedAt) - Date.parse(run.startedAt)) / 1000 : null;
  const head = (
    <div className="report-head">
      <div>
        <h1 className="page-title">Report for {repo}</h1>
        <p className="page-sub" style={{ marginTop: 8 }}>
          Run on {run.branch}
          {duration !== null && ` · ${clock(duration)} on GitHub Actions`} · AI off. Streamed from your repo&apos;s run, available for 7 days. Repeval keeps no copy.
        </p>
      </div>
      {report && (
        <span className={'verdict' + (report.results.summary['possible-bug'] ? '' : setup ? ' warn' : ' ok')}>
          {report.results.summary['possible-bug']
            ? `${report.results.summary['possible-bug']} possible bug${report.results.summary['possible-bug'] === 1 ? '' : 's'} found`
            : setup
              ? 'Pages not tested'
              : 'No bugs found'}
        </span>
      )}
    </div>
  );

  if (error)
    return (
      <>
        {head}
        <p className="notice warn">{error}</p>
      </>
    );
  if (!report)
    return (
      <>
        {head}
        <p className="loading">Downloading the report from GitHub and opening it in your browser…</p>
      </>
    );

  const { summary, tests } = report.results;
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const pages = tests.filter((t) => t.suite === 'e2e' && t.screenshots.length);
  const select = (t: Tab) => setTab(t);
  const TABS: [Tab, string][] = [
    ['tests', 'Tests'],
    ['shots', 'Screenshots'],
    ['code', 'Tests to keep'],
    ['steps', 'Run flow'],
  ];

  return (
    <>
      {head}
      {setup && <SetupNotice problem={setup} githubUrl={run.htmlUrl} />}
      <div className="kpis">
        <div className="kpi ok"><b>{summary.passed}</b><span>{summary.passed === 1 ? 'test' : 'tests'} passed</span></div>
        <div className="kpi bug"><b>{summary['possible-bug']}</b><span>possible bug{summary['possible-bug'] === 1 ? '' : 's'}</span></div>
        <div className="kpi run"><b>{summary.broken}</b><span>broken tests</span></div>
        <div className="kpi"><b>{summary.skipped}</b><span>skipped</span></div>
        <div className="kpi"><b>{report.screenshotCount}</b><span>screenshots</span></div>
      </div>

      <div
        className="tabs"
        role="tablist"
        aria-label="Report sections"
        ref={tabs}
        onKeyDown={(e) => {
          if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
          const i = TABS.findIndex(([k]) => k === tab);
          const next = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length][0];
          select(next);
          tabs.current?.querySelector<HTMLButtonElement>(`[data-tab="${next}"]`)?.focus();
          e.preventDefault();
        }}
      >
        <span className="tab-pill" aria-hidden="true" style={{ width: pill.w, transform: `translateX(${pill.x}px)`, left: 4 }} />
        {TABS.map(([k, label]) => (
          <button key={k} type="button" role="tab" data-tab={k} aria-selected={tab === k} tabIndex={tab === k ? 0 : -1} onClick={() => select(k)}>
            {label}
          </button>
        ))}
      </div>

      <div className="tab-panels">
        {tab === 'tests' &&
          GROUPS.map(({ suite, label }) => {
            const list = tests.filter((t) => t.suite === suite).sort((a, b) => ORDER[a.status] - ORDER[b.status]);
            if (!list.length) return null;
            return (
              <div className="test-group" key={suite}>
                <h3>{label}</h3>
                <ul className="tests">
                  {list.map((t) => {
                    const text = explain(t);
                    const imgs = t.screenshots.map((s) => report.image(s)).filter((s): s is string => !!s);
                    const has = !!(text || t.message || imgs.length);
                    const isOpen = open.has(t.id);
                    return (
                      <li className="test" key={t.id} data-open={has && isOpen}>
                        <button className="test-row" type="button" disabled={!has} aria-expanded={has ? isOpen : undefined} onClick={() => toggle(t.id)}>
                          <span className={`status ${STATUS_CLASS[t.status]}`}>{STATUS_LABEL[t.status]}</span>
                          <span className="t-title">{t.title}</span>
                          <span className="t-time">{t.durationMs ? `${t.durationMs} ms` : ''}</span>
                        </button>
                        {has && (
                          <div className="test-body">
                            <div>
                              <div className="inner">
                                {text && <p className="explain">{text}</p>}
                                {t.message && <pre className="msg">{t.message}</pre>}
                                {imgs.length > 0 && (
                                  <div className="thumbs">
                                    {imgs.map((src, i) => (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img key={src} src={src} alt={`Screenshot ${i + 1} for ${t.title}`} loading="lazy" />
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}

        {tab === 'shots' && (
          <div className="gallery">
            {pages.length === 0 && <p className="empty">This run has no page screenshots.</p>}
            {pages.map((t) => {
              const desktop = report.image(t.screenshots.find((s) => s.includes('desktop')) ?? t.screenshots[0]);
              const mobile = report.image(t.screenshots.find((s) => s.includes('mobile')) ?? '');
              const route = t.target?.replace(/^page:/, '') ?? t.title;
              return (
                <section key={t.id}>
                  <h3>
                    {route}
                    <span className={`status ${STATUS_CLASS[t.status]}`}>{STATUS_LABEL[t.status]}</span>
                  </h3>
                  <div className="pair">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {desktop && <img src={desktop} alt={`${route} at desktop width`} loading="lazy" />}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {mobile && <img src={mobile} alt={`${route} at phone width`} loading="lazy" />}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {tab === 'code' && (
          <>
<KeepToolbar owner={owner} repo={repo} runId={run.id} report={report} target={save} />
            {report.tests.length > 0 ? (
              <div className="code-view">
                <div className="files" role="tablist" aria-label="Files">
                  {report.tests.map((f, i) => (
                    <button key={f.path} type="button" role="tab" aria-selected={file === i} onClick={() => setFile(i)}>
                      <small>{f.path.endsWith('.spec.ts') ? 'Playwright' : f.path.includes('.test.') ? 'Vitest' : 'Config'}</small>
                      {f.path}
                    </button>
                  ))}
                </div>
                <pre className="codebox" data-ui>
                  {report.tests[file]?.text}
                </pre>
              </div>
            ) : (
              <p className="empty">This run wrote no test files.</p>
            )}
          </>
        )}

        {tab === 'steps' && <RunFlow id="flow-report" steps={run.steps} done progress={null} report={report} reveal={false} />}
      </div>
    </>
  );
}

function DownloadTests({ report }: { report: LoadedReport }) {
  const [href, setHref] = useState<string | null>(null);
  useEffect(() => {
    const url = URL.createObjectURL(report.testsZip());
    setHref(url);
    return () => URL.revokeObjectURL(url);
  }, [report]);
  if (!href || !report.tests.length) return null;
  return (
    <a className="btn btn-primary btn-small" href={href} download="repeval-tests.zip">
      Download all tests
    </a>
  );
}

/* ---------- "Tests to keep" toolbar: download, or commit to a branch ---------- */

type SaveState =
  | { kind: 'idle' }
  | { kind: 'starting' }
  | { kind: 'running'; id: string }
  | { kind: 'done' }
  | { kind: 'error'; message: string; href?: string | null; outdated?: boolean };

function KeepToolbar({ owner, repo, runId, report, target }: { owner: string; repo: string; runId: string; report: LoadedReport; target: SaveTarget }) {
  const [state, setState] = useState<SaveState>({ kind: 'idle' });
  const api = `/api/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/runs`;
  const repoPage = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

  // Poll the save run until GitHub reports it done.
  useEffect(() => {
    if (state.kind !== 'running') return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const res = await fetch(`${api}/${encodeURIComponent(state.id)}`, { cache: 'no-store' });
        const body = await res.json();
        if (stop) return;
        if (!res.ok) return setState({ kind: 'error', message: body.error ?? 'GitHub did not answer.' });
        if (body.phase === 'done')
          return setState(
            body.conclusion === 'success' ? { kind: 'done' } : { kind: 'error', message: 'The save run on GitHub did not finish.', href: body.htmlUrl },
          );
      } catch {
        /* network blip: try again on the next tick */
      }
      if (!stop) timer = setTimeout(tick, 3000);
    };
    timer = setTimeout(tick, 2000);
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [state, api]);

  const start = async () => {
    setState({ kind: 'starting' });
    try {
      const res = await fetch(`${api}/${encodeURIComponent(runId)}/save`, { method: 'POST' });
      const body = await res.json();
      if (!res.ok) return setState({ kind: 'error', message: body.error ?? 'GitHub did not start the save.', outdated: body.outdated });
      setState({ kind: 'running', id: body.runId });
    } catch {
      setState({ kind: 'error', message: 'Could not reach the Repeval site. Check your connection and try again.' });
    }
  };

  const has = report.tests.length > 0;
  const busy = state.kind === 'starting' || state.kind === 'running';
  const outdated = target.workflowOutdated || (state.kind === 'error' && state.outdated);

  let status: ReactNode = null;
  if (!has) status = null;
  else if (outdated)
    status = (
      <p className="notice keep-status">
        To commit these tests from here, <a href={repoPage}>update the workflow file</a> first. It takes one paste on GitHub.
      </p>
    );
  else if (state.kind === 'idle')
    status = (
      <p className="keep-note keep-status">
        <b>Commit to a branch</b> pushes these files to a <code>{TESTS_BRANCH}</code> branch, using your repo&apos;s own GitHub Actions. Then you open a pull
        request and decide. Repeval itself still can&apos;t write to your repo.
      </p>
    );
  else if (busy) status = <p className="notice keep-status">Pushing the tests to the <code>{TESTS_BRANCH}</code> branch on GitHub. This takes about 20 seconds…</p>;
  else if (state.kind === 'done')
    status = target.demo ? (
      <p className="notice keep-status">
        <b>Demo:</b> on GitHub, the tests are now on the <code>{TESTS_BRANCH}</code> branch, and this button opens the pull request page.
      </p>
    ) : (
      <p className="notice keep-status">
        <b>Pushed to {TESTS_BRANCH}.</b> Open the pull request to review the files and merge them.
      </p>
    );
  else if (state.kind === 'error')
    status = (
      <p className="notice warn keep-status">
        {state.message}{' '}
        {state.href && (
          <a href={state.href} target="_blank" rel="noopener noreferrer">
            See it on GitHub
          </a>
        )}
      </p>
    );

  return (
    <>
      <div className="code-actions">
        <p>
          {report.tests.length} files written for {repo}. Copy them into your repo to keep testing on every change.
        </p>
        <DownloadTests report={report} />
        {has &&
          (state.kind === 'done' ? (
            <a
              className="btn btn-primary btn-small"
              href={target.demo ? undefined : testsPullRequestUrl(owner, repo, target.defaultBranch)}
              aria-disabled={target.demo || undefined}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open pull request
            </a>
          ) : (
            <button type="button" className="btn btn-soft btn-small" onClick={start} disabled={busy || !!outdated}>
              {state.kind === 'starting' ? 'Starting on GitHub…' : state.kind === 'running' ? 'Pushing…' : 'Commit to a branch'}
            </button>
          ))}
      </div>
      {status}
    </>
  );
}
