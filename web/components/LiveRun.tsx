'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { loadReport, type LoadedReport } from '@/lib/report-client';
import { useRunView } from '@/lib/run-view';
import { STEPS } from '@/lib/steps';
import type { Progress, RunStatus } from '@/lib/types';
import { clock } from '@/lib/time';
import { Board } from './Board';
import { RunFlow } from './RunFlowLazy';
import { ViewSwitch } from './ViewSwitch';

/** The live run screen: polls GitHub (through this site's API) and flips the board as steps finish. */
export function LiveRun({ owner, repo, initial, pollMs }: { owner: string; repo: string; initial: RunStatus; pollMs: number }) {
  const [run, setRun] = useState(initial);
  // Names-only progress from workflow v3: lets the flow grow its lanes while the run is still going.
  const [progress, setProgress] = useState<Progress | null>(initial.progress ?? null);
  const checked = useRef(initial.progressChecked ?? 0);
  // The run reached a share step but had nothing to share: its Repeval predates live progress.
  const [noProgress, setNoProgress] = useState(!!initial.progressChecked && !initial.progress);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const [report, setReport] = useState<LoadedReport | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const base = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const done = run.phase === 'done';
  const [view, setView] = useRunView();
  // Watched live: the flow's lanes grow out when the report arrives. Opened later: they're all there at once.
  const reveal = useRef(initial.phase !== 'done').current;

  // Poll until the run is done. Stops for good on sign-out or a missing run.
  useEffect(() => {
    if (done) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const before = checked.current;
        const res = await fetch(`/api${base}/runs/${encodeURIComponent(run.id)}?p=${before}`, { cache: 'no-store' });
        const body = await res.json();
        if (!res.ok) {
          setError(body.error ?? 'GitHub did not answer.');
          if (res.status === 401 || res.status === 404) return;
        } else {
          setError(null);
          const next = body as RunStatus;
          if (next.progressChecked) checked.current = Math.max(checked.current, next.progressChecked);
          if (next.progress) setProgress(next.progress);
          else if ((next.progressChecked ?? 0) > before) setNoProgress(true);
          setRun(next);
          if ((body as RunStatus).phase === 'done') return;
        }
      } catch {
        setError('Lost the connection. Trying again.');
      }
      if (!stop) timer = setTimeout(tick, pollMs);
    };
    timer = setTimeout(tick, pollMs);
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [base, run.id, done, pollMs]);

  // The clock ticks locally between polls.
  useEffect(() => {
    if (done) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [done]);

  // Once the run is done, fetch the report so its numbers and screenshots show here.
  useEffect(() => {
    if (!done || !run.hasReport) return;
    loadReport(owner, repo, run.id).then(setReport, (e: Error) => setReportError(e.message));
  }, [done, run.hasReport, owner, repo, run.id]);

  // Until the browser's clock takes over, use GitHub's last update time so server and browser render the same.
  const elapsed = run.startedAt ? ((done || now === null ? Date.parse(run.updatedAt) : now) - Date.parse(run.startedAt)) / 1000 : 0;
  const current = STEPS.find((s) => run.steps.find((x) => x.key === s.key)?.state === 'running');
  const finished = run.steps.filter((s) => s.state !== 'waiting' && s.state !== 'running').length;
  const summary = report?.results.summary;
  const bugs = summary?.['possible-bug'] ?? 0;
  const shots = useMemo(
    () => (report ? report.results.tests.filter((t) => t.suite === 'e2e' && t.screenshots[0]).map((t) => ({ t, src: report.image(t.screenshots[0]) })) : []),
    [report],
  );

  let pill = { cls: 'run', text: run.phase === 'queued' ? 'Queued' : 'Running' };
  if (done) {
    if (summary) pill = bugs ? { cls: 'bug', text: `Finished · ${bugs} possible bug${bugs === 1 ? '' : 's'}` } : { cls: 'ok', text: 'Finished · all passed' };
    else pill = run.conclusion === 'success' ? { cls: 'ok', text: 'Finished' } : { cls: 'bug', text: run.conclusion === 'cancelled' ? 'Cancelled' : 'Finished with problems' };
  }

  let nowStep = 'Waiting for a runner';
  let nowText = 'GitHub is finding a free machine for this run.';
  if (current) {
    nowStep = current.name;
    nowText = current.explain;
  } else if (done) {
    nowStep = 'Finished';
    if (summary)
      nowText = bugs
        ? `Every page was opened and checked. ${bugs} possible bug${bugs === 1 ? '' : 's'}: open the report to see ${bugs === 1 ? 'it' : 'them'} explained.`
        : `Every page was opened and checked. ${summary.passed} tests passed.`;
    else if (!run.hasReport) nowText = 'The run ended without a report. The run on GitHub shows what happened.';
    else nowText = 'Loading the report from GitHub.';
  } else if (run.phase === 'running' && finished > 0) {
    // Between two of the board's steps, e.g. while the workflow shares its progress.
    const last = [...STEPS].reverse().find((s) => run.steps.find((x) => x.key === s.key)?.state === 'passed');
    nowStep = last ? `${last.name} done` : 'Between steps';
    nowText = 'Saving what this step found and starting the next one.';
  } else if (run.phase === 'running') {
    nowStep = 'Starting';
    nowText = 'The machine is ready and the first step is starting.';
  }

  return (
    <>
      <div className="live-head">
        <div>
          <h1 className="page-title">Run on {run.branch}</h1>
          <div className="live-meta">
            <span>Started by {run.actor}</span>
            <span>AI off</span>
            <span className={`status ${pill.cls}`}>{pill.text}</span>
            {run.htmlUrl && (
              <a href={run.htmlUrl} target="_blank" rel="noopener noreferrer">
                View on GitHub
              </a>
            )}
          </div>
        </div>
        <div className="clock">
          <b>{clock(Math.max(0, elapsed))}</b>
          <span>on GitHub Actions</span>
        </div>
      </div>
      {error && <p className="notice warn">{error}</p>}
      <div className={'live-grid' + (view === 'flow' ? ' flow-mode' : '')}>
        <section>
          <ViewSwitch view={view} onChange={setView} />
          {view === 'flow' && noProgress && !progress && !report && (
            <p className="notice flow-hint">
              This run&apos;s Repeval doesn&apos;t share its progress, so each page, endpoint and function appears when the report is ready. Live boxes
              need Repeval 0.1.4 or later and workflow v3.
            </p>
          )}
          {view === 'flow' ? (
            <RunFlow id="flow-live" steps={run.steps} done={done} progress={progress} report={report} reveal={reveal} />
          ) : (
            <Board title={`${owner} / ${repo}`} steps={run.steps} done={done} />
          )}
          <div className={'result-bar' + (done ? ' show' : '')} aria-live="polite">
            {summary ? (
              <>
                <div className="num ok"><b>{summary.passed}</b><span>passed</span></div>
                <div className="num bug"><b>{bugs}</b><span>possible bug{bugs === 1 ? '' : 's'}</span></div>
                <div className="num"><b>{summary.skipped}</b><span>skipped</span></div>
                <div className="num"><b>{report?.screenshotCount ?? 0}</b><span>screenshots</span></div>
                <Link className="btn btn-primary" href={`${base}/runs/${run.id}/report`}>
                  Open the report
                </Link>
              </>
            ) : reportError ? (
              <span>{reportError}</span>
            ) : run.hasReport ? (
              <span className="loading" style={{ padding: 0 }}>Loading the report…</span>
            ) : (
              <span>No report was saved for this run.{run.htmlUrl && ' Open it on GitHub to see the log.'}</span>
            )}
          </div>
          <div className="card" style={{ marginTop: 18 }}>
            <h2>Screenshots</h2>
            <div className="shots">
              {shots.length === 0 && (
                <p className="empty" style={{ gridColumn: '1/-1', padding: '8px 0' }}>
                  {done ? 'No page screenshots in this run.' : 'Screenshots appear here when the run finishes and its report is saved.'}
                </p>
              )}
              {shots.map(({ t, src }) => (
                <figure className="shot in" key={t.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {src && <img src={src} alt={`Screenshot of ${t.target?.replace(/^page:/, '') ?? t.title}`} />}
                  <figcaption>
                    <span>{t.target?.replace(/^page:/, '') ?? t.title}</span>
                    <span className={`status ${t.status === 'passed' ? 'ok' : 'bug'}`}>{t.status === 'passed' ? 'passed' : 'possible bug'}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
        <aside className="side">
          <div className="card" aria-live="polite">
            <h2>What&apos;s happening</h2>
            <div className="now-step">{nowStep}</div>
            <p className="now-text">{nowText}</p>
            <div className="progress">
              <i style={{ transform: `scaleX(${done ? 1 : finished / STEPS.length})`, background: done && bugs ? 'var(--bug)' : undefined, transition: 'transform 400ms var(--ease-smooth)' }} />
            </div>
          </div>
          <div className="card">
            <h2>The six stages</h2>
            <ol className="stage-list">
              {['Collect', 'Understand', 'Plan', 'Make tests', 'Run', 'Results'].map((stage) => {
                const inStage = STEPS.filter((s) => s.stage === stage).map((s) => run.steps.find((x) => x.key === s.key)?.state ?? 'waiting');
                const state = inStage.includes('failed') ? 'bug' : inStage.every((s) => s === 'passed') ? 'ok' : inStage.includes('running') || inStage.includes('passed') ? 'run' : 'skip';
                return (
                  <li key={stage}>
                    <span className={`dot ${state}`} aria-hidden="true" />
                    {stage}
                  </li>
                );
              })}
            </ol>
          </div>
        </aside>
      </div>
    </>
  );
}
