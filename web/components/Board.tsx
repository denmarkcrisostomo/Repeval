'use client';

import { useEffect, useRef } from 'react';
import { BOARD_LABEL, STEPS } from '@/lib/steps';
import type { RunStep, StepState } from '@/lib/types';

const CH = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const WIDTHS = [11, 16, 7];
const pad = (s: string, n: number) => (s + ' '.repeat(n)).slice(0, n);

/** One group of split-flap cells. When its text changes, each cell flips through a few letters first. */
function Flaps({ text, width, delay, className }: { text: string; width: number; delay: number; className: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  useEffect(() => {
    const group = ref.current;
    if (!group) return;
    const target = pad(text, width);
    const cells = [...group.children] as HTMLElement[];
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timers: ReturnType<typeof setTimeout>[] = [];
    cells.forEach((cell, i) => {
      const ch = target[i] ?? ' ';
      if (cell.textContent === ch) return;
      if (reduce || first.current) {
        cell.textContent = ch;
        return;
      }
      let n = ch === ' ' ? 0 : 2 + Math.floor(Math.random() * 4);
      const tick = () => {
        cell.classList.remove('flip');
        void cell.offsetWidth;
        cell.classList.add('flip');
        cell.textContent = n > 0 ? CH[(Math.random() * CH.length) | 0] : ch;
        if (n-- > 0) timers.push(setTimeout(tick, 65));
      };
      timers.push(setTimeout(tick, delay + i * 18));
    });
    first.current = false;
    return () => timers.forEach(clearTimeout);
  }, [text, width, delay]);
  return (
    <div className={className} ref={ref}>
      {Array.from({ length: width }, (_, i) => (
        <span className="c" key={i}>
          {' '}
        </span>
      ))}
    </div>
  );
}

const ROW_CLASS: Record<StepState, string> = { waiting: 'waiting', running: 'running', passed: 'passed', failed: 'bug', skipped: 'waiting' };

/** The departures board: one row per workflow step, with its state flipping in as GitHub reports it. */
export function Board({ title, steps, done, animate = true }: { title: string; steps: RunStep[]; done: boolean; animate?: boolean }) {
  return (
    <div className="board" data-ui aria-label="Workflow steps">
      <div className="board-top">
        <span className="board-title">{title}</span>
        <span style={{ color: '#a9bbb8', fontSize: 13, fontWeight: 600 }}>Status</span>
      </div>
      <div className="rows">
        {STEPS.map((info, i) => {
          const s = steps.find((x) => x.key === info.key);
          const state: StepState = s?.state ?? (done ? 'skipped' : 'waiting');
          const detail =
            state === 'running' ? info.doing : (state === 'passed' || state === 'failed') && s?.seconds !== undefined ? `took ${s.seconds}s` : '';
          return (
            <div className={'row ' + ROW_CLASS[state]} key={info.key} aria-label={`${info.name}: ${BOARD_LABEL[state]}`}>
              <Flaps className="cells" text={info.name} width={WIDTHS[0]} delay={animate ? i * 40 : 0} />
              <Flaps className="cells dt" text={detail} width={WIDTHS[1]} delay={60} />
              <Flaps className="cells st" text={BOARD_LABEL[state]} width={WIDTHS[2]} delay={140} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
