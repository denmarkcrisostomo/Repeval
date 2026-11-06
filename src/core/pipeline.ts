import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import pc from 'picocolors';
import { analyze } from '../analyzer/index.js';
import { generateTests } from '../adapters/index.js';
import { buildPlan, reviewPlan } from '../planner/index.js';
import { writeReport } from '../reporter/index.js';
import { captureSummaryCard } from '../reporter/card.js';
import { runTests } from '../runner/index.js';
import { log } from './log.js';
import { progressAnalyzed, progressGenerated, progressPlanned } from './progress.js';
import { ensureWorkDir, getPaths, packageFile, readJson, writeJson, writeText, type Paths } from './paths.js';
import { PlanSchema, type Analysis, type GeneratedManifest, type Plan, type RunResults, type TestsFilter } from './types.js';

export interface CommonOptions {
  out?: string;
}

function paths(root: string, opts: CommonOptions): Paths {
  const p = getPaths(root, opts.out);
  if (!existsSync(p.root)) throw new Error(`Folder not found: ${p.root}`);
  ensureWorkDir(p);
  return p;
}

/* ---------- ① + ② Analyze ---------- */

export function doAnalyze(root: string, opts: CommonOptions = {}): Analysis {
  const p = paths(root, opts);
  log.step(1, 'Collect files');
  const a = analyze(p.root);
  log.item('Scanned', `${a.sourceFiles} source files, ${a.testFiles.length} existing tests`);
  log.step(2, 'Understand the repo');
  log.item('Stack', [a.stack.language, ...a.stack.frameworks.map((f) => f.label)].join(', '));
  log.item('Functions', `${a.functions.length} exported, ${a.functions.filter((f) => f.callable).length} callable with samples`);
  log.item('Pages', a.pages.map((x) => x.route).join('  ') || 'none');
  log.item('Endpoints', a.endpoints.map((e) => `${e.method} ${e.path}`).join('  ') || 'none');
  log.item('Start', a.boot.command ? `${a.boot.command}  (port ${a.boot.port})` : pc.yellow('not found'));
  const missing = a.boot.envVars.filter((e) => !e.present).map((e) => e.name);
  if (missing.length) log.warn(`Env vars from .env.example that are not set: ${missing.join(', ')}`);
  writeJson(p.analysis, a);
  progressAnalyzed(a, p);
  return a;
}

function loadAnalysis(p: Paths, opts: CommonOptions): Analysis {
  return readJson<Analysis>(p.analysis) ?? doAnalyze(p.root, opts);
}

/* ---------- ③ Plan ---------- */

export interface PlanOptions extends CommonOptions {
  tests?: TestsFilter;
  interactive?: boolean;
}

export async function doPlan(root: string, opts: PlanOptions = {}): Promise<Plan> {
  const p = paths(root, opts);
  const a = loadAnalysis(p, opts);
  log.step(3, 'Plan');
  let plan = buildPlan(a, opts.tests ?? 'all');
  if (opts.interactive) {
    if (process.stdin.isTTY) plan = await reviewPlan(plan);
    else log.warn('--interactive needs a terminal, using the plan as is');
  }
  const on = plan.targets.filter((t) => t.enabled);
  const by = (type: string) => on.filter((t) => t.type === type).length;
  log.item('Targets', `${on.length} of ${plan.targets.length}: ${by('unit')} unit, ${by('e2e')} pages, ${by('api')} API`);
  const skipped = plan.targets.length - on.length;
  if (skipped) log.dim(`${skipped} skipped. Reasons are in .repeval/repeval-plan.json and in the report.`);
  writeJson(p.plan, plan);
  progressPlanned(plan);
  return plan;
}

function loadPlan(p: Paths, opts: CommonOptions): Promise<Plan> | Plan {
  const raw = readJson<unknown>(p.plan);
  if (!raw) return doPlan(p.root, opts);
  const parsed = PlanSchema.safeParse(raw);
  if (!parsed.success) throw new Error(`${p.plan} is not a valid plan: ${parsed.error.issues[0]?.message}`);
  return parsed.data;
}

/* ---------- ④ Generate ---------- */

export interface GenerateOptions extends CommonOptions {
  ai?: string;
}

export async function doGenerate(root: string, opts: GenerateOptions = {}): Promise<GeneratedManifest> {
  const p = paths(root, opts);
  const a = loadAnalysis(p, opts);
  const plan = await loadPlan(p, opts);
  log.step(4, 'Make tests');
  const ai = (opts.ai ?? 'none').trim() || 'none';
  if (ai !== 'none') log.warn(`AI mode ("${ai}") is not available in this version yet. Using the template writer.`);
  const manifest = generateTests(a, plan, p, ai);
  const tests = manifest.files.filter((f) => f.kind === 'unit' || f.kind === 'e2e' || f.kind === 'api');
  log.item('Wrote', `${tests.length} test files in .repeval/`);
  for (const f of tests) log.dim(`${f.framework.padEnd(10)} ${f.path}`);
  progressGenerated(manifest);
  return manifest;
}

/* ---------- ⑤ + ⑥ Test and report ---------- */

export interface TestOptions extends CommonOptions {
  install?: boolean;
  updateBaselines?: boolean;
  failOn?: 'possible-bug' | 'broken' | 'never';
  card?: boolean;
}

export async function doTest(root: string, opts: TestOptions = {}): Promise<{ results: RunResults; exitCode: number }> {
  const p = paths(root, opts);
  const a = loadAnalysis(p, opts);
  const plan = await loadPlan(p, opts);
  const manifest = readJson<GeneratedManifest>(p.generated) ?? (await doGenerate(p.root, opts));

  log.step(5, 'Run');
  const results = await runTests(a, plan, manifest, p, {
    install: opts.install ?? true,
    updateBaselines: opts.updateBaselines ?? false,
  });

  log.step(6, 'Results');
  const data = writeReport(a, plan, manifest, results, p);
  if (opts.card !== false) await captureSummaryCard(p).catch(() => undefined);
  const s = data.summary;
  log.info(
    `${pc.green(`${s.passed} passed`)}  ${pc.red(`${s['possible-bug']} possible bug${s['possible-bug'] === 1 ? '' : 's'}`)}  ${pc.yellow(`${s.broken} broken test${s.broken === 1 ? '' : 's'}`)}  ${pc.dim(`${s.skipped} skipped`)}`,
  );
  for (const suite of results.suites.filter((x) => x.status === 'error')) {
    const [first, ...rest] = (suite.message ?? '').split('\n');
    log.error(`${suite.framework}: ${first}`);
    // Show the end of the tool's output too, so the cause is visible without opening the report.
    for (const line of rest.filter((l) => l.trim()).slice(-12)) log.dim(line);
  }
  for (const t of results.tests.filter((x) => x.status === 'possible-bug').slice(0, 10))
    log.info(`${pc.red('✖')} ${t.title}${t.message ? pc.dim(` · ${t.message.split('\n')[0].slice(0, 110)}`) : ''}`);
  const b = results.baselines;
  if (b.recorded + b.matched + b.changed) log.dim(`Baselines: ${b.recorded} recorded, ${b.matched} matched, ${b.changed} changed`);
  log.info(`Report: ${pc.underline(join(p.out, 'index.html'))}`);

  const failOn = opts.failOn ?? 'possible-bug';
  const suiteError = results.suites.some((x) => x.status === 'error');
  const exitCode =
    failOn === 'never' ? 0 : s['possible-bug'] > 0 || suiteError ? 1 : failOn === 'broken' && s.broken > 0 ? 1 : 0;
  return { results, exitCode };
}

export async function doRun(root: string, opts: PlanOptions & GenerateOptions & TestOptions = {}) {
  doAnalyze(root, opts);
  await doPlan(root, opts);
  await doGenerate(root, opts);
  return doTest(root, opts);
}

/** Rebuild the HTML report from the last saved results. */
export function doReport(root: string, opts: CommonOptions = {}): string {
  const p = paths(root, opts);
  const a = readJson<Analysis>(p.analysis);
  const plan = readJson<Plan>(p.plan);
  const manifest = readJson<GeneratedManifest>(p.generated);
  const results = readJson<RunResults>(join(p.results, 'results.json'));
  if (!a || !plan || !manifest || !results) throw new Error('No saved run found. Run "repeval run" first.');
  writeReport(a, plan, manifest, results, p);
  return join(p.out, 'index.html');
}

/* ---------- init: add the GitHub Actions workflow ---------- */

export function doInit(root: string, opts: { force?: boolean } = {}): string {
  const target = join(root, '.github', 'workflows', 'repeval.yml');
  if (existsSync(target) && !opts.force) throw new Error(`${target} already exists. Use --force to overwrite it.`);
  writeText(target, readFileSync(packageFile('templates', 'repeval.yml'), 'utf8'));
  return target;
}
