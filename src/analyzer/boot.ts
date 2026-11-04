import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BootInfo, StackInfo } from '../core/types.js';
import { hasFramework } from './stack.js';

const DEFAULT_PORTS: [string, number][] = [
  ['next', 3000],
  ['nuxt', 3000],
  ['astro', 4321],
  ['@sveltejs/kit', 5173],
  ['@remix-run/react', 5173],
  ['vite', 5173],
];

const SERVER_FILES = ['server.js', 'server.mjs', 'index.js', 'index.mjs', 'app.js', 'src/server.js', 'src/index.js', 'src/app.js'];

export function runScriptCommand(pm: StackInfo['packageManager'], script: string): string {
  if (pm === 'npm') return `npm run ${script}`;
  if (pm === 'bun') return `bun run ${script}`;
  return `${pm} ${script}`;
}

function readEnvKeys(file: string): string[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8')
    .split('\n')
    .map((l) => l.trim().match(/^(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=/i)?.[1])
    .filter((k): k is string => !!k);
}

export function detectBoot(root: string, stack: StackInfo, sourceFiles: string[]): BootInfo {
  const scripts = stack.scripts;
  const devFirst = hasFramework(stack, 'next', 'vite', '@sveltejs/kit', '@remix-run/react', 'astro', 'nuxt');
  const order = devFirst ? ['dev', 'start', 'serve', 'preview'] : ['start', 'dev', 'serve'];
  const script = order.find((s) => scripts[s]);

  let command: string | null = null;
  let note = '';
  let serverText = '';

  if (script) {
    command = runScriptCommand(stack.packageManager, script);
    note = `"${script}" script in package.json`;
  } else {
    const server = SERVER_FILES.find((f) => {
      if (!existsSync(join(root, f))) return false;
      const t = readFileSync(join(root, f), 'utf8');
      if (!/\.listen\s*\(/.test(t)) return false;
      serverText = t;
      return true;
    });
    if (server) {
      command = `node ${server}`;
      note = `${server} calls listen()`;
    } else {
      note = 'no start or dev script found';
    }
  }

  // Port: explicit flag in the script, then the framework default, then what the server code listens on.
  let port: number | null = null;
  const scriptText = script ? scripts[script] : '';
  const flag = scriptText.match(/(?:--port|-p)[ =](\d{2,5})\b/);
  if (flag) port = Number(flag[1]);
  if (!port) port = DEFAULT_PORTS.find(([id]) => hasFramework(stack, id))?.[1] ?? null;
  if (!port) {
    const texts = serverText ? [serverText] : [];
    for (const f of sourceFiles) {
      if (texts.length > 40) break;
      try {
        const t = readFileSync(join(root, f), 'utf8');
        if (/\.listen\s*\(/.test(t)) texts.push(t);
      } catch {
        /* ignore */
      }
    }
    for (const t of texts) {
      const m = t.match(/PORT\s*(?:\|\||\?\?)\s*['"]?(\d{2,5})/) ?? t.match(/\.listen\(\s*(\d{2,5})/);
      if (m) {
        port = Number(m[1]);
        break;
      }
    }
  }
  if (!port && command) port = 3000;

  const exampleKeys = ['.env.example', '.env.sample', '.env.template'].flatMap((f) => readEnvKeys(join(root, f)));
  const localKeys = new Set(['.env', '.env.local'].flatMap((f) => readEnvKeys(join(root, f))));
  const envVars = [...new Set(exampleKeys)].map((name) => ({
    name,
    present: localKeys.has(name) || process.env[name] !== undefined,
  }));

  return { command, port, envVars, note };
}
