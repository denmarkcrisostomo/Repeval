import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { log } from '../core/log.js';
import type { Paths } from '../core/paths.js';
import type { StackInfo } from '../core/types.js';
import { exec } from './exec.js';

/** Directory of an installed package, resolved from Repeval's own location. */
export function packageDir(name: string): string {
  const entry = fileURLToPath(import.meta.resolve(name));
  let dir = dirname(entry);
  while (dir !== dirname(dir)) {
    const pj = join(dir, 'package.json');
    if (existsSync(pj)) {
      try {
        if (JSON.parse(readFileSync(pj, 'utf8')).name === name) return dir;
      } catch {
        /* keep walking */
      }
    }
    dir = dirname(dir);
  }
  throw new Error(`Could not find the ${name} package`);
}

/**
 * Generated tests import `vitest` and `@playwright/test`, but the user's repo may not have them.
 * Link Repeval's own copies into .repeval/node_modules so imports resolve to the same instance the runner uses.
 */
export function linkRunnerPackages(p: Paths): void {
  for (const name of ['vitest', '@playwright/test']) {
    const target = packageDir(name);
    const link = join(p.nodeModules, name);
    mkdirSync(dirname(link), { recursive: true });
    rmSync(link, { recursive: true, force: true });
    symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir');
  }
}

function installCommand(root: string, pm: StackInfo['packageManager']): string {
  const has = (f: string) => existsSync(join(root, f));
  switch (pm) {
    case 'pnpm':
      return has('pnpm-lock.yaml') ? 'pnpm install --frozen-lockfile' : 'pnpm install';
    case 'yarn':
      return 'yarn install';
    case 'bun':
      return 'bun install';
    default:
      return has('package-lock.json') || has('npm-shrinkwrap.json') ? 'npm ci' : 'npm install';
  }
}

/**
 * GitHub's runners (and many machines) have npm but not pnpm, yarn or bun. A command that starts with one of
 * those runs through `npx --yes` when it isn't installed, so installing and starting the app both work.
 */
export async function withPackageManager(cmd: string, cwd: string): Promise<string> {
  const tool = cmd.trim().split(/\s+/)[0];
  if (!['pnpm', 'yarn', 'bun'].includes(tool)) return cmd;
  return (await exec(tool, ['--version'], { cwd })).code === 0 ? cmd : `npx --yes ${cmd}`;
}

/** Install the project's own dependencies if node_modules is missing (fresh CI checkout). */
export async function ensureProjectDeps(p: Paths, stack: StackInfo): Promise<{ ok: boolean; message?: string }> {
  if (!stack.hasPackageJson || existsSync(join(p.root, 'node_modules'))) return { ok: true };
  const pkg = JSON.parse(readFileSync(join(p.root, 'package.json'), 'utf8'));
  const depCount = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).length;
  if (depCount === 0) return { ok: true };
  const cmd = await withPackageManager(installCommand(p.root, stack.packageManager), p.root);
  log.info(`Installing project dependencies: ${cmd}`);
  // Under `npm publish --dry-run` (or any npm script run with --dry-run), npm passes
  // npm_config_dry_run to child processes, and the install would then do nothing.
  const env = { ...process.env };
  for (const k of Object.keys(env)) if (k.toLowerCase() === 'npm_config_dry_run') delete env[k];
  const res = await exec(cmd, [], { cwd: p.root, shell: true, echo: false, env });
  if (res.code !== 0) return { ok: false, message: `"${cmd}" failed:\n${res.tail}` };
  log.ok('Dependencies installed');
  return { ok: true };
}

/** Make sure Playwright's Chromium is available; install it if not. */
export async function ensureBrowser(cwd: string): Promise<{ ok: boolean; message?: string }> {
  const { chromium } = await import('@playwright/test');
  if (existsSync(chromium.executablePath())) return { ok: true };
  const cli = join(packageDir('@playwright/test'), 'cli.js');
  const args = [cli, 'install', 'chromium'];
  if (process.env.CI && process.platform === 'linux') args.push('--with-deps');
  log.info('Installing the Chromium browser for E2E tests (one time)');
  const res = await exec(process.execPath, args, { cwd, echo: false });
  return res.code === 0 ? { ok: true } : { ok: false, message: `Browser install failed:\n${res.tail}` };
}
