import { existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import { readJson } from '../core/paths.js';
import type { FrameworkInfo, StackInfo } from '../core/types.js';

interface PackageJson {
  name?: string;
  type?: string;
  packageManager?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

const FRAMEWORKS: [string, string][] = [
  ['next', 'Next.js'],
  ['@sveltejs/kit', 'SvelteKit'],
  ['@remix-run/react', 'Remix'],
  ['react-router', 'React Router'],
  ['react-router-dom', 'React Router'],
  ['nuxt', 'Nuxt'],
  ['astro', 'Astro'],
  ['vite', 'Vite'],
  ['react', 'React'],
  ['vue', 'Vue'],
  ['svelte', 'Svelte'],
  ['express', 'Express'],
  ['fastify', 'Fastify'],
  ['hono', 'Hono'],
  ['koa', 'Koa'],
  ['@nestjs/core', 'NestJS'],
];

const TEST_TOOLS: [string, string][] = [
  ['vitest', 'Vitest'],
  ['jest', 'Jest'],
  ['@playwright/test', 'Playwright'],
  ['cypress', 'Cypress'],
  ['mocha', 'Mocha'],
];

function major(range: string | undefined): string | null {
  const m = range?.match(/(\d+)(?:\.\d+)?/);
  return m ? m[1] : null;
}

export function readPackageJson(root: string): PackageJson | null {
  return readJson<PackageJson>(join(root, 'package.json'));
}

export function detectStack(root: string): StackInfo {
  const pkg = readPackageJson(root);
  const deps: Record<string, string> = { ...pkg?.dependencies, ...pkg?.devDependencies };

  let packageManager: StackInfo['packageManager'] = 'npm';
  const declared = pkg?.packageManager?.split('@')[0];
  if (declared === 'pnpm' || declared === 'yarn' || declared === 'bun' || declared === 'npm') packageManager = declared;
  else if (existsSync(join(root, 'pnpm-lock.yaml'))) packageManager = 'pnpm';
  else if (existsSync(join(root, 'yarn.lock'))) packageManager = 'yarn';
  else if (existsSync(join(root, 'bun.lockb')) || existsSync(join(root, 'bun.lock'))) packageManager = 'bun';

  const seen = new Set<string>();
  const frameworks: FrameworkInfo[] = [];
  for (const [id, label] of FRAMEWORKS) {
    if (deps[id] && !seen.has(label)) {
      seen.add(label);
      frameworks.push({ id, label, version: major(deps[id]) });
    }
  }

  const testTools = TEST_TOOLS.filter(([id]) => deps[id]).map(([, label]) => label);
  const language = existsSync(join(root, 'tsconfig.json')) || deps.typescript ? 'typescript' : 'javascript';

  return {
    name: pkg?.name ?? basename(root),
    language,
    packageManager,
    moduleType: pkg?.type === 'module' ? 'esm' : 'cjs',
    frameworks,
    testTools,
    scripts: pkg?.scripts ?? {},
    hasPackageJson: pkg !== null,
  };
}

export function hasFramework(stack: StackInfo, ...ids: string[]): boolean {
  return stack.frameworks.some((f) => ids.includes(f.id));
}
