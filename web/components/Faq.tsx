'use client';

import { useState } from 'react';

const FAQ: [string, string][] = [
  ['Is it really free?', 'Yes. Repeval is open source under the MIT licence. On the website, runs use GitHub Actions in your own repo: free for public repos, and private repos use the minutes included with your GitHub plan.'],
  ['Do I need to know how to write tests?', 'No. Repeval writes the tests, runs them and explains every result in plain words. If you want to learn, the generated files are a good place to start: they are normal Vitest and Playwright tests.'],
  ['Do I need AI or an API key?', 'No. This version uses proven templates: it checks every page and API, and records a baseline of what your functions return. AI mode, with your own key or a local model, is coming later and stays optional.'],
  ['Which projects does it work with?', 'JavaScript and TypeScript projects, including Next.js, Vite, Express, NestJS, Fastify, Hono, SvelteKit, Remix and React Router. Other languages come later.'],
  ['Will it change my code?', "No. Generated tests go into a .repeval folder that git ignores, and the report goes into repeval-report. The website can't write to your repo at all."],
  ['My app needs a database or secrets to start. What happens?', "Repeval reads .env.example and tells you which values are missing. Unit tests still run; page tests need the app to start, so add those values as secrets in your repo's settings."],
];

export function Faq() {
  const [open, setOpen] = useState<Set<number>>(new Set());
  const toggle = (i: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  return (
    <div className="faq">
      {FAQ.map(([q, a], i) => (
        <div className="faq-item" data-open={open.has(i)} key={q}>
          <button type="button" aria-expanded={open.has(i)} aria-controls={`faq${i}`} onClick={() => toggle(i)}>
            <span>{q}</span>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <use href="#i-chev" />
            </svg>
          </button>
          <div className="faq-panel" id={`faq${i}`} role="region">
            <div>
              <p>{a}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
