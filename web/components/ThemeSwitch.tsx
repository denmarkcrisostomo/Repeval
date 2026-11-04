'use client';

import { useEffect, useState } from 'react';
import { Icon } from './Sprite';

type Choice = 'system' | 'light' | 'dark';
const CHOICES: { v: Choice; label: string; title: string; icon: 'system' | 'sun' | 'moon' }[] = [
  { v: 'system', label: 'Use system theme', title: 'System', icon: 'system' },
  { v: 'light', label: 'Light theme', title: 'Light', icon: 'sun' },
  { v: 'dark', label: 'Dark theme', title: 'Dark', icon: 'moon' },
];
const KEY = 'repeval-theme';

/** System (default), Light or Dark. The choice is a per-browser convenience kept in localStorage. */
export function ThemeSwitch() {
  const [choice, setChoice] = useState<Choice>('system');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === 'light' || saved === 'dark') setChoice(saved);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const apply = (c: Choice) => {
    setChoice(c);
    const root = document.documentElement;
    if (c === 'system') delete root.dataset.scheme;
    else root.dataset.scheme = c;
    try {
      localStorage.setItem(KEY, c);
    } catch {
      /* storage unavailable */
    }
  };

  const index = CHOICES.findIndex((c) => c.v === choice);
  return (
    <div
      className="theme"
      role="radiogroup"
      aria-label="Theme"
      onKeyDown={(e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        const next = CHOICES[(index + (e.key === 'ArrowRight' ? 1 : CHOICES.length - 1)) % CHOICES.length];
        apply(next.v);
        (e.currentTarget.querySelector(`[data-v="${next.v}"]`) as HTMLButtonElement | null)?.focus();
        e.preventDefault();
      }}
    >
      <span className="pill-bg" aria-hidden="true" style={{ transform: `translateX(${index * 32}px)` }} />
      {CHOICES.map((c) => (
        <button
          key={c.v}
          type="button"
          role="radio"
          data-v={c.v}
          aria-checked={choice === c.v}
          tabIndex={choice === c.v ? 0 : -1}
          aria-label={c.label}
          title={c.title}
          onClick={() => apply(c.v)}
        >
          <Icon name={c.icon} />
        </button>
      ))}
    </div>
  );
}

/** Runs before first paint so a saved Light/Dark choice never flashes the wrong theme. */
export const THEME_SCRIPT = `try{var t=localStorage.getItem('${KEY}');if(t==='light'||t==='dark')document.documentElement.dataset.scheme=t}catch(e){}`;
