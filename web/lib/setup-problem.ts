import type { ReportResults } from './report-client';

/**
 * Something that kept a run from testing part of the app, such as the app not starting: the page and API
 * tests then never ran. It is a setup problem, not a bug in the app, so the site shows it in amber, says
 * what happened in plain words and, when it can tell, how to fix it.
 */
export interface SetupProblem {
  /** "App didn't start" or "Page tests didn't run". */
  title: string;
  /** The command it tried, e.g. pnpm dev, when the app didn't start. */
  command: string | null;
  /** The reason in a few words, e.g. "pnpm: not found". */
  reason: string;
  /** A package manager that isn't installed on the machine, e.g. pnpm. */
  missingTool: string | null;
}

const TOOLS = ['pnpm', 'yarn', 'bun'];

export function setupProblem(results: ReportResults | null | undefined): SetupProblem | null {
  const suite = results?.suites.find((s) => (s.kind === 'e2e' || s.kind === 'api') && s.status === 'error');
  if (!suite) return null;
  const lines = (suite.message ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
  const started = lines[0]?.match(/^The app did not start with "(.*)"\.?$/);
  const command = started ? started[1] : null;
  // Repeval 0.1.5 and later keep what the app printed ("[WebServer] sh: 1: pnpm: not found"); older ones only
  // have the exit code, where 127 means the shell could not find the command.
  const said = lines.filter((l) => l.startsWith('[WebServer]')).map((l) => l.replace(/^\[WebServer\]\s*/, '').replace(/^(\/bin\/)?sh: \d+: /, ''));
  const notFound = said.find((l) => /: not found$|command not found/.test(l));
  let reason = notFound ?? said[said.length - 1] ?? '';
  const first = command?.split(/\s+/)[0] ?? '';
  // "npx --yes pnpm dev" is still pnpm's own start: the tool is the word after npx's flags.
  const tool = first === 'npx' ? (command!.split(/\s+/).find((w, i) => i > 0 && !w.startsWith('-')) ?? '') : first;
  if (!reason && lines.some((l) => /Exit code: 127/.test(l))) reason = TOOLS.includes(tool) ? `${tool}: not found` : 'command not found';
  if (!reason) reason = (lines[started ? 1 : 0] ?? 'see the run on GitHub').replace(/^Error:\s*/, '');
  const missing = reason.match(/^(pnpm|yarn|bun): not found$/);
  return {
    title: started ? "App didn't start" : "Page tests didn't run",
    command,
    reason,
    missingTool: missing ? missing[1] : null,
  };
}

/** One sentence on what happened, for the notes under the flow. */
export function setupProblemText(p: SetupProblem): string {
  const what = p.command ? `Repeval started your app with "${p.command}" to open its pages, but it stopped: ${p.reason}.` : `The page tests could not run: ${p.reason}.`;
  return `${what} So the pages and API endpoints were not tested. Your functions were.${p.missingTool ? ` ${fixFor(p.missingTool)}` : ''}`;
}

/** How to fix a missing package manager. */
export function fixFor(tool: string): string {
  const step = tool === 'bun' ? '"- uses: oven-sh/setup-bun@v2"' : '"- run: corepack enable"';
  return `Repeval 0.1.5 and later run ${tool} through npx when the machine doesn't have it. With an older Repeval, add ${step} after "Set up Node" in repeval.yml.`;
}
