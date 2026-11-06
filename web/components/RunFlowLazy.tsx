'use client';

import dynamic from 'next/dynamic';

/** The flow view. React Flow measures boxes in the browser, so it renders there only, with a placeholder until it loads. */
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
