'use client';

import dynamic from 'next/dynamic';

/** The flow view, loaded the first time someone opens it so the board stays light. */
export const RunFlow = dynamic(() => import('./RunFlow'), {
  ssr: false,
  loading: () => (
    <div className="flow-wrap">
      <div className="flow">
        <p className="flow-loading">Loading the flow view…</p>
      </div>
    </div>
  ),
});
