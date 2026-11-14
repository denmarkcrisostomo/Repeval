import fg from 'fast-glob';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { IGNORE } from '../analyzer/files.js';

/**
 * Stand-in environment variables for the unit tests. Many apps check their environment as soon as a file
 * loads (@t3-oss/env, envalid, a zod schema over process.env), and Repeval has none of the real values: those
 * are secrets and stay with you. So every variable the code uses gets a safe, made-up value that looks like
 * the real kind (a postgres:// URL for DATABASE_URL, an email for *_EMAIL), and the files can load and be tested.
 *
 * Every variable the code needs gets one, found three ways:
 *   - its env schema: zod / @t3-oss/env (`NAME: z.string().url()`) and envalid (`NAME: url()`). The value is
 *     built to pass that rule: an enum's first option, a number, a boolean, an email, a URL, a "sk_" prefix,
 *     a minimum length;
 *   - .env.example (or .env.sample / .env.template), whose example values are used when the schema allows;
 *   - `process.env.NAME` and `import.meta.env.NAME` anywhere in the code, guessed from the name.
 * Your own .env files are never read, and a variable that is already set is left as it is. The values only
 * exist in the test run.
 */
export interface PlaceholderEnv {
  env: Record<string, string>;
  /** How many names came from env schemas, example files and the rest of the code, for the log. */
  fromSchema: number;
  fromExample: number;
  fromCode: number;
}

const EXAMPLE_FILES = ['.env.example', '.env.sample', '.env.template', '.env.local.example', '.env.development.example'];
const NAME = '[A-Z][A-Z0-9_]*';
const IN_CODE = new RegExp(`(?:process\\.env|import\\.meta\\.env)(?:\\.(${NAME})|\\[\\s*['"\`](${NAME})['"\`]\\s*\\])`, 'g');
// Set by the runtime, the tools or Repeval itself: never invented.
const LEAVE = /^(NODE_ENV|CI|PATH|HOME|PWD|SHELL|USER|TZ|LANG|TERM|PORT|HOSTNAME|SKIP_ENV_VALIDATION|VITEST\w*|REPEVAL_\w+|npm_\w+|GITHUB_\w+|RUNNER_\w+|VERCEL\w*|NEXT_RUNTIME|NEXT_PHASE|DEV|PROD|SSR|MODE|BASE_URL)$/;

/** A made-up value that passes the usual checks for a variable with this name. */
export function placeholderFor(name: string): string {
  const n = name.toUpperCase();
  if (/(^|_)(DATABASE|DB|POSTGRES|PG)(_\w+)?_(URL|URI)$|^DATABASE_URL/.test(n)) return 'postgres://repeval:repeval@localhost:5432/repeval';
  if (/MYSQL\w*_(URL|URI)$/.test(n)) return 'mysql://repeval:repeval@localhost:3306/repeval';
  if (/MONGO\w*_(URL|URI)$/.test(n)) return 'mongodb://localhost:27017/repeval';
  if (/REDIS\w*_(URL|URI)$|KV_URL$/.test(n)) return 'redis://localhost:6379';
  if (/(_URL|_URI|_ENDPOINT|_ORIGIN|_HOST_URL)$|^(URL|URI)$/.test(n)) return 'http://localhost:3000';
  if (/(EMAIL|_FROM|_TO)$/.test(n)) return 'test@example.com';
  if (/(_HOST|HOSTNAME)$/.test(n)) return 'localhost';
  if (/_PORT$/.test(n)) return '3000';
  if (/(^|_)(ENABLE|ENABLED|DISABLE|DISABLED|DEBUG|USE|IS|FLAG)(_|$)/.test(n)) return 'false';
  if (/(_TIMEOUT|_TTL|_LIMIT|_MAX|_MIN|_COUNT|_SIZE|_MS|_SECONDS|_DAYS)$/.test(n)) return '60';
  if (/(_ID)$/.test(n)) return 'repeval-test-id';
  // Keys, secrets, tokens and the rest: long enough for "at least 32 characters" checks.
  return 'repeval-placeholder-0123456789abcdef0123456789abcdef';
}

const URLISH = /^[a-z][a-z0-9+.-]*:\/\//i;
const pad = (v: string, n: number) => (v.length >= n ? v : v + 'x'.repeat(n - v.length));

/**
 * What a schema rule asks for, read from its source: `z.string().url()`, `z.enum(['a', 'b'])`,
 * `z.coerce.number().min(1)`, `str({ choices: [...] })`. Returns the value to use, or a function that turns a
 * candidate (from .env.example or the name) into one that passes, or null when the rule says nothing useful.
 */
export function valueForRule(name: string, rule: string): { value?: string; fit?: (v: string) => string } | null {
  const r = rule.replace(/\s+/g, ' ');
  const first = (re: RegExp) => r.match(re)?.[1];
  const option = first(/(?:enum|nativeEnum|choices\s*:)\s*\(?\s*\[\s*['"`]([^'"`]+)/) ?? first(/literal\(\s*['"`]([^'"`]+)/);
  if (option !== undefined) return { value: option };
  if (/\b(?:z\.)?(?:coerce\.)?(?:number|int|bigint|num|port)\(|\.int\(|z\.number/.test(r) && !/\.string\(/.test(r)) {
    const min = Number(first(/\.(?:min|gte|gt)\(\s*(-?\d+)/) ?? NaN);
    const max = Number(first(/\.(?:max|lte|lt)\(\s*(-?\d+)/) ?? NaN);
    const n = Number.isFinite(min) ? min + (/\.gt\(/.test(r) ? 1 : 0) : Number.isFinite(max) ? Math.min(1, max) : /port\(/.test(r) ? 3000 : 1;
    return { value: String(n) };
  }
  if (/boolean\(|stringbool\(|\bbool\(/.test(r)) return { value: 'true' };
  if (/email\(/.test(r)) return { value: 'test@example.com' };
  if (/uuid\(|guid\(/.test(r)) return { value: '00000000-0000-4000-8000-000000000000' };
  if (/datetime\(|iso\.datetime|isoDate/.test(r)) return { value: '2026-01-01T00:00:00Z' };
  if (/\bdate\(/.test(r)) return { value: '2026-01-01' };
  if (/\bip(?:v4)?\(/.test(r)) return { value: '127.0.0.1' };
  if (/\bhost\(/.test(r)) return { value: 'localhost' };
  if (/base64\(/.test(r)) return { value: 'cmVwZXZhbC1wbGFjZWhvbGRlcg==' };
  if (/\bjson\(/.test(r)) return { value: '{}' };
  const len = Number(first(/\.length\(\s*(\d+)/) ?? NaN);
  const min = Number(first(/\.(?:min|nonempty)\(\s*(\d+)?/) ?? (/\.nonempty\(/.test(r) ? 1 : NaN));
  const prefix = first(/\.startsWith\(\s*['"`]([^'"`]+)/);
  const suffix = first(/\.endsWith\(\s*['"`]([^'"`]+)/);
  const url = /url\(|httpUrl\(|\burl\b/.test(r);
  if (!url && !prefix && !suffix && !Number.isFinite(len) && !Number.isFinite(min)) return null;
  return {
    fit: (v) => {
      let out = url && !URLISH.test(v) ? (URLISH.test(placeholderFor(name)) ? placeholderFor(name) : 'http://localhost:3000') : v;
      if (prefix && !out.startsWith(prefix)) out = prefix + out.replace(/^[a-z]+:\/\//i, '').replace(/[^A-Za-z0-9]/g, '');
      if (suffix && !out.endsWith(suffix)) out += suffix;
      if (Number.isFinite(len)) out = pad(out, len).slice(0, len);
      else if (Number.isFinite(min)) out = pad(out, min);
      return out;
    },
  };
}

// `NAME: z.string().url(),` in a zod object or createEnv, `NAME: url({ ... }),` in envalid's cleanEnv.
const RULE = /\b([A-Z][A-Z0-9_]*)\s*:\s*((?:z|zod|v)\.[\s\S]*?|(?:str|url|email|host|port|num|bool|json)\([\s\S]*?)(?=,\s*\n|\n\s*[A-Z][A-Z0-9_]*\s*:|\n\s*\}|$)/g;

function parseExample(text: string): [string, string][] {
  const out: [string, string][] = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let value = m[2].trim();
    const quoted = value.match(/^(['"])(.*)\1/);
    value = quoted ? quoted[2] : value.replace(/\s+#.*$/, '').trim();
    out.push([m[1], value]);
  }
  return out;
}

export function placeholderEnv(root: string, codeFiles?: string[], current: NodeJS.ProcessEnv = process.env): PlaceholderEnv {
  const wanted = (name: string) => !LEAVE.test(name) && current[name] === undefined;
  const rules = new Map<string, NonNullable<ReturnType<typeof valueForRule>>>();
  const examples = new Map<string, string>();
  const seen = new Set<string>();

  // Example files anywhere in the repo (a monorepo has one per app). Their values are examples by definition.
  const exampleFiles = fg.sync(EXAMPLE_FILES.map((f) => `**/${f}`), { cwd: root, ignore: IGNORE, dot: true, followSymbolicLinks: false });
  for (const f of exampleFiles)
    for (const [name, value] of parseExample(readFileSync(join(root, f), 'utf8'))) if (wanted(name) && !examples.has(name)) examples.set(name, value);

  const files = codeFiles ?? fg.sync('**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}', { cwd: root, ignore: IGNORE, followSymbolicLinks: false });
  for (const f of files) {
    const file = join(root, f);
    let text: string;
    try {
      if (!existsSync(file) || statSync(file).size > 400_000) continue;
      text = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    for (const m of text.matchAll(IN_CODE)) if (wanted(m[1] ?? m[2])) seen.add(m[1] ?? m[2]);
    // Only files that look like env schemas: zod/t3-env or envalid.
    if (!/createEnv|cleanEnv|process\.env|import\.meta\.env/.test(text)) continue;
    for (const m of text.matchAll(RULE)) {
      if (!wanted(m[1]) || rules.has(m[1])) continue;
      const rule = valueForRule(m[1], m[2]);
      rules.set(m[1], rule ?? {});
    }
  }

  // Schema rules first, then the example's value, then a guess from the name; a rule can reshape the other two.
  const env: Record<string, string> = {};
  let fromSchema = 0;
  let fromExample = 0;
  let fromCode = 0;
  for (const name of new Set([...rules.keys(), ...examples.keys(), ...seen])) {
    const rule = rules.get(name);
    const example = examples.get(name);
    const base = example || placeholderFor(name);
    env[name] = rule?.value ?? (rule?.fit ? rule.fit(base) : base);
    if (rules.has(name)) fromSchema++;
    else if (examples.has(name)) fromExample++;
    else fromCode++;
  }
  return { env, fromSchema, fromExample, fromCode };
}

/** "Invalid environment variables", "Missing environment variable: X" and the like. */
export const ENV_ERROR_RE =
  /Invalid environment variables?|Missing (required )?env(ironment)? var(iable)?s?|env(ironment)? var(iable)?s? (is |are )?(missing|required|not set)|(is|are) (missing|required|not set) in (the )?env/i;

/** Variable names mentioned in an env error, such as PAYMENT_SECRET in "PAYMENT_SECRET is missing". */
export function envNamesIn(message: string): string[] {
  return [...new Set(message.match(/\b[A-Z][A-Z0-9]*_[A-Z0-9_]*[A-Z0-9]\b/g) ?? [])];
}
