import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { withPackageManager } from '../src/runner/deps.js';

// The fake pnpm is a shell script, so the last test runs where sh does.
describe('withPackageManager', () => {
  const path = process.env.PATH;
  afterEach(() => {
    process.env.PATH = path;
  });

  it('runs pnpm, yarn and bun through npx when they are not installed', async () => {
    // An empty PATH: like a GitHub runner without pnpm, yarn or bun.
    process.env.PATH = mkdtempSync(join(tmpdir(), 'repeval-nopath-'));
    expect(await withPackageManager('pnpm dev', process.cwd())).toBe('npx --yes pnpm dev');
    expect(await withPackageManager('yarn start', process.cwd())).toBe('npx --yes yarn start');
    expect(await withPackageManager('bun run dev', process.cwd())).toBe('npx --yes bun run dev');
  });

  it('leaves npm, node and other commands alone', async () => {
    process.env.PATH = mkdtempSync(join(tmpdir(), 'repeval-nopath-'));
    expect(await withPackageManager('npm run dev', process.cwd())).toBe('npm run dev');
    expect(await withPackageManager('node server.js', process.cwd())).toBe('node server.js');
  });

  it.skipIf(process.platform === 'win32')('uses the package manager directly when it is installed', async () => {
    const bin = mkdtempSync(join(tmpdir(), 'repeval-pnpm-'));
    writeFileSync(join(bin, 'pnpm'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
    process.env.PATH = bin;
    expect(await withPackageManager('pnpm dev', process.cwd())).toBe('pnpm dev');
  });
});
