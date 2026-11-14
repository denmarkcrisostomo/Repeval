import type { SetupProblem } from '@/lib/setup-problem';

/** What kept the run from testing the pages, and how to fix it when that is known. */
export function SetupNotice({ problem, githubUrl }: { problem: SetupProblem; githubUrl?: string | null }) {
  const { command, reason, missingTool } = problem;
  return (
    <p className="setup-notice">
      <b>Your pages and API weren&apos;t tested.</b>{' '}
      {command ? (
        <>
          Your app didn&apos;t start with <code>{command}</code>: <code>{reason}</code>.
        </>
      ) : (
        <>The page tests could not run: {reason}.</>
      )}{' '}
      Your functions were still tested.{' '}
      {missingTool ? (
        <>
          Repeval 0.1.5 and later run {missingTool} through npx when the machine doesn&apos;t have it, so running again fixes it. With an older Repeval,
          add <code>{missingTool === 'bun' ? '- uses: oven-sh/setup-bun@v2' : '- run: corepack enable'}</code> after &quot;Set up Node&quot; in{' '}
          <code>repeval.yml</code>.
        </>
      ) : githubUrl ? (
        <>
          The{' '}
          <a href={githubUrl} target="_blank" rel="noopener noreferrer">
            run on GitHub
          </a>{' '}
          has the full log.
        </>
      ) : (
        <>The run on GitHub has the full log.</>
      )}
    </p>
  );
}
