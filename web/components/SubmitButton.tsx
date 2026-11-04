'use client';

import { useFormStatus } from 'react-dom';

/** A form's submit button that shows a spinner and a pending label while the server works. */
export function SubmitButton({
  children,
  pendingLabel,
  className = 'btn btn-primary',
}: {
  children: React.ReactNode;
  pendingLabel: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button className={className} type="submit" disabled={pending} aria-busy={pending}>
      {pending ? (
        <>
          <span className="spinner" aria-hidden="true" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}
