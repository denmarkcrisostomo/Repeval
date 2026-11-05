'use client';

import type { RunView } from '@/lib/run-view';

/** Board (the departures board) or Flow (the run as a diagram). */
export function ViewSwitch({ view, onChange }: { view: RunView; onChange: (v: RunView) => void }) {
  const views: [RunView, string][] = [
    ['board', 'Board'],
    ['flow', 'Flow'],
  ];
  return (
    <div className="view-switch" role="tablist" aria-label="How to show the run">
      {views.map(([v, label]) => (
        <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  );
}
