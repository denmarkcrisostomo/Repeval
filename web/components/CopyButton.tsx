'use client';

import { useRef, useState } from 'react';

/** Copies text and swaps its label to "Copied" for a moment. Falls back to selecting the text. */
export function CopyButton({ text, label, code = true, className = 'btn btn-code' }: { text: string; label?: string; code?: boolean; className?: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const idle = label ?? text;
  return (
    <button
      className={className + (copied ? ' copied' : '')}
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setFailed(false);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => setCopied(false), 1600);
        } catch {
          setFailed(true);
        }
      }}
      title={failed ? 'Copy is blocked here. Select the text and copy it instead.' : undefined}
    >
      <span className="copy-state">
        {code ? <code className="idle">{idle}</code> : <span className="idle">{idle}</span>}
        <span className="done">Copied</span>
      </span>
    </button>
  );
}
