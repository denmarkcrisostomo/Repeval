'use client';

import { useCallback, useEffect, useRef } from 'react';
import { TERMINAL } from './landing-content';

const SPIN = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const LINES = TERMINAL.split('\n');
const CMD = 'npx repeval run';

/** Types the command, then prints a real demo-shop run line by line, with a spinner while tests run. */
export function Terminal() {
  const pre = useRef<HTMLPreElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const play = useCallback(() => {
    const term = pre.current;
    if (!term) return;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      term.innerHTML = TERMINAL;
      return;
    }
    term.style.minHeight = term.offsetHeight + 'px'; // no layout jump while it types
    const at = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms));
    const shown: string[] = [];
    const render = (extra = '') => {
      term.innerHTML = shown.join('\n') + extra + '<span class="cursor" aria-hidden="true"></span>';
    };
    let t = 300;
    render('<span class="p">$</span> ');
    for (let i = 1; i <= CMD.length; i++) at((t += 55 + (i % 3) * 25), () => render('<span class="p">$</span> ' + CMD.slice(0, i)));
    at((t += 350), () => {
      shown.push(LINES[0]);
      render('\n');
    });
    LINES.slice(1).forEach((line) => {
      if (/Running (unit|E2E)/.test(line)) {
        const label = line.slice(0, line.indexOf('<span'));
        for (let k = 0; k < 12; k++) at((t += 80), () => render(label + '<span class="spin">' + SPIN[k % SPIN.length] + '</span>'));
        at((t += 80), () => {
          shown.push(line);
          render('\n');
        });
      } else {
        const pause = line.trim() === '' ? 120 : /class="y"/.test(line) ? 380 : 140;
        at((t += pause), () => {
          shown.push(line);
          render('\n');
        });
      }
    });
    at((t += 200), () => {
      term.innerHTML = TERMINAL + '\n<span class="p">$</span> <span class="cursor" aria-hidden="true"></span>';
    });
  }, []);

  useEffect(() => {
    const term = pre.current;
    if (!term || !('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          io.disconnect();
          play();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(term);
    const pending = timers.current;
    return () => {
      io.disconnect();
      pending.forEach(clearTimeout);
    };
  }, [play]);

  return (
    <div className="term-win" data-ui>
      <div className="term-bar">
        <span>Terminal · demo-shop</span>
        <button className="term-replay" type="button" onClick={play}>
          Replay
        </button>
      </div>
      <pre className="term" ref={pre} aria-label="Repeval running in a terminal" dangerouslySetInnerHTML={{ __html: TERMINAL }} />
    </div>
  );
}
