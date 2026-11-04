import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { packageFile, readJson, VERSION, writeJson, writeText, type Paths } from '../core/paths.js';
import type { ReportData, Stage, StageStatus } from '../core/report.js';
import type { Analysis, GeneratedManifest, Plan, RunResults, TestResult } from '../core/types.js';

function count(tests: TestResult[]) {
  const c = { passed: 0, broken: 0, 'possible-bug': 0, skipped: 0 };
  for (const t of tests) c[t.status] += 1;
  return c;
}

function testStageStatus(tests: TestResult[], suiteStatus?: string): StageStatus {
  if (suiteStatus === 'error') return 'fail';
  const ran = tests.filter((t) => t.status !== 'skipped');
  if (ran.length === 0) return 'skipped';
  if (ran.some((t) => t.status === 'possible-bug')) return 'fail';
  if (ran.some((t) => t.status === 'broken')) return 'warn';
  return 'done';
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export function buildReportData(a: Analysis, plan: Plan, manifest: GeneratedManifest, r: RunResults, p: Paths): ReportData {
  const suite = (k: string) => r.suites.find((s) => s.kind === k);
  const unitTests = r.tests.filter((t) => t.suite === 'unit');
  const e2eTests = r.tests.filter((t) => t.suite === 'e2e' || t.suite === 'api');
  const loadTests = r.tests.filter((t) => t.suite === 'load');
  const enabled = plan.targets.filter((t) => t.enabled).length;
  const callable = a.functions.filter((f) => f.callable).length;
  const aiOn = manifest.ai !== 'none';

  const stages: Stage[] = [
    {
      id: 'collect',
      label: 'Collect files',
      group: 'input',
      status: 'done',
      detail: plural(a.sourceFiles, 'source file'),
      info: [`${a.sourceFiles} source files scanned.`, `${a.testFiles.length} existing test files found.`, 'node_modules, build output and binaries are skipped.'],
    },
    {
      id: 'stack',
      label: 'Detect stack',
      group: 'understand',
      status: 'done',
      detail: a.stack.frameworks.map((f) => f.label).join(', ') || a.stack.language,
      info: [
        `Language: ${a.stack.language}`,
        `Package manager: ${a.stack.packageManager}`,
        `Frameworks: ${a.stack.frameworks.map((f) => `${f.label}${f.version ? ' ' + f.version : ''}`).join(', ') || 'none detected'}`,
        `Test tools already in the repo: ${a.stack.testTools.join(', ') || 'none'}`,
      ],
    },
    {
      id: 'code',
      label: 'Map the code',
      group: 'understand',
      status: 'done',
      detail: `${plural(a.functions.length, 'function')}, ${callable} with samples`,
      info: [
        `${a.functions.length} exported functions, ${a.classes.length} classes.`,
        `${callable} can be called with generated sample arguments.`,
        ...a.skippedFiles.slice(0, 8).map((s) => `Skipped ${s.file}: ${s.reason}`),
      ],
    },
    {
      id: 'routes',
      label: 'Find pages and APIs',
      group: 'understand',
      status: a.pages.length + a.endpoints.length ? 'done' : 'skipped',
      detail: `${plural(a.pages.length, 'page')}, ${plural(a.endpoints.length, 'endpoint')}`,
      info: [...a.pages.map((x) => `Page ${x.route} (${x.source})`), ...a.endpoints.map((e) => `${e.method} ${e.path} (${e.source})`)],
    },
    {
      id: 'boot',
      label: 'Start command',
      group: 'understand',
      status: a.boot.command ? 'done' : a.pages.length + a.endpoints.length ? 'warn' : 'skipped',
      detail: a.boot.command ? `${a.boot.command} :${a.boot.port}` : 'not found',
      info: [
        a.boot.command ? `Starts with "${a.boot.command}" on port ${a.boot.port}.` : 'No way to start the app was found, so E2E tests are skipped.',
        a.boot.note,
        ...a.boot.envVars.map((e) => `Env ${e.name}: ${e.present ? 'set' : 'missing'}`),
      ],
    },
    {
      id: 'plan',
      label: 'Test plan',
      group: 'plan',
      status: 'done',
      detail: `${enabled} of ${plan.targets.length} targets`,
      info: [`${enabled} targets will be tested, ${plan.targets.length - enabled} skipped (reasons are listed in the Tests tab).`],
    },
    {
      id: 'templates',
      label: 'Template writer',
      group: 'make',
      status: manifest.files.length ? 'done' : 'skipped',
      detail: plural(manifest.files.filter((f) => f.kind === 'unit' || f.kind === 'e2e' || f.kind === 'api').length, 'test file'),
      info: ['Writes smoke, API and baseline tests from proven templates. No AI involved.', ...manifest.files.map((f) => f.path)],
    },
    {
      id: 'ai',
      label: 'AI writer',
      group: 'make',
      status: 'off',
      detail: aiOn ? `${manifest.ai} requested, not in ${VERSION}` : 'off',
      info: [
        'Writes tests with real assertions, user flows and fixes broken tests (self-heal).',
        aiOn ? `You asked for "${manifest.ai}", but AI mode ships in a later release. Templates ran instead.` : 'Turn on with --ai once AI mode ships.',
      ],
    },
    {
      id: 'unit',
      label: 'Unit · Vitest',
      group: 'run',
      status: testStageStatus(unitTests, suite('unit')?.status),
      detail: suite('unit')?.status === 'error' ? 'did not run' : `${count(unitTests).passed} passed`,
      info: suite('unit')?.message ? [suite('unit')!.message!] : [`Baselines: ${r.baselines.recorded} recorded, ${r.baselines.matched} matched, ${r.baselines.changed} changed.`],
      counts: count(unitTests),
      tests: unitTests.map((t) => t.id),
    },
    {
      id: 'e2e',
      label: 'E2E · Playwright',
      group: 'run',
      status: testStageStatus(e2eTests, suite('e2e')?.status),
      detail: suite('e2e')?.status === 'error' ? 'did not run' : `${count(e2eTests).passed} passed`,
      info: suite('e2e')?.message ? [suite('e2e')!.message!] : ['Every page: loads, has content, no browser errors. Screenshots at desktop and mobile width.'],
      counts: count(e2eTests),
      tests: e2eTests.map((t) => t.id),
    },
    {
      id: 'load',
      label: 'Load · k6',
      group: 'run',
      status: 'skipped',
      detail: loadTests.length ? `${loadTests.length} planned` : 'nothing to test',
      info: ['k6 load tests arrive in a later release.'],
      counts: count(loadTests),
      tests: loadTests.map((t) => t.id),
    },
    {
      id: 'report',
      label: 'Report',
      group: 'results',
      status: 'done',
      detail: `${r.tests.filter((t) => t.screenshots.length).reduce((n, t) => n + t.screenshots.length, 0)} screenshots`,
      info: ['This page. Results are also in results.json, and the generated tests are in the generated/ folder.'],
    },
  ];

  const generated = manifest.files.map((f) => {
    let code = '';
    try {
      code = readFileSync(join(p.root, f.path), 'utf8');
    } catch {
      /* missing */
    }
    return { path: f.path, framework: f.framework, kind: f.kind, code };
  });

  const c = count(r.tests);
  return {
    meta: {
      repo: a.stack.name,
      repeval: VERSION,
      generatedAt: r.finishedAt,
      durationMs: Date.parse(r.finishedAt) - Date.parse(r.startedAt),
      ai: manifest.ai,
      stack: a.stack.frameworks.map((f) => f.label),
      startCommand: a.boot.command,
    },
    summary: { ...c, total: r.tests.length },
    baselines: r.baselines,
    stages,
    edges: [
      { from: 'collect', to: 'stack' },
      { from: 'collect', to: 'code' },
      { from: 'collect', to: 'routes' },
      { from: 'collect', to: 'boot' },
      { from: 'stack', to: 'plan' },
      { from: 'code', to: 'plan' },
      { from: 'routes', to: 'plan' },
      { from: 'boot', to: 'plan' },
      { from: 'plan', to: 'templates' },
      { from: 'plan', to: 'ai', kind: 'ai' },
      { from: 'templates', to: 'unit' },
      { from: 'templates', to: 'e2e' },
      { from: 'templates', to: 'load', kind: 'muted' },
      { from: 'ai', to: 'unit', kind: 'ai' },
      { from: 'unit', to: 'report' },
      { from: 'e2e', to: 'report' },
      { from: 'load', to: 'report', kind: 'muted' },
    ],
    tests: r.tests,
    suites: r.suites,
    generated,
  };
}

function loadAsset(name: string): string {
  const file = packageFile('dist', 'report-app', name);
  if (!existsSync(file)) throw new Error(`Report assets are missing (${file}). Run "npm run build" first.`);
  return readFileSync(file, 'utf8');
}

export function renderHtml(data: ReportData): string {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  const title = `${data.meta.repo} · Repeval report`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title.replace(/</g, '&lt;')}</title>
<style>${loadAsset('main.css')}</style>
</head>
<body>
<div id="root"></div>
<script>window.__REPEVAL__ = ${json};</script>
<script>${loadAsset('main.js').replace(/<\/script/gi, '<\\/script')}</script>
</body>
</html>
`;
}

/** Write index.html, results.json and a copy of the generated tests into the report folder. */
export function writeReport(a: Analysis, plan: Plan, manifest: GeneratedManifest, r: RunResults, p: Paths): ReportData {
  const data = buildReportData(a, plan, manifest, r, p);
  rmSync(join(p.out, 'generated'), { recursive: true, force: true });
  for (const g of data.generated) writeText(join(p.out, 'generated', g.path.replace(/^\.repeval\//, '')), g.code);
  writeJson(join(p.out, 'results.json'), { meta: data.meta, summary: data.summary, baselines: data.baselines, suites: data.suites, tests: data.tests });
  writeText(join(p.out, '.gitignore'), '*\n');
  writeText(join(p.out, 'index.html'), renderHtml(data));
  return data;
}

export function loadSaved(p: Paths) {
  return {
    analysis: readJson<Analysis>(p.analysis),
    plan: readJson<Plan>(p.plan),
    manifest: readJson<GeneratedManifest>(p.generated),
    results: readJson<RunResults>(join(p.results, 'results.json')),
  };
}
