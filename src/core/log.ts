import pc from 'picocolors';

let quiet = false;
export function setQuiet(v: boolean): void {
  quiet = v;
}

const STEP_NUMBERS = ['①', '②', '③', '④', '⑤', '⑥'];

export const log = {
  step(n: number, title: string): void {
    if (quiet) return;
    console.log('\n' + pc.bold(pc.cyan(`${STEP_NUMBERS[n - 1] ?? n} ${title}`)));
  },
  info(msg: string): void {
    if (!quiet) console.log('  ' + msg);
  },
  item(label: string, value: string): void {
    if (!quiet) console.log('  ' + pc.dim(label.padEnd(12)) + value);
  },
  ok(msg: string): void {
    if (!quiet) console.log('  ' + pc.green('✔ ') + msg);
  },
  warn(msg: string): void {
    if (!quiet) console.log('  ' + pc.yellow('! ') + msg);
  },
  error(msg: string): void {
    console.error('  ' + pc.red('✖ ') + msg);
  },
  dim(msg: string): void {
    if (!quiet) console.log(pc.dim('  ' + msg));
  },
  raw(msg: string): void {
    if (!quiet) process.stdout.write(msg);
  },
};
