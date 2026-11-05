import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { generateE2E, slugForRoute } from '../src/adapters/playwright.js';
import { generateUnit } from '../src/adapters/vitest.js';
import { analyze } from '../src/analyzer/index.js';
import { getPaths } from '../src/core/paths.js';
import { buildPlan } from '../src/planner/index.js';

const ex = (name: string) => join(__dirname, '..', 'examples', name);

/** Generated code must at least be valid TypeScript. */
function syntaxErrors(code: string): string[] {
  const out = ts.transpileModule(code, { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.ESNext } });
  return (out.diagnostics ?? []).map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'));
}

describe('planner', () => {
  it('turns off what templates cannot test, with a reason', () => {
    const plan = buildPlan(analyze(ex('express-app')));
    const byId = Object.fromEntries(plan.targets.map((t) => [t.id, t]));
    expect(byId['page:/'].enabled).toBe(true);
    expect(byId['page:/products/:id']).toMatchObject({ enabled: false, reason: expect.stringContaining('dynamic route') });
    expect(byId['api:POST /api/orders']).toMatchObject({ enabled: false });
    expect(byId['load:GET /api/products']).toMatchObject({ enabled: false, framework: 'k6' });
  });

  it('filters by test kind', () => {
    const a = analyze(ex('express-app'));
    expect(new Set(buildPlan(a, 'unit').targets.map((t) => t.type))).toEqual(new Set(['unit']));
    expect(new Set(buildPlan(a, 'e2e').targets.map((t) => t.type))).toEqual(new Set(['e2e', 'api']));
  });

  it('ranks risky-looking functions higher', () => {
    const plan = buildPlan(analyze(ex('ts-lib')), 'unit');
    expect(plan.targets.find((t) => t.target === 'src/cart.ts#calcTotal')?.priority).toBe('high');
    expect(plan.targets.find((t) => t.target === 'src/math.ts#add')?.priority).not.toBe('high');
  });
});

describe('template writer', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'repeval-gen-'));

  it('writes valid Vitest files with baseline cases', () => {
    const root = ex('ts-lib');
    const a = analyze(root);
    const p = { ...getPaths(root), unitDir: join(tmp, 'unit'), vitestConfig: join(tmp, 'vitest.config.mjs') };
    const { files, contents } = generateUnit(a, buildPlan(a), p);
    expect(files.filter((f) => f.kind === 'unit')).toHaveLength(4);
    for (const [path, code] of contents) expect(syntaxErrors(code), path).toEqual([]);
    const cart = [...contents.entries()].find(([k]) => k.endsWith('src__cart.test.ts'))![1];
    expect(cart).toContain(`matchBaseline("src/cart.ts/calcTotal"`);
    const api = [...contents.entries()].find(([k]) => k.endsWith('src__api.test.ts'))![1];
    expect(api).not.toContain('matchBaseline'); // fetchUser has side effects: export check only
  });

  it('writes valid Playwright files with one annotated test per page and endpoint', () => {
    const root = ex('express-app');
    const p = { ...getPaths(root), e2eDir: join(tmp, 'e2e') };
    const { contents } = generateE2E(buildPlan(analyze(root)), p);
    for (const [path, code] of contents) expect(syntaxErrors(code), path).toEqual([]);
    const pages = [...contents.entries()].find(([k]) => k.endsWith('pages.spec.ts'))![1];
    expect(pages.match(/^test\(/gm)).toHaveLength(4);
    expect(pages).toContain(`description: "page:/cart"`);
    expect(pages).toContain('${errors.join');
    expect(slugForRoute('/help.html')).toBe('help-html');
  });
});

describe('vitest config for Next.js projects', () => {
  it('reads @/ aliases from the default Next.js tsconfig and compiles JSX', () => {
    const root = mkdtempSync(join(tmpdir(), 'repeval-next-'));
    mkdirSync(join(root, 'src', 'lib'), { recursive: true });
    writeFileSync(join(root, 'package.json'), '{"name":"n","version":"1.0.0"}');
    // Next's default tsconfig: "@/*" and "**/*.ts" together look like a /* comment */ to a naive parser.
    writeFileSync(
      join(root, 'tsconfig.json'),
      '{\n  "compilerOptions": {\n    "jsx": "preserve",\n    "paths": { "@/*": ["./src/*"] },\n  },\n  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"]\n}\n',
    );
    writeFileSync(join(root, 'src', 'lib', 'seo.ts'), 'export function title(s: string) { return s + "!"; }\n');
    const a = analyze(root);
    const { contents } = generateUnit(a, buildPlan(a), getPaths(root));
    const config = [...contents.entries()].find(([k]) => k.endsWith('vitest.config.mjs'))![1];
    // Relative to .repeval/, so the config also works after the tests are committed.
    expect(config).toContain('{"@":"../src"}');
    expect(config).not.toContain(root);
    expect(config).toContain("jsx: { runtime: 'automatic' }");
  });
});
