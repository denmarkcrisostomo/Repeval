'use client';

import { useEffect, useRef } from 'react';
import { mountHeroFlow } from '@/lib/hero-flow';

/**
 * The hero demo: the demo shop's run as one chain that grows while on screen. It is drawn as plain DOM by
 * lib/hero-flow.ts; React only renders the box it lives in. anime.js loads with it.
 */
export function HeroFlow({ audio }: { audio?: string }) {
  const film = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!film.current) return;
    return mountHeroFlow(film.current, () => import('animejs'), { audio });
  }, [audio]);
  return (
    <div className="demo-video hero-video">
      <div className="film" ref={film} />
      <p className="sr">
        A run of the demo shop: GitHub sets up a sandbox, then Repeval reads 2 source files, finds 5 pages and 3 API endpoints in them, plans 6 tests, writes 2 test files, runs them and
        finds a possible bug on /cart, then saves screenshots and a report.
      </p>
    </div>
  );
}
