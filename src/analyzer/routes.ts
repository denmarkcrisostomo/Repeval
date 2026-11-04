import { readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import type { EndpointInfo, PageInfo, StackInfo } from '../core/types.js';
import { hasFramework } from './stack.js';

const METHOD_EXPORT_RE = /export\s+(?:async\s+)?(?:function|const|let)\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g;
const CODE_RE = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;
const TEST_RE = /\.(test|spec)\.|__tests__/;

export interface Routes {
  pages: PageInfo[];
  endpoints: EndpointInfo[];
}

function read(root: string, file: string): string {
  try {
    return readFileSync(join(root, file), 'utf8');
  } catch {
    return '';
  }
}

const isDynamic = (route: string) => /[\[:*$]/.test(route);

/** Turn folder segments into a URL, dropping route groups like `(shop)`. Returns null for parallel routes. */
function segmentsToRoute(segments: string[]): string | null {
  const out: string[] = [];
  for (const s of segments) {
    if (!s) continue;
    if (s.startsWith('@')) return null;
    if (/^\(.*\)$/.test(s)) continue;
    out.push(s);
  }
  return '/' + out.join('/');
}

function nextApp(root: string, files: string[], r: Routes): void {
  for (const f of files) {
    const m = f.match(/^(?:src\/)?app\/(.*?)\/?(page|route)\.[cm]?[jt]sx?$/);
    if (!m) continue;
    const route = segmentsToRoute(m[1].split('/'));
    if (!route) continue;
    if (m[2] === 'page') r.pages.push({ route, file: f, dynamic: isDynamic(route), source: 'Next.js app router' });
    else
      for (const method of methodsIn(read(root, f)))
        r.endpoints.push({ method, path: route, file: f, dynamic: isDynamic(route), source: 'Next.js route handler' });
  }
}

function nextPages(files: string[], r: Routes): void {
  for (const f of files) {
    const m = f.match(/^(?:src\/)?pages\/(.+)\.[cm]?[jt]sx?$/);
    if (!m) continue;
    const parts = m[1].split('/');
    const last = parts[parts.length - 1];
    if (last.startsWith('_')) continue;
    if (last === 'index') parts.pop();
    const route = '/' + parts.join('/');
    if (parts[0] === 'api') r.endpoints.push({ method: 'GET', path: route, file: f, dynamic: isDynamic(route), source: 'Next.js API route' });
    else r.pages.push({ route, file: f, dynamic: isDynamic(route), source: 'Next.js pages router' });
  }
}

function svelteKit(root: string, files: string[], r: Routes): void {
  for (const f of files) {
    const m = f.match(/^src\/routes\/(.*?)\/?\+(page\.svelte|server\.[jt]s)$/);
    if (!m) continue;
    const route = segmentsToRoute(m[1].split('/'));
    if (!route) continue;
    if (m[2] === 'page.svelte') r.pages.push({ route, file: f, dynamic: isDynamic(route), source: 'SvelteKit' });
    else
      for (const method of methodsIn(read(root, f)))
        r.endpoints.push({ method, path: route, file: f, dynamic: isDynamic(route), source: 'SvelteKit endpoint' });
  }
}

/** Remix / React Router flat file routes: app/routes/about.tsx, app/routes/_index.tsx, app/routes/posts.$id.tsx */
function flatRoutes(files: string[], r: Routes): void {
  for (const f of files) {
    const m = f.match(/^app\/routes\/([^/]+?)(?:\/route)?\.[jt]sx?$/);
    if (!m) continue;
    const segs = m[1]
      .split('.')
      .filter((s) => s !== '_index' && !s.startsWith('_'))
      .map((s) => s.replace(/_$/, ''));
    const route = '/' + segs.join('/');
    r.pages.push({ route, file: f, dynamic: isDynamic(route), source: 'Remix routes' });
  }
}

/** <Route path="/about" /> and createBrowserRouter([{ path: '/about' }]) */
function reactRouter(root: string, files: string[], r: Routes): void {
  for (const f of files) {
    if (!CODE_RE.test(f) || TEST_RE.test(f)) continue;
    const text = read(root, f);
    if (!/from\s+['"]react-router(-dom)?['"]/.test(text)) continue;
    const found = new Set<string>();
    for (const m of text.matchAll(/<Route\b[^>]*?\bpath\s*=\s*(?:\{\s*)?["'`]([^"'`]+)["'`]/g)) found.add(m[1]);
    for (const m of text.matchAll(/\bpath\s*:\s*["'`]([^"'`]*)["'`]/g)) found.add(m[1]);
    for (let p of found) {
      if (p === '*' || p.includes('*')) continue;
      if (!p.startsWith('/')) p = '/' + p;
      r.pages.push({ route: p, file: f, dynamic: isDynamic(p), source: 'React Router' });
    }
  }
}

/** Express, Fastify, Hono, Koa-router: app.get('/path', ...) */
function serverRoutes(root: string, files: string[], r: Routes): void {
  const ROUTE_RE = /\b[A-Za-z_$][\w$]*\.(get|post|put|patch|delete)\(\s*(['"`])(\/[^'"`]*)\2/g;
  for (const f of files) {
    if (!CODE_RE.test(f) || TEST_RE.test(f)) continue;
    const text = read(root, f);
    const matches = [...text.matchAll(ROUTE_RE)];
    for (const [i, m] of matches.entries()) {
      const method = m[1].toUpperCase();
      const path = m[3];
      const handler = text.slice(m.index, matches[i + 1]?.index ?? m.index + 600);
      const looksLikeApi =
        method !== 'GET' ||
        /^\/(api|graphql|health|healthz|status)\b/.test(path) ||
        /\.json\s*\(|\bc\.json\s*\(|reply\.send\s*\(\s*\{|return\s*\{/.test(handler);
      if (looksLikeApi) r.endpoints.push({ method, path, file: f, dynamic: isDynamic(path), source: 'server route' });
      else r.pages.push({ route: path, file: f, dynamic: isDynamic(path), source: 'server route' });
    }
    // express.static('public') -> public/*.html become pages
    for (const m of text.matchAll(/express\.static\(\s*(?:path\.join\([^,]*,\s*)?['"`]([^'"`]+)['"`]/g)) {
      const dir = posix.normalize(m[1].replace(/^\.\//, '')).replace(/\/$/, '');
      for (const html of files) {
        if (!html.startsWith(dir + '/') || !html.endsWith('.html')) continue;
        const sub = html.slice(dir.length);
        const route = sub === '/index.html' ? '/' : sub.replace(/\/index\.html$/, '/');
        r.pages.push({ route, file: html, dynamic: false, source: 'static file' });
      }
    }
  }
}

function methodsIn(text: string): string[] {
  const methods = new Set<string>();
  for (const m of text.matchAll(METHOD_EXPORT_RE)) methods.add(m[1]);
  return [...methods];
}

export function findRoutes(root: string, stack: StackInfo, files: string[]): Routes {
  const r: Routes = { pages: [], endpoints: [] };
  if (hasFramework(stack, 'next')) {
    nextApp(root, files, r);
    nextPages(files, r);
  }
  if (hasFramework(stack, '@sveltejs/kit')) svelteKit(root, files, r);
  if (hasFramework(stack, '@remix-run/react')) flatRoutes(files, r);
  if (hasFramework(stack, 'react-router', 'react-router-dom')) reactRouter(root, files, r);
  if (hasFramework(stack, 'express', 'fastify', 'hono', 'koa')) serverRoutes(root, files, r);

  // A Vite (or plain) single-page app with no router still has a home page.
  if (r.pages.length === 0 && hasFramework(stack, 'vite') && files.includes('index.html'))
    r.pages.push({ route: '/', file: 'index.html', dynamic: false, source: 'Vite entry' });

  const pages = new Map<string, PageInfo>();
  for (const p of r.pages) if (!pages.has(p.route)) pages.set(p.route, p);
  const endpoints = new Map<string, EndpointInfo>();
  for (const e of r.endpoints) if (!endpoints.has(`${e.method} ${e.path}`)) endpoints.set(`${e.method} ${e.path}`, e);

  const byRoute = (a: string, b: string) => (a === '/' ? -1 : b === '/' ? 1 : a.localeCompare(b));
  return {
    pages: [...pages.values()].sort((a, b) => byRoute(a.route, b.route)),
    endpoints: [...endpoints.values()].sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method)),
  };
}
