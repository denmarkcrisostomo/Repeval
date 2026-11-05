import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyze } from '../src/analyzer/index.js';

const ex = (name: string) => join(__dirname, '..', 'examples', name);

describe('analyzer: ts-lib', () => {
  const a = analyze(ex('ts-lib'));
  const fn = (id: string) => a.functions.find((f) => f.id === id)!;

  it('detects the stack', () => {
    expect(a.stack.language).toBe('typescript');
    expect(a.stack.moduleType).toBe('esm');
    expect(a.stack.packageManager).toBe('npm');
    expect(a.boot.command).toBeNull();
  });

  it('maps exported functions, including arrow and default exports', () => {
    expect(a.functions.map((f) => f.id).sort()).toEqual([
      'src/api.ts#createId',
      'src/api.ts#fetchUser',
      'src/cart.ts#calcTotal',
      'src/cart.ts#formatPrice',
      'src/math.ts#add',
      'src/math.ts#average',
      'src/math.ts#clamp',
      'src/strings.ts#default',
      'src/strings.ts#slugify',
      'src/strings.ts#truncate',
    ]);
    expect(fn('src/strings.ts#default').name).toBe('capitalize');
  });

  it('builds sample arguments from types, including interfaces and literal unions', () => {
    const calc = fn('src/cart.ts#calcTotal');
    expect(calc.callable).toBe(true);
    expect(calc.params[0].samples?.[0]).toBe('[{ price: 2, qty: 2 }, { price: 0, qty: 0 }]');
    expect(calc.params[1].samples).toEqual(['"SAVE10"', '"SAVE20"', 'undefined']);
    expect(calc.cases[0]).toEqual(['[{ price: 2, qty: 2 }, { price: 0, qty: 0 }]', '"SAVE10"']);
    expect(calc.cases.length).toBeLessThanOrEqual(6);
  });

  it('refuses to call functions with side effects', () => {
    expect(fn('src/api.ts#fetchUser').callable).toBe(false);
    expect(fn('src/api.ts#fetchUser').impureReasons).toContain('makes network requests');
    expect(fn('src/api.ts#createId').impureReasons).toContain('uses randomness');
  });
});

describe('analyzer: express-app', () => {
  const a = analyze(ex('express-app'));

  it('detects Express and how to start it', () => {
    expect(a.stack.frameworks.map((f) => f.label)).toContain('Express');
    expect(a.boot.command).toBe('npm run start');
    expect(a.boot.port).toBe(4310);
    expect(a.boot.envVars.map((e) => e.name)).toEqual(['PORT', 'SHOP_NAME']);
  });

  it('finds pages, static pages and API endpoints', () => {
    expect(a.pages.map((p) => [p.route, p.dynamic])).toEqual([
      ['/', false],
      ['/about', false],
      ['/cart', false],
      ['/help.html', false],
      ['/products/:id', true],
    ]);
    expect(a.endpoints.map((e) => `${e.method} ${e.path}`)).toEqual([
      'GET /api/health',
      'POST /api/orders',
      'GET /api/products',
    ]);
  });

  it('skips server.js for unit tests and keeps plain JS helpers', () => {
    expect(a.skippedFiles).toContainEqual({ file: 'server.js', reason: 'starts a server when imported' });
    const tax = a.functions.find((f) => f.id === 'lib/pricing.js#applyTax')!;
    expect(tax.callable).toBe(false); // untyped JS: no safe samples without AI
  });
});

describe('analyzer: next-app', () => {
  const a = analyze(ex('next-app'));

  it('reads app router pages, route groups and route handlers', () => {
    expect(a.pages.map((p) => p.route)).toEqual(['/', '/about', '/cart', '/products/[id]']);
    expect(a.endpoints.map((e) => `${e.method} ${e.path}`)).toEqual(['GET /api/products', 'POST /api/products']);
    expect(a.boot).toMatchObject({ command: 'npm run dev', port: 3000 });
    expect(a.boot.envVars).toEqual([
      { name: 'DATABASE_URL', present: false },
      { name: 'NEXT_PUBLIC_SITE_NAME', present: false },
    ]);
  });

  it('marks React components and skips framework files', () => {
    const badge = a.functions.find((f) => f.exportName === 'ProductBadge')!;
    expect(badge.isComponent).toBe(true);
    expect(a.functions.find((f) => f.exportName === 'formatDate')?.callable).toBe(true);
    expect(a.skippedFiles.map((s) => s.file)).toContain('app/page.tsx');
  });
});

describe('analyzer: NestJS routes', () => {
  const a = analyze(join(__dirname, 'fixtures', 'nest-api'));

  it('finds controller routes with the global prefix and URI versions', () => {
    expect(a.endpoints.map((e) => `${e.method} ${e.path}`)).toEqual([
      'GET /api/v1/admin/users/count',
      'GET /api/v1/health',
      'GET /api/v2/users',
      'POST /api/v2/users',
      'DELETE /api/v2/users/:id',
      'GET /api/v2/users/:id',
    ]);
    expect(a.endpoints.find((e) => e.path === '/api/v2/users/:id')?.dynamic).toBe(true);
  });

  it('treats @Render routes as pages, whichever order the decorators are in', () => {
    expect(a.pages.map((p) => p.route)).toEqual(['/api/v1', '/api/v1/about']);
    expect(a.pages.every((p) => p.source === 'NestJS @Render')).toBe(true);
  });

  it('finds how to start it', () => {
    expect(a.boot.command).toContain('start');
    expect(a.boot.port).toBe(3000);
  });
});
