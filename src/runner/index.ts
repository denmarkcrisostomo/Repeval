import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import { log } from '../core/log.js';
import { readJson, writeJson, type Paths } from '../core/paths.js';
import type { Analysis, GeneratedManifest, Plan, RunResults, SuiteRun, TestResult } from '../core/types.js';
import { slugForRoute } from '../adapters/playwright.js';
import { ensureBrowser, ensureProjectDeps, linkRunnerPackages, packageDir } from './deps.js';
import { exec } from './exec.js';
import { parsePlaywright, parseVitest, type PlaywrightJson, type VitestJson } from './parse.js';

export interface RunOptions {
  install: boolean;
  updateBaselines: boolean;
}

export async function runTests(a: Analysis, plan: Plan, manifest: GeneratedManifest, p: Paths, opts: RunOptions): Promise<RunResults> {
  const startedAt = new Date().toISOString();
  const suites: SuiteRun[] = [];
  const tests: TestResult[] = [];
  const baselines = { recorded: 0, matched: 0, changed: 0 };

  rmSync(p.out, { recursive: true, force: true });
  rmSync(p.results, { recursive: true, force: true });
  mkdirSync(p.out, { recursive: true });
  mkdirSync(p.results, { recursive: true });

  const hasUnit = manifest.files.some((f) => f.kind === 'unit');
  const hasE2E = manifest.files.some((f) => f.kind === 'e2e' || f.kind === 'api');

  if (hasUnit || hasE2E) {
    if (opts.install) {
      const deps = await ensureProjectDeps(p, a.stack);
      if (!deps.ok) log.warn(`Could not install dependencies. Tests may fail to load.\n${deps.message}`);
    }
    linkRunnerPackages(p);
  }

  /* ---------- Unit tests: Vitest ---------- */
  if (hasUnit) {
    log.info('Running unit tests with Vitest');
    const started = Date.now();
    const vitestBin = join(packageDir('vitest'), 'vitest.mjs');
    const res = await exec(process.execPath, [vitestBin, 'run', '--config', p.vitestConfig, '--root', p.root], {
      cwd: p.root,
      echo: true,
      env: {
        ...process.env,
        REPEVAL_BASELINES: p.baselines,
        REPEVAL_EVENTS: p.baselineEvents,
        REPEVAL_UPDATE: opts.updateBaselines ? '1' : '',
      },
    });
    const json = readJson<VitestJson>(join(p.results, 'unit.json'));
    if (!json) {
      suites.push({ kind: 'unit', framework: 'vitest', status: 'error', message: `Vitest did not produce results:\n${res.tail}`, durationMs: Date.now() - started });
    } else {
      const sourceOf = (testFile: string) => {
        const f = manifest.files.find((m) => resolve(p.root, m.path) === resolve(testFile));
        return f?.targets[0]?.replace(/^unit:/, '').replace(/#.*$/, '');
      };
      tests.push(...parseVitest(json, sourceOf));
      suites.push({ kind: 'unit', framework: 'vitest', status: 'ran', durationMs: Date.now() - started });
    }
    if (existsSync(p.baselineEvents)) {
      for (const line of readFileSync(p.baselineEvents, 'utf8').split('\n')) {
        if (!line) continue;
        const status = JSON.parse(line).status as keyof typeof baselines;
        if (status in baselines) baselines[status] += 1;
      }
    }
  }

  /* ---------- E2E + API: Playwright ---------- */
  if (hasE2E) {
    const started = Date.now();
    const browser = await ensureBrowser(p.root);
    if (!browser.ok) {
      suites.push({ kind: 'e2e', framework: 'playwright', status: 'error', message: browser.message, durationMs: 0 });
    } else {
      log.info(`Running E2E tests with Playwright (starting the app with "${a.boot.command}")`);
      const shots = join(p.out, 'shots');
      const jsonFile = join(p.results, 'e2e.json');
      const cli = join(packageDir('@playwright/test'), 'cli.js');
      const res = await exec(process.execPath, [cli, 'test', '--config', join(p.e2eDir, 'playwright.config.ts')], {
        cwd: p.root,
        echo: true,
        env: {
          ...process.env,
          REPEVAL_ROOT: p.root,
          REPEVAL_START: a.boot.command ?? '',
          REPEVAL_PORT: String(a.boot.port ?? 3000),
          REPEVAL_SHOTS: shots,
          REPEVAL_E2E_JSON: jsonFile,
          REPEVAL_PW_OUTPUT: join(p.results, 'playwright'),
          PORT: String(a.boot.port ?? 3000),
        },
      });
      const json = readJson<PlaywrightJson>(jsonFile);
      const parsed = json ? parsePlaywright(json) : [];
      if (!json || (parsed.length === 0 && json.errors?.length)) {
        const why = json?.errors?.map((e) => e.message).join('\n') ?? res.tail;
        const appFailed = /webServer|Timed out waiting|exited early/i.test(why);
        suites.push({
          kind: 'e2e',
          framework: 'playwright',
          status: 'error',
          message: appFailed ? `The app did not start with "${a.boot.command}".\n${why}` : why,
          durationMs: Date.now() - started,
        });
      } else {
        let n = 0;
        for (const t of parsed) {
          n += 1;
          const isPage = t.target?.startsWith('page:');
          const result: TestResult = {
            id: t.target ?? `e2e:${t.file}:${t.title}`,
            suite: isPage ? 'e2e' : 'api',
            title: t.title,
            target: t.target,
            file: t.file,
            status: t.status,
            message: t.message,
            durationMs: Math.round(t.durationMs),
            screenshots: [],
          };
          if (isPage) {
            const slug = slugForRoute(t.target!.slice('page:'.length));
            const dir = join(shots, slug);
            if (existsSync(dir)) result.screenshots = readdirSync(dir).sort().map((f) => `shots/${slug}/${f}`);
          }
          for (const att of t.attachments) {
            if (!att.path || !existsSync(att.path)) continue;
            const kind = att.name === 'trace' ? 'traces' : att.name === 'video' ? 'videos' : att.name === 'screenshot' ? 'failures' : null;
            if (!kind) continue;
            const name = `${n}-${basename(att.path, extname(att.path))}${extname(att.path)}`;
            mkdirSync(join(p.out, kind), { recursive: true });
            copyFileSync(att.path, join(p.out, kind, name));
            const relPath = `${kind}/${name}`;
            if (kind === 'traces') result.trace = relPath;
            else if (kind === 'videos') result.video = relPath;
            else result.screenshots.push(relPath);
          }
          tests.push(result);
        }
        suites.push({ kind: 'e2e', framework: 'playwright', status: 'ran', durationMs: Date.now() - started });
      }
    }
  }

  /* ---------- Load tests: not yet ---------- */
  if (plan.targets.some((t) => t.type === 'load')) {
    suites.push({ kind: 'load', framework: 'k6', status: 'skipped', message: 'k6 load tests arrive in a later release', durationMs: 0 });
  }

  /* ---------- Notes and skipped targets ---------- */
  const byTarget = new Map(plan.targets.map((t) => [t.id, t]));
  for (const t of tests) {
    const reason = t.target ? byTarget.get(t.target)?.reason : undefined;
    if (reason && t.title.endsWith('is exported as a function')) t.note = reason;
  }
  for (const t of plan.targets) {
    if (t.enabled) continue;
    tests.push({
      id: t.id,
      suite: t.type,
      title: t.label,
      target: t.id,
      status: 'skipped',
      note: t.reason,
      durationMs: 0,
      screenshots: [],
    });
  }

  const results: RunResults = { version: 1, startedAt, finishedAt: new Date().toISOString(), suites, tests, baselines };
  writeJson(join(p.results, 'results.json'), results);
  return results;
}
