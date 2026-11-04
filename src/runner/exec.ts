import { spawn } from 'node:child_process';
import pc from 'picocolors';

export interface ExecResult {
  code: number;
  /** Last lines of combined output, for error messages. */
  tail: string;
}

export interface ExecOptions {
  cwd: string;
  env?: NodeJS.ProcessEnv;
  echo?: boolean;
  shell?: boolean;
}

/** Run a command, stream its output (indented and dimmed) and keep the last 60 lines. */
export function exec(cmd: string, args: string[], opts: ExecOptions): Promise<ExecResult> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd,
      env: opts.env ?? process.env,
      shell: opts.shell ?? false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const lines: string[] = [];
    let partial = '';
    const onData = (buf: Buffer) => {
      const text = partial + buf.toString();
      const parts = text.split('\n');
      partial = parts.pop() ?? '';
      for (const line of parts) {
        lines.push(line);
        if (lines.length > 60) lines.shift();
        if (opts.echo) process.stdout.write(pc.dim('    │ ' + line) + '\n');
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', (err) => resolve({ code: 127, tail: err.message }));
    child.on('close', (code) => {
      if (partial) lines.push(partial);
      resolve({ code: code ?? 1, tail: lines.join('\n') });
    });
  });
}

export function stripAnsi(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\u001b\[[0-9;]*[A-Za-z]/g, '');
}
