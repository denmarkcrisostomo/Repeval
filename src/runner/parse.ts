import { stripAnsi } from './exec.js';
import type { TestResult, TestStatus } from '../core/types.js';

/* ---------- Vitest JSON (Jest-compatible) ---------- */

interface VitestAssertion {
  ancestorTitles: string[];
  title: string;
  fullName: string;
  status: 'passed' | 'failed' | 'skipped' | 'pending' | 'todo';
  failureMessages: string[];
  duration?: number | null;
}

interface VitestFile {
  name: string;
  status: 'passed' | 'failed';
  message?: string;
  assertionResults: VitestAssertion[];
}

export interface VitestJson {
  testResults: VitestFile[];
}

/** Errors that mean the generated test itself is wrong (or can't load), not that the code under test is buggy. */
const BROKEN_RE =
  /SyntaxError|Cannot find module|Failed to load url|Failed to resolve import|Does the file exist|is not defined|is not a function|is not exported|Transform failed|ERR_MODULE_NOT_FOUND|ERR_UNKNOWN_FILE_EXTENSION/i;

export function classifyUnitFailure(message: string): TestStatus {
  return BROKEN_RE.test(message) ? 'broken' : 'possible-bug';
}

function firstLines(s: string, n = 12): string {
  return stripAnsi(s).split('\n').slice(0, n).join('\n').trim();
}

/** sourceFile: map a generated test file back to the source file it covers. */
export function parseVitest(json: VitestJson, sourceOf: (testFile: string) => string | undefined): TestResult[] {
  const out: TestResult[] = [];
  for (const file of json.testResults) {
    const source = sourceOf(file.name);
    if (file.assertionResults.length === 0 && file.status === 'failed') {
      const message = firstLines(file.message ?? 'Test file failed to load');
      out.push({
        id: `unit:${source ?? file.name}#load`,
        suite: 'unit',
        title: `${source ?? file.name} loads`,
        file: source,
        status: classifyUnitFailure(message) === 'broken' ? 'broken' : 'possible-bug',
        message,
        durationMs: 0,
        screenshots: [],
      });
      continue;
    }
    for (const t of file.assertionResults) {
      const fnTitle = t.ancestorTitles[1];
      // Function describe titles are "name()" or "name() (default export)".
      const exportName = fnTitle?.endsWith('(default export)') ? 'default' : fnTitle?.replace(/\(\)$/, '');
      const target = source && exportName ? `unit:${source}#${exportName}` : undefined;
      const failed = t.status === 'failed';
      const message = failed ? firstLines(t.failureMessages.join('\n')) : undefined;
      let status: TestStatus = t.status === 'passed' ? 'passed' : failed ? classifyUnitFailure(message ?? '') : 'skipped';
      if (failed && t.title === 'is exported as a function') status = 'broken';
      out.push({
        id: `unit:${t.fullName}`,
        suite: 'unit',
        // File-level tests ("loads without errors") get the file name so they can be told apart.
        title: (t.ancestorTitles.length > 1 ? [...t.ancestorTitles.slice(1), t.title] : [source ?? t.ancestorTitles[0], t.title]).join(' › '),
        target,
        file: source,
        status,
        message,
        durationMs: Math.round(t.duration ?? 0),
        screenshots: [],
      });
    }
  }
  return out;
}

/* ---------- Playwright JSON ---------- */

interface PwAttachment {
  name: string;
  contentType: string;
  path?: string;
}
interface PwResult {
  status: 'passed' | 'failed' | 'timedOut' | 'skipped' | 'interrupted';
  duration: number;
  error?: { message?: string };
  errors?: { message?: string }[];
  attachments: PwAttachment[];
}
interface PwTest {
  annotations: { type: string; description?: string }[];
  results: PwResult[];
  status: string;
}
interface PwSpec {
  title: string;
  file: string;
  tests: PwTest[];
}
interface PwSuite {
  title: string;
  file?: string;
  specs?: PwSpec[];
  suites?: PwSuite[];
}
export interface PlaywrightJson {
  suites: PwSuite[];
  errors?: { message?: string }[];
}

export interface PwParsed {
  title: string;
  file: string;
  target?: string;
  status: TestStatus;
  message?: string;
  durationMs: number;
  attachments: PwAttachment[];
}

const ENV_BROKEN_RE = /ECONNREFUSED|net::ERR_CONNECTION|Executable doesn't exist|browserType\.launch/i;

export function parsePlaywright(json: PlaywrightJson): PwParsed[] {
  const out: PwParsed[] = [];
  const walk = (s: PwSuite) => {
    for (const spec of s.specs ?? []) {
      for (const t of spec.tests) {
        const r = t.results[t.results.length - 1];
        const target = t.annotations.find((a) => a.type === 'repeval-target')?.description;
        let status: TestStatus = 'skipped';
        let message: string | undefined;
        if (r?.status === 'passed') status = 'passed';
        else if (r && r.status !== 'skipped') {
          message = firstLines(r.error?.message ?? r.errors?.[0]?.message ?? r.status, 16);
          status = ENV_BROKEN_RE.test(message) ? 'broken' : 'possible-bug';
        }
        out.push({
          title: spec.title,
          file: spec.file,
          target,
          status,
          message,
          durationMs: r?.duration ?? 0,
          attachments: r?.attachments ?? [],
        });
      }
    }
    for (const child of s.suites ?? []) walk(child);
  };
  for (const s of json.suites) walk(s);
  return out;
}
