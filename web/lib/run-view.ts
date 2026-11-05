'use client';

import { useEffect, useState } from 'react';

// Board or Flow: how the run is shown. A per-browser convenience, shared by the live run and the report.
export type RunView = 'board' | 'flow';
const KEY = 'repeval-run-view';
const EVENT = 'repeval-run-view';

export function useRunView(): [RunView, (v: RunView) => void] {
  const [view, setView] = useState<RunView>('board');
  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) === 'flow') setView('flow');
    } catch {
      /* storage blocked: stay on the board */
    }
    const on = (e: Event) => setView((e as CustomEvent<RunView>).detail);
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  const set = (v: RunView) => {
    try {
      localStorage.setItem(KEY, v);
    } catch {
      /* storage blocked: the choice lasts for this page only */
    }
    window.dispatchEvent(new CustomEvent(EVENT, { detail: v }));
  };
  return [view, set];
}
