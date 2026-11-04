/**
 * End-to-end tests of the built CLI (run `npm run build` first).
 * Each test copies an example into a temp folder so the examples stay clean.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const CLI = join(__dirname, '..', 'dist', 'cli.js');
const ex = (name: string) => join(__dirname, '..', 'examples', name);

function copyExample(name: string): string {
  const dir = mkdtempSync(join(tmpdir(), `repeval-${name}-`));
  cpSync(ex(name), dir, { recursive: true, filter: (src) => !/[\\/](\.repeval|repeval-report)([\\/]|$)/.test(src) });
  return dir;
}

function repeval(args: string[], cwd: string) {
  const r = spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8', env: { ...process.env, CI: '' } });
  return { code: r.status, out: r.stdout + r.stderr };
}

const results = (dir: string) => JSON.parse(readFileSync(join(dir, 'repeval-report', 'results.json'), 'utf8'));

beforeAll(() => {
  if (!existsSync(CLI)) execFileSync('npm', ['run', 'build'], { cwd: join(__dirname, '..'), stdio: 'inherit' });
});

describe('repeval CLI on ts-lib', () => {
  it('records baselines, then flags a changed function as a possible bug', () => {
    const dir = copyExample('ts-lib');

    const first = repeval(['run', '.'], dir);
    expect(first.code, first.out).toBe(0);
    expect(results(dir).summary).toMatchObject({ passed: 22, 'possible-bug': 0, broken: 0 });
    expect(results(dir).baselines).toEqual({ recorded: 8, matched: 0, changed: 0 });
    expect(existsSync(join(dir, 'repeval-report', 'index.html'))).toBe(true);
    expect(existsSync(join(dir, 'repeval-report', 'generated', 'tests', 'unit', 'src__cart.test.ts'))).toBe(true);

    const second = repeval(['test', '.'], dir);
    expect(second.code, second.out).toBe(0);
    expect(results(dir).baselines).toEqual({ recorded: 0, matched: 8, changed: 0 });

    // Introduce a regression: quantity is ignored.
    const cart = join(dir, 'src', 'cart.ts');
    writeFileSync(cart, readFileSync(cart, 'utf8').replace('item.price * item.qty', 'item.price'));
    const third = repeval(['test', '.'], dir);
    expect(third.code).toBe(1);
    const bug = results(dir).tests.filter((t: { status: string }) => t.status === 'possible-bug');
    expect(bug.map((t: { target: string }) => t.target)).toEqual(['unit:src/cart.ts#calcTotal']);
    expect(results(dir).baselines.changed).toBe(1);
  });

  it('init writes the GitHub Actions workflow', () => {
    const dir = copyExample('ts-lib');
    expect(repeval(['init', '.'], dir).code).toBe(0);
    const yml = readFileSync(join(dir, '.github', 'workflows', 'repeval.yml'), 'utf8');
    expect(yml).toContain('workflow_dispatch');
    expect(yml).toContain('contents: read');
    expect(repeval(['init', '.'], dir).code).toBe(1); // refuses to overwrite
  });
});

describe('repeval CLI on express-app', () => {
  it('starts the app, screenshots every page and catches the browser error on /cart', () => {
    const dir = copyExample('express-app');
    const run = repeval(['run', '.'], dir);
    expect(run.code, run.out).toBe(1);
    const r = results(dir);
    const byTarget = Object.fromEntries(r.tests.filter((t: { target?: string }) => t.target).map((t: { target: string }) => [t.target, t]));
    // If the browser tests did not run, show the CLI output so the cause is visible.
    expect(byTarget['page:/cart'], `E2E results missing. CLI output:\n${run.out}`).toBeDefined();
    expect(byTarget['page:/cart'].status).toBe('possible-bug');
    expect(byTarget['page:/cart'].message).toContain('cartTotal is not defined');
    expect(byTarget['page:/'].status).toBe('passed');
    expect(byTarget['page:/'].screenshots).toEqual(['shots/home/01-desktop.png', 'shots/home/02-mobile.png']);
    expect(byTarget['api:GET /api/products'].status).toBe('passed');
    expect(byTarget['page:/products/:id'].status).toBe('skipped');
    for (const s of byTarget['page:/'].screenshots) expect(existsSync(join(dir, 'repeval-report', s))).toBe(true);
    expect(existsSync(join(dir, 'repeval-report', 'cards', 'summary.png'))).toBe(true);
  });
});
