'use client';

import { unzipSync, zipSync } from 'fflate';

// The report arrives as the zip GitHub stores for the run. It is unzipped here, in the browser,
// and kept only in this tab's memory. Nothing is saved.

export type TestStatus = 'passed' | 'broken' | 'possible-bug' | 'skipped';

export interface ReportTest {
  id: string;
  suite: 'unit' | 'e2e' | 'api' | 'load';
  title: string;
  target?: string;
  file?: string;
  status: TestStatus;
  message?: string;
  durationMs: number;
  screenshots: string[];
  note?: string;
}

export interface ReportResults {
  meta: { repo: string; repeval: string; generatedAt: string; durationMs: number; ai: string; stack: string[]; startCommand?: string | null };
  summary: { passed: number; broken: number; 'possible-bug': number; skipped: number; total: number };
  suites: { kind: string; framework: string; status: 'ran' | 'skipped' | 'error'; message?: string; durationMs: number }[];
  tests: ReportTest[];
}

export interface LoadedReport {
  results: ReportResults;
  /** Object URL for an image in the report, or null if it isn't there. */
  image(path: string): string | null;
  /** Generated test files, path relative to the report's generated/ folder. */
  tests: { path: string; text: string }[];
  /** A zip of the generated tests, for "Download all tests". */
  testsZip(): Blob;
  screenshotCount: number;
}

const cache = new Map<string, Promise<LoadedReport>>();

export function loadReport(owner: string, repo: string, runId: string): Promise<LoadedReport> {
  const key = `${owner}/${repo}/${runId}`;
  let p = cache.get(key);
  if (!p) {
    p = fetchReport(`/api/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/runs/${encodeURIComponent(runId)}/report`);
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return p;
}

async function fetchReport(url: string): Promise<LoadedReport> {
  const res = await fetch(url, { cache: 'no-store' });
  if (res.status === 401) throw new Error('You were signed out. Sign in again to open the report.');
  if (res.status === 404) throw new Error('This run has no report. GitHub keeps reports for 7 days.');
  if (!res.ok) throw new Error('The report could not be downloaded from GitHub. Try again in a moment.');
  const files = unzipSync(new Uint8Array(await res.arrayBuffer()));
  // upload-artifact stores the folder's contents at the root; accept a wrapping folder too.
  const prefix = files['results.json'] ? '' : (Object.keys(files).find((k) => k.endsWith('/results.json'))?.replace(/results\.json$/, '') ?? null);
  if (prefix === null) throw new Error('The report is missing results.json.');
  const results = JSON.parse(new TextDecoder().decode(files[prefix + 'results.json'])) as ReportResults;
  const urls = new Map<string, string>();
  const decoder = new TextDecoder();
  const testFiles = Object.keys(files)
    .filter((k) => k.startsWith(prefix + 'generated/') && !k.endsWith('/'))
    .map((k) => ({ path: k.slice((prefix + 'generated/').length), text: decoder.decode(files[k]) }))
    .sort((a, b) => a.path.localeCompare(b.path));
  return {
    results,
    image(path) {
      const bytes = files[prefix + path];
      if (!bytes) return null;
      let u = urls.get(path);
      if (!u) {
        u = URL.createObjectURL(new Blob([bytes as BlobPart], { type: path.endsWith('.png') ? 'image/png' : 'image/jpeg' }));
        urls.set(path, u);
      }
      return u;
    },
    tests: testFiles,
    testsZip() {
      const out: Record<string, Uint8Array> = {};
      for (const t of testFiles) out['repeval-tests/' + t.path] = new TextEncoder().encode(t.text);
      return new Blob([zipSync(out) as BlobPart], { type: 'application/zip' });
    },
    screenshotCount: results.tests.reduce((n, t) => n + t.screenshots.filter((s) => s.startsWith('shots/')).length, 0),
  };
}

export const STATUS_LABEL: Record<TestStatus, string> = { passed: 'Passed', 'possible-bug': 'Possible bug', broken: 'Broken test', skipped: 'Skipped' };
export const STATUS_CLASS: Record<TestStatus, string> = { passed: 'ok', 'possible-bug': 'bug', broken: 'run', skipped: 'skip' };
