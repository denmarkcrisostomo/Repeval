import pc from 'picocolors';

export const log = {
  step(title: string): void {
    console.log('\n' + pc.bold(pc.cyan(title)));
  },
  info(msg: string): void {
    console.log('  ' + msg);
  },
  item(label: string, value: string): void {
    console.log('  ' + pc.dim(label.padEnd(12)) + value);
  },
  ok(msg: string): void {
    console.log('  ' + pc.green('✔ ') + msg);
  },
  warn(msg: string): void {
    console.log('  ' + pc.yellow('! ') + msg);
  },
  error(msg: string): void {
    console.error('  ' + pc.red('✖ ') + msg);
  },
  dim(msg: string): void {
    console.log(pc.dim('  ' + msg));
  },
  raw(msg: string): void {
    process.stdout.write(msg);
  },
};
