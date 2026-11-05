'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { Repo } from '@/lib/types';
import { ago } from '@/lib/time';
import { Icon } from './Sprite';

export function RepoList({ repos, installUrl, now }: { repos: Repo[]; installUrl: string | null; now: number }) {
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const list = repos.filter((r) => `${r.owner}/${r.name}`.toLowerCase().includes(query));
  return (
    <>
      <div className="toolbar">
        <label className="search">
          <span className="sr">Search repos</span>
          <Icon name="search" />
          <input type="search" placeholder="Search repos" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        {installUrl && (
          <a className="btn btn-soft btn-small" href={installUrl}>
            Allow more repos on GitHub
          </a>
        )}
      </div>
      <ul className="repo-list">
        {repos.length === 0 && (
          <li className="empty">
            No repos yet. Install the Repeval app on GitHub and choose the repos it can see{installUrl ? ': use the button above.' : '.'}
          </li>
        )}
        {repos.length > 0 && list.length === 0 && <li className="empty">No repo matches &quot;{q}&quot;. If it&apos;s missing, allow it on GitHub first.</li>}
        {list.map((r) => {
          const href = `/repos/${encodeURIComponent(r.owner)}/${encodeURIComponent(r.name)}`;
          return (
            <li className="repo-row" key={href}>
              <div>
                <h3>
                  {r.owner !== 'you' && <span style={{ color: 'var(--muted)', fontWeight: 500 }}>{r.owner} / </span>}
                  {r.name}
                </h3>
                <span className="meta">{r.private ? 'Private' : 'Public'}</span>
              </div>
              <span className="meta">Pushed {ago(r.pushedAt, now)}</span>
              <span>
                {r.hasWorkflow === true && !r.workflowOutdated && <span className="status ok">Ready to run</span>}
                {r.hasWorkflow === true && r.workflowOutdated && <span className="status run">Workflow out of date</span>}
                {r.hasWorkflow === false && <span className="status skip">Needs the workflow file</span>}
              </span>
              <Link className={'btn ' + (r.hasWorkflow === false ? 'btn-soft' : 'btn-primary')} href={href}>
                {r.hasWorkflow === false ? 'Set up' : r.hasWorkflow ? 'Run tests' : 'Open'}
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
