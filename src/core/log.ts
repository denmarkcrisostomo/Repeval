import pc from 'picocolors';

/** A step that is still working: shows a spinner, what it is doing and how long it has taken. */
export interface Task {
  /** What it is doing now, e.g. "312 / 1,480 files". Cheap to call often: it redraws at most every 80 ms. */
  update(detail: string): void;
  /** Stop the spinner and clear its line. Safe to call twice. */
  done(): void;
}

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const FRAME_MS = 80;
const PLAIN_EVERY_MS = 5000;

/** A spinner on one line only works in a terminal; GitHub Actions and piped output get plain lines instead. */
const live = () => !!process.stdout.isTTY && !process.env.CI && process.env.TERM !== 'dumb';
const clock = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

// The spinner on screen now, if any: other output clears it first and draws it again after.
let active: { draw(): void; clear(): void } | null = null;
function print(write: () => void): void {
  active?.clear();
  write();
  active?.draw();
}

export const log = {
  step(title: string): void {
    print(() => console.log('\n' + pc.bold(pc.cyan(title))));
  },
  info(msg: string): void {
    print(() => console.log('  ' + msg));
  },
  item(label: string, value: string): void {
    print(() => console.log('  ' + pc.dim(label.padEnd(12)) + value));
  },
  ok(msg: string): void {
    print(() => console.log('  ' + pc.green('✔ ') + msg));
  },
  warn(msg: string): void {
    print(() => console.log('  ' + pc.yellow('! ') + msg));
  },
  error(msg: string): void {
    print(() => console.error('  ' + pc.red('✖ ') + msg));
  },
  dim(msg: string): void {
    print(() => console.log(pc.dim('  ' + msg)));
  },
  raw(msg: string): void {
    print(() => process.stdout.write(msg));
  },

  /**
   * Show that a long step is still working. In a terminal: a spinner line, updated in place,
   *   ⠹ Reading code · 312 / 1,480 files · 0:14
   * In GitHub Actions or piped output: the label once, then a line every 5 seconds while it runs.
   * The spinner turns with time and with update(), so it keeps moving even while the work blocks the
   * event loop (reading code does), as long as that work calls update() now and then.
   */
  task(label: string): Task {
    const start = Date.now();
    let detail = '';
    let ended = false;
    const text = () => `${label}${detail ? ` · ${detail}` : ''} · ${clock(Date.now() - start)}`;

    if (live()) {
      let last = 0;
      const clear = () => process.stdout.write('\r\x1b[2K');
      const draw = () => {
        last = Date.now();
        const frame = FRAMES[Math.floor((last - start) / FRAME_MS) % FRAMES.length];
        // One line only: a line that wraps can't be cleared with \r.
        const room = Math.max(20, (process.stdout.columns || 80) - 5);
        const t = text();
        process.stdout.write(`\r\x1b[2K  ${pc.cyan(frame)} ${pc.dim(t.length > room ? t.slice(0, room - 1) + '…' : t)}`);
      };
      const timer = setInterval(draw, FRAME_MS);
      timer.unref();
      active = { draw, clear };
      draw();
      return {
        update(d) {
          detail = d;
          if (!ended && Date.now() - last >= FRAME_MS) draw();
        },
        done() {
          if (ended) return;
          ended = true;
          clearInterval(timer);
          clear();
          active = null;
        },
      };
    }

    let last = start;
    const line = () => {
      last = Date.now();
      console.log(pc.dim(`  ${text()}`));
    };
    console.log(pc.dim(`  ${label}…`));
    const timer = setInterval(line, PLAIN_EVERY_MS);
    timer.unref();
    return {
      update(d) {
        detail = d;
        if (!ended && Date.now() - last >= PLAIN_EVERY_MS) line();
      },
      done() {
        ended = true;
        clearInterval(timer);
      },
    };
  },
};
