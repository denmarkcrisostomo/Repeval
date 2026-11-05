'use client';

import { useEffect, useState } from 'react';
import { Icon } from './Sprite';

type Choice = 'system' | 'light' | 'dark';
const ORDER: Choice[] = ['system', 'light', 'dark'];
const NAME: Record<Choice, string> = { system: 'System', light: 'Light', dark: 'Dark' };
const ICON: Record<Choice, 'system' | 'sun' | 'moon'> = { system: 'system', light: 'sun', dark: 'moon' };
const KEY = 'repeval-theme';

/**
 * One button that cycles System (default) → Light → Dark. The icons are stacked and the
 * current one morphs into the next. The choice is a per-browser convenience kept in localStorage.
 */
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

  const next = ORDER[(ORDER.indexOf(choice) + 1) % ORDER.length];
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

  return (
    <button
      type="button"
      className="theme"
      data-v={choice}
      onClick={() => apply(next)}
      aria-label={`Theme: ${NAME[choice]}. Switch to ${NAME[next]}`}
      title={`Theme: ${NAME[choice]}`}
    >
      {ORDER.map((c) => (
        // Which icon shows comes from <html data-scheme>, set before first paint, so a saved
        // theme never animates in on load.
        <Icon key={c} name={ICON[c]} className={`t-${c}`} />
      ))}
    </button>
  );
}

/** Runs before first paint so a saved Light/Dark choice never flashes the wrong theme. */
export const THEME_SCRIPT = `try{var t=localStorage.getItem('${KEY}');if(t==='light'||t==='dark')document.documentElement.dataset.scheme=t}catch(e){}`;
