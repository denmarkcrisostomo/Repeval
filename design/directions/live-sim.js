// Replays the real demo-shop run (examples/express-app) as the website would see it:
// GitHub workflow steps from the Actions API, plus Repeval's own log lines.
// Durations are realistic seconds; playback is sped up so the whole run takes about 25 seconds.
(function () {
  const STEPS = [
    { id: 'checkout', name: 'Checkout', stop: 'Collect', short: 'Checkout', detail: 'demo-shop at 9f2c1ab', dur: 3,
      explain: 'GitHub copied your repo onto a fresh, temporary machine. Repeval never receives your code.',
      log: ['Syncing repository: you/demo-shop', 'HEAD is now at 9f2c1ab'] },
    { id: 'node', name: 'Set up Node', stop: 'Collect', short: 'Node', detail: 'Node 22', dur: 4,
      explain: 'Installing Node.js 22 on that machine so your project can run.',
      log: ['Found in cache @ /opt/hostedtoolcache/node/22', 'node -v: v22'] },
    { id: 'analyze', name: 'Analyze', stop: 'Understand', short: 'Analyze', detail: 'Express, 5 pages', doing: 'reading code', dur: 7,
      explain: 'Reading package.json and your code. Found Express, 5 pages, 3 API endpoints, and that "npm run start" starts the app.',
      log: ['① Collect files', 'Scanned 3 source files, 0 existing tests', '② Understand the repo', 'Stack: javascript, Express', 'Pages: /  /about  /cart  /help.html  /products/:id', 'Start: npm run start (port 4310)'] },
    { id: 'plan', name: 'Plan', stop: 'Plan', short: 'Plan', detail: '9 of 13 targets', dur: 2,
      explain: 'Deciding what to test. 4 things are skipped, each with a reason, like /products/:id needing example IDs.',
      log: ['③ Plan', 'Targets: 9 of 13 (3 unit, 4 pages, 2 API)', '4 skipped, reasons in the report'] },
    { id: 'generate', name: 'Generate', stop: 'Make tests', short: 'Generate', detail: '4 test files', dur: 2,
      explain: 'Writing 4 test files: Vitest for your functions, Playwright for your pages and API.',
      log: ['④ Make tests', 'Wrote 4 test files in .repeval/'] },
    { id: 'test', name: 'Test', stop: 'Run', short: 'Test', detail: '10 passed, 1 bug', doing: 'opening pages', dur: 41, result: 'bug',
      explain: 'Starting your app and opening every page in a real browser, with a screenshot of each one.',
      log: ['⑤ Run', 'Installing project dependencies: npm ci', 'Running unit tests with Vitest', '✓ 5 unit tests passed', 'Running E2E tests with Playwright', '✓ page / loads', '✓ page /about loads', '✗ page /cart loads: cartTotal is not defined', '✓ page /help.html loads', '✓ GET /api/health responds', '✓ GET /api/products responds'],
      shots: [ { at: 0.55, src: 'img/home.png', route: '/', ok: true }, { at: 0.66, src: 'img/about.png', route: '/about', ok: true },
               { at: 0.77, src: 'img/cart.png', route: '/cart', ok: false }, { at: 0.88, src: 'img/help.png', route: '/help.html', ok: true } ] },
    { id: 'save', name: 'Save report', stop: 'Results', short: 'Report', detail: 'kept 7 days', dur: 3,
      explain: 'Saving the report in your repo for 7 days. The machine is then deleted.',
      log: ['⑥ Results', '10 passed  1 possible bug  0 broken tests  4 skipped', 'Uploaded artifact repeval-report'] },
  ];
  const TOTAL = STEPS.reduce((s, x) => s + x.dur, 0);
  const SPEED = TOTAL / 24; // seconds of run per second of playback
  const QUEUE = 1.6; // playback seconds spent "queued" before the runner picks it up

  function create(onTick) {
    let start = 0, raf = 0;
    const state = () => {
      const t = (performance.now() - start) / 1000;
      if (t < QUEUE) return { phase: 'queued', elapsed: 0, index: -1, progress: 0, steps: STEPS.map(() => 'waiting') };
      const run = Math.min((t - QUEUE) * SPEED, TOTAL);
      let acc = 0, index = STEPS.length;
      const steps = STEPS.map((s, i) => {
        const start = acc; acc += s.dur;
        if (run >= acc) return s.result === 'bug' ? 'bug' : 'passed';
        if (run >= start) { index = i; return 'running'; }
        return 'waiting';
      });
      let before = 0; for (let i = 0; i < Math.min(index, STEPS.length); i++) before += STEPS[i].dur;
      const progress = index < STEPS.length ? (run - before) / STEPS[index].dur : 1;
      return { phase: run >= TOTAL ? 'done' : 'running', elapsed: run, index, progress, steps };
    };
    const loop = () => { const s = state(); onTick(s); if (s.phase !== 'done') raf = requestAnimationFrame(loop); };
    return {
      play() { cancelAnimationFrame(raf); start = performance.now(); loop(); },
      finish() { cancelAnimationFrame(raf); start = performance.now() - (QUEUE + TOTAL / SPEED + 1) * 1000; loop(); },
    };
  }

  const fmt = (sec) => { const s = Math.floor(sec); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  window.RepevalSim = { STEPS, TOTAL, create, fmt };
})();
