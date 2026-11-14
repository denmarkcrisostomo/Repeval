import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { envNamesIn, ENV_ERROR_RE, placeholderEnv, placeholderFor, valueForRule } from '../src/runner/env.js';

const fit = (name: string, rule: string, from = placeholderFor(name)) => {
  const r = valueForRule(name, rule);
  return r?.value ?? r?.fit?.(from) ?? from;
};

describe('valueForRule: a value that passes the rule', () => {
  it('zod and t3-env', () => {
    expect(fit('NODE_MODE', "z.enum(['development', 'test', 'production'])")).toBe('development');
    expect(fit('APP_URL', 'z.string().url()')).toBe('http://localhost:3000');
    expect(fit('SUPABASE', 'z.string().url()')).toBe('http://localhost:3000');
    expect(fit('DATABASE_URL_POOLED', 'z.string().url()')).toBe('postgres://repeval:repeval@localhost:5432/repeval');
    expect(fit('SUPPORT_EMAIL', 'z.string().email()')).toBe('test@example.com');
    expect(fit('MAX_UPLOADS', 'z.coerce.number().int().min(5)')).toBe('5');
    expect(fit('FEATURE_X', 'z.coerce.boolean()')).toBe('true');
    expect(fit('STRIPE_SECRET_KEY', "z.string().startsWith('sk_')")).toMatch(/^sk_/);
    expect(fit('UNSUBSCRIBE_SECRET', 'z.string().min(64)').length).toBeGreaterThanOrEqual(64);
    expect(fit('PIN', 'z.string().length(6)')).toHaveLength(6);
    expect(fit('REGION', "z.literal('ap-southeast-1')")).toBe('ap-southeast-1');
    expect(fit('TENANT', 'z.string().uuid()')).toMatch(/^[0-9a-f-]{36}$/);
    expect(fit('RESEND_API_KEY', 'z.string()')).toBe(placeholderFor('RESEND_API_KEY'));
  });

  it('envalid', () => {
    expect(fit('LOG_LEVEL', "str({ choices: ['info', 'debug'] })")).toBe('info');
    expect(fit('SERVICE', 'url()')).toBe('http://localhost:3000');
    expect(fit('SMTP_PORT', 'port()')).toBe('3000');
    expect(fit('VERBOSE', 'bool({ default: false })')).toBe('true');
  });
});

describe('placeholderEnv', () => {
  it('fills every variable from schemas, .env.example and the code, and leaves set ones alone', () => {
    const root = mkdtempSync(join(tmpdir(), 'repeval-env-'));
    mkdirSync(join(root, 'apps', 'web'), { recursive: true });
    writeFileSync(
      join(root, 'apps', 'web', 'env.ts'),
      `import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';
export const env = createEnv({
  server: {
    DATABASE_URL_POOLED: z.string().url(),
    TURNSTILE_SECRET_KEY: z.string().startsWith('0x'),
    UNSUBSCRIBE_SECRET: z.string().min(32),
    NODE_ENV: z.enum(['development', 'production']),
    CRON_LIMIT: z.coerce.number().max(10),
  },
  client: {
    NEXT_PUBLIC_SUPPORT_EMAIL: z.string().email(),
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string(),
  },
  runtimeEnv: { NEXT_PUBLIC_SUPPORT_EMAIL: process.env.NEXT_PUBLIC_SUPPORT_EMAIL },
});
`,
    );
    writeFileSync(join(root, 'apps', 'web', '.env.example'), 'RESEND_API_KEY=re_example_key\nTURNSTILE_SECRET_KEY=\n# comment\nSITE_NAME="Upa Juan"\n');
    writeFileSync(join(root, 'apps', 'web', 'cron.ts'), 'export const on = process.env.CRON_ENABLED; const k = process.env["ANALYTICS_KEY"];');
    const { env, fromSchema } = placeholderEnv(root, undefined, { ALREADY_SET: 'x', ANALYTICS_KEY: 'mine' });
    expect(env.DATABASE_URL_POOLED).toBe('postgres://repeval:repeval@localhost:5432/repeval');
    expect(env.TURNSTILE_SECRET_KEY).toMatch(/^0x/);
    expect(env.UNSUBSCRIBE_SECRET.length).toBeGreaterThanOrEqual(32);
    expect(env.CRON_LIMIT).toBe('1');
    expect(env.NEXT_PUBLIC_SUPPORT_EMAIL).toBe('test@example.com');
    expect(env.NEXT_PUBLIC_TURNSTILE_SITE_KEY).toBeTruthy();
    expect(env.RESEND_API_KEY).toBe('re_example_key');
    expect(env.SITE_NAME).toBe('Upa Juan');
    expect(env.CRON_ENABLED).toBe('false');
    expect(env.NODE_ENV).toBeUndefined(); // left to the test runner
    expect(env.ANALYTICS_KEY).toBeUndefined(); // already set
    expect(fromSchema).toBe(6);
  });
});

describe('env errors', () => {
  it('recognises them and picks out the names', () => {
    expect(ENV_ERROR_RE.test('Invalid environment variables')).toBe(true);
    expect(ENV_ERROR_RE.test('Missing environment variable: STRIPE_KEY')).toBe(true);
    expect(ENV_ERROR_RE.test('TypeError: x is not a function')).toBe(false);
    expect(envNamesIn('Invalid environment variables: PAYMENT_SECRET is missing')).toEqual(['PAYMENT_SECRET']);
  });
});
