'use client';

import { useEffect, useRef, useState } from 'react';
import type { Timeline } from 'animejs';
import { Icon, Logo } from './Sprite';

// The landing page's demo: a run of the demo shop, drawn in HTML and animated with anime.js on one
// timeline. It plays while on screen and pauses when scrolled away. Everything is seekable from the
// timeline's clock, so a voice-over can follow it: pass `audio` and it is kept in step with CUES.

/** When each scene starts, in ms, with the line it is about. Record a voice-over to these times. */
export const CUES = [
  { at: 0, scene: 'title', line: 'Tests for code you never tested.' },
  { at: 2800, scene: 'pick', line: 'Pick a repo and press Run.' },
  { at: 4800, scene: 'flow', line: 'Repeval reads the code, plans the tests, writes them and runs them, in your own GitHub Actions.' },
  { at: 15500, scene: 'bug', line: 'It found a real bug: the cart page throws an error.' },
  { at: 18800, scene: 'shots', line: 'Every page, photographed at desktop and phone width.' },
  { at: 21600, scene: 'privacy', line: 'Your code never leaves GitHub. Nothing is stored.' },
  { at: 24000, scene: 'end', line: 'Free and open source. Sign in with GitHub, or run npx repeval.' },
] as const;
const TOTAL = 27500;
const T3 = CUES[2].at;

/* ---------- the flow scene's layout, in world units ---------- */

const COL = 260;
const BW = 220;
const BH = 52;
const HEAD_H = 64;
const P = [130, 196, 262, 328, 394];
const A = [520, 586, 652];
const F = [776, 842, 908];

type Box = { id: string; col: number; y: number; title: string; sub: string; kind: string; state: string; lane?: string[] };
const HEADS = [
  ['Collect', 'copying repo', '4 source files'],
  ['Understand', 'reading code', '5 pages, 3 API, 3 functions'],
  ['Plan', 'choosing tests', '9 of 13 to test'],
  ['Make tests', 'writing tests', '4 test files'],
  ['Run', 'running tests', '10 passed · 1 possible bug'],
  ['Results', 'saving report', '8 screenshots, 1 report'],
];
const LABELS = [
  { col: 1, y: P[0] - 30, text: 'Pages · 5' },
  { col: 1, y: A[0] - 30, text: 'API · 3' },
  { col: 1, y: F[0] - 30, text: 'Functions · 3' },
];
const FILES: Box[] = [
  { id: 'f-help', col: 0, y: 300, title: 'public/help.html', sub: 'source file', kind: 'file', state: 'found' },
  { id: 'f-server', col: 0, y: 430, title: 'server.js', sub: 'source file', kind: 'file', state: 'found', lane: ['cart'] },
  { id: 'f-pricing', col: 0, y: 809, title: 'lib/pricing.js', sub: 'source file', kind: 'file', state: 'found' },
  { id: 'f-products', col: 0, y: 908, title: 'lib/products.js', sub: 'source file', kind: 'file', state: 'found' },
];
// One lane per thing found: [id, title, kind, row y, source file, skip reason, test file, result]
const LANES: [string, string, string, number, string, string | null, string, 'ok' | 'bug'][] = [
  ['home', '/', 'page', P[0], 'f-server', null, 't-pages', 'ok'],
  ['about', '/about', 'page', P[1], 'f-server', null, 't-pages', 'ok'],
  ['cart', '/cart', 'page', P[2], 'f-server', null, 't-pages', 'bug'],
  ['help', '/help.html', 'page', P[3], 'f-help', null, 't-pages', 'ok'],
  ['product', '/products/:id', 'page', P[4], 'f-server', 'needs example IDs', '', 'ok'],
  ['health', 'GET /api/health', 'endpoint', A[0], 'f-server', null, 't-api', 'ok'],
  ['products', 'GET /api/products', 'endpoint', A[1], 'f-server', null, 't-api', 'ok'],
  ['orders', 'POST /api/orders', 'endpoint', A[2], 'f-server', 'needs a request body', '', 'ok'],
  ['tax', 'applyTax()', 'function', F[0], 'f-pricing', null, 't-pricing', 'ok'],
  ['ship', 'isFreeShipping()', 'function', F[1], 'f-pricing', null, 't-pricing', 'ok'],
  ['find', 'findProduct()', 'function', F[2], 'f-products', null, 't-products', 'ok'],
];
const TESTS: Box[] = [
  { id: 't-pages', col: 3, y: (P[0] + P[3]) / 2, title: 'pages.spec.ts', sub: '4 tests', kind: 'test', state: 'passed', lane: ['cart'] },
  { id: 't-api', col: 3, y: (A[0] + A[1]) / 2, title: 'api.spec.ts', sub: '2 tests', kind: 'test', state: 'passed' },
  { id: 't-pricing', col: 3, y: (F[0] + F[1]) / 2, title: 'lib__pricing.test.ts', sub: '2 tests', kind: 'test', state: 'passed' },
  { id: 't-products', col: 3, y: F[2], title: 'lib__products.test.ts', sub: '1 test', kind: 'test', state: 'passed' },
];
const SHOTS: Record<string, string> = { home: '/img/home.png', about: '/img/about.png', cart: '/img/cart.png', help: '/img/help.png' };

const found = LANES.map(([id, title, kind, y, , , , ]): Box => ({ id: 'n-' + id, col: 1, y, title, sub: kind, kind: 'found', state: 'found', lane: [id] }));
const plans = LANES.map(([id, , , y, , skip, , ]): Box => ({
  id: 'p-' + id,
  col: 2,
  y,
  title: skip ? 'Skipped' : 'Test it',
  sub: skip ?? (y >= F[0] ? 'Vitest' : 'Playwright'),
  kind: 'plan',
  state: skip ? 'skip' : 'passed',
  lane: [id],
}));
const results = LANES.filter((l) => !l[5]).map(([id, , kind, y, , , , r]): Box => ({
  id: 'r-' + id,
  col: 4,
  y,
  title: r === 'bug' ? 'Possible bug' : 'Passed',
  sub: r === 'bug' ? 'cartTotal is not defined' : kind === 'page' ? 'loads, no errors' : kind === 'endpoint' ? 'answers, no server error' : 'loads, exported',
  kind: 'result',
  state: r === 'bug' ? 'bug' : 'passed',
  lane: [id],
}));
const REPORT: Box = { id: 'report', col: 5, y: P[4], title: 'Report', sub: '10 passed · 1 possible bug', kind: 'report', state: 'bug', lane: ['cart'] };

const X = (col: number) => col * COL;
const mid = (b: { y: number }) => b.y + BH / 2;

// Lines between boxes: right side of one to the left side of the next, with rounded corners.
function path(x1: number, y1: number, x2: number, y2: number) {
  if (Math.abs(y1 - y2) < 1) return `M${x1} ${y1}H${x2 - 6}`;
  const m = (x1 + x2) / 2;
  const r = Math.min(10, Math.abs(y2 - y1) / 2);
  const d = y2 > y1 ? 1 : -1;
  return `M${x1} ${y1}H${m - r}Q${m} ${y1} ${m} ${y1 + d * r}V${y2 - d * r}Q${m} ${y2} ${m + r} ${y2}H${x2 - 6}`;
}
type Line = { id: string; d: string; tone: 'ok' | 'bug' | 'skip'; lane?: string };
const LINES: Line[] = [];
HEADS.forEach((_, c) => c && LINES.push({ id: `l-h${c}`, d: path(X(c - 1) + BW, HEAD_H / 2, X(c), HEAD_H / 2), tone: 'ok' }));
FILES.forEach((f) =>
  LINES.push({ id: 'l-' + f.id, d: `M0 ${HEAD_H - 14}H-16Q-26 ${HEAD_H - 14} -26 ${HEAD_H - 4}V${mid(f) - 10}Q-26 ${mid(f)} -16 ${mid(f)}H-6`, tone: 'ok', lane: f.lane?.[0] }),
);
LANES.forEach(([id, , , y, file, skip, test, r]) => {
  const f = FILES.find((x) => x.id === file)!;
  const yy = y + BH / 2;
  LINES.push({ id: 'l-n-' + id, d: path(BW, mid(f), X(1), yy), tone: 'ok', lane: id });
  LINES.push({ id: 'l-p-' + id, d: path(X(1) + BW, yy, X(2), yy), tone: skip ? 'skip' : 'ok', lane: id });
  if (skip) return;
  const t = TESTS.find((x) => x.id === test)!;
  LINES.push({ id: 'l-t-' + id, d: path(X(2) + BW, yy, X(3), mid(t)), tone: 'ok', lane: id });
  LINES.push({ id: 'l-r-' + id, d: path(X(3) + BW, mid(t), X(4), yy), tone: r === 'bug' ? 'bug' : 'ok', lane: id });
  if (SHOTS[id]) LINES.push({ id: 'l-s-' + id, d: path(X(4) + BW, yy, X(5), yy), tone: r === 'bug' ? 'bug' : 'ok', lane: id });
});

// The camera, as the world's translate and scale inside the 1280 × 720 stage.
const CAM = {
  start: { x: 90, y: 112, s: 1 },
  down: { x: 90, y: -212, s: 1 },
  full: { x: 145, y: 104, s: 0.635 },
  cart: { x: -205, y: 120, s: 0.96 },
};

/* ---------- the timeline ---------- */

// Returned wrapped: a Timeline has a then(), so awaiting it would wait for a looping timeline to finish.
async function buildTimeline(root: HTMLElement, onTime: (ms: number) => void): Promise<{ tl: Timeline }> {
  const { createTimeline, stagger, svg } = await import('animejs');
  const q = (sel: string) => [...root.querySelectorAll<HTMLElement>(sel)];
  const one = (sel: string) => root.querySelector<HTMLElement>(sel)!;
  const tl = createTimeline({ autoplay: false, loop: true, defaults: { ease: 'out(3)' }, onUpdate: (t) => onTime(t.iterationCurrentTime) });
  const pop = (targets: HTMLElement[], at: number, each = 0) =>
    targets.length && tl.add(targets, { opacity: [0, 1], filter: ['blur(3px)', 'blur(0px)'], duration: 380, delay: each ? stagger(each) : 0 }, at);
  const draw = (ids: string[], at: number, each = 0) => {
    const els = ids.map((id) => root.querySelector<SVGPathElement>(`[data-line="${id}"]`)).filter((x): x is SVGPathElement => !!x);
    if (!els.length) return;
    // A line stays hidden until it starts drawing, or its arrowhead would show on its own.
    tl.add(els, { opacity: [0, 1], duration: 60, delay: each ? stagger(each) : 0 }, at);
    tl.add(svg.createDrawable(els), { draw: ['0 0', '0 1'], duration: 420, ease: 'inOut(2)', delay: each ? stagger(each) : 0 }, at);
  };
  const scene = (name: string, from: number, to: number) => {
    tl.add(one(`[data-scene="${name}"]`), { opacity: [0, 1], duration: 450, ease: 'out(2)' }, from);
    if (to < TOTAL) tl.add(one(`[data-scene="${name}"]`), { opacity: [1, 0], duration: 400, ease: 'in(2)' }, to - 400);
  };
  const head = (c: number, start: number, done: number, bug = false) => {
    const h = one(`[data-head="${c}"]`);
    pop([h], start);
    tl.add(h, { borderColor: ['#f5b83d', bug ? '#ff6b5e' : '#2c3a3d'], duration: 300 }, done);
    tl.add(h.querySelector<HTMLElement>('.t-run')!, { opacity: [1, 0], duration: 200 }, done);
    tl.add(h.querySelector<HTMLElement>('.t-done')!, { opacity: [0, 1], duration: 250 }, done + 120);
    if (c) draw([`l-h${c}`], start - 250);
  };
  const cam = (to: keyof typeof CAM, at: number, duration = 900) =>
    tl.add(one('.film-world'), { translateX: CAM[to].x, translateY: CAM[to].y, scale: CAM[to].s, duration, ease: 'inOut(3)' }, at);
  const ids = (prefix: string, list: { id: string }[]) => list.map((b) => q(`[data-box="${prefix}${b.id}"]`)[0]).filter(Boolean);

  // 1. Title
  scene('title', 0, CUES[1].at);
  pop(q('[data-scene="title"] .rise'), 150, 160);

  // 2. Pick a repo, press Run
  scene('pick', CUES[1].at, T3);
  pop(q('[data-scene="pick"] .rise'), CUES[1].at + 150, 90);
  tl.add(one('.film-cursor'), { translateX: [1120, 945], translateY: [600, 318], opacity: [0, 1], duration: 900, ease: 'inOut(3)' }, CUES[1].at + 500);
  tl.add(one('.film-run'), { scale: [1, 0.92, 1], duration: 260, ease: 'inOut(2)' }, CUES[1].at + 1450);
  tl.add(one('.film-run'), { backgroundColor: ['#2dd4bf', '#5eead4', '#2dd4bf'], duration: 260 }, CUES[1].at + 1450);

  // 3. The flow grows, stage by stage, and the camera follows it
  scene('flow', T3, CUES[3].at);
  tl.set(one('.film-world'), { translateX: CAM.start.x, translateY: CAM.start.y, scale: CAM.start.s }, T3);
  head(0, T3 + 200, T3 + 1400);
  pop(ids('', FILES), T3 + 600, 140);
  draw(FILES.map((f) => 'l-' + f.id), T3 + 600, 140);
  head(1, T3 + 1500, T3 + 3000);
  pop(q('.fg'), T3 + 1700, 360);
  pop(ids('', found), T3 + 1800, 90);
  draw(LANES.map((l) => 'l-n-' + l[0]), T3 + 1700, 90);
  cam('down', T3 + 2200, 1000);
  cam('full', T3 + 3100, 900);
  head(2, T3 + 3200, T3 + 4100);
  pop(ids('', plans), T3 + 3400, 50);
  draw(LANES.map((l) => 'l-p-' + l[0]), T3 + 3300, 50);
  head(3, T3 + 4200, T3 + 5000);
  pop(ids('', TESTS), T3 + 4400, 120);
  draw(LANES.map((l) => 'l-t-' + l[0]), T3 + 4300, 40);
  head(4, T3 + 5100, T3 + 6900, true);
  const order = ['tax', 'ship', 'find', 'home', 'about', 'cart', 'help', 'health', 'products'];
  order.forEach((id, i) => {
    pop([one(`[data-box="r-${id}"]`)], T3 + 5400 + i * 160);
    draw(['l-r-' + id], T3 + 5250 + i * 160);
  });
  head(5, T3 + 7000, T3 + 7900);
  ['home', 'about', 'cart', 'help'].forEach((id, i) => {
    pop([one(`[data-box="s-${id}"]`)], T3 + 7200 + i * 130);
    draw(['l-s-' + id], T3 + 7100 + i * 130);
  });
  pop([one('[data-box="report"]')], T3 + 7800);
  // The first possible bug lights up: its lane stays, everything else fades back.
  tl.add(q('.film-world [data-box]:not([data-lane~="cart"]):not([data-head])'), { opacity: 0.18, duration: 500 }, T3 + 8600);
  tl.add(q('.film-world [data-line]:not([data-lane="cart"]):not([data-line^="l-h"])'), { opacity: 0.12, duration: 500 }, T3 + 8600);
  tl.add(one('[data-box="r-cart"]'), { boxShadow: ['0 0 0 0px #eef3f2', '0 0 0 3px #eef3f2'], duration: 400 }, T3 + 8700);
  cam('cart', T3 + 8700, 1100);

  // 4. The bug, explained
  scene('bug', CUES[3].at, CUES[4].at);
  pop(q('[data-scene="bug"] .rise'), CUES[3].at + 200, 140);

  // 5. Every page, photographed
  scene('shots', CUES[4].at, CUES[5].at);
  pop(q('[data-scene="shots"] .rise'), CUES[4].at + 150, 120);

  // 6. Privacy
  scene('privacy', CUES[5].at, CUES[6].at);
  pop(q('[data-scene="privacy"] .rise'), CUES[5].at + 150, 220);

  // 7. End card, held until the loop starts again
  scene('end', CUES[6].at, TOTAL);
  pop(q('[data-scene="end"] .rise'), CUES[6].at + 150, 160);
  tl.add(one('[data-scene="end"]'), { opacity: [1, 0], duration: 400, ease: 'in(2)' }, TOTAL - 400);
  return { tl };
}

/* ---------- the stage ---------- */

function FlowBox({ b, prefix = '' }: { b: Box; prefix?: string }) {
  return (
    <div className={`fi ${b.kind} ${b.state}`} data-box={prefix + b.id} data-lane={b.lane?.join(' ')} style={{ left: X(b.col), top: b.y, width: BW }}>
      <b>{b.title}</b>
      <span>{b.sub}</span>
    </div>
  );
}

export function DemoFilm({ audio }: { audio?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const clock = useRef<HTMLElement>(null);
  const sound = useRef<HTMLAudioElement>(null);
  const tlRef = useRef<Timeline | null>(null);
  const [soundOn, setSoundOn] = useState(false);
  const soundOnRef = useRef(false);
  soundOnRef.current = soundOn;

  // Scale the 1280 × 720 stage to the box.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => el.style.setProperty('--k', String(el.clientWidth / 1280)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Build the timeline; play it while the film is on screen.
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    let io: IntersectionObserver | null = null;
    let dead = false;
    const onTime = (ms: number) => {
      // The run's clock in the top bar: about 41 seconds on GitHub, shown sped up.
      if (clock.current) {
        const s = Math.max(0, Math.min(41, Math.round(((ms - T3) / (CUES[3].at - T3 - 2000)) * 41)));
        clock.current.textContent = `0:${String(s).padStart(2, '0')}`;
      }
      // Keep the voice-over in step with the timeline, which is the master clock. `ms` is the time
      // within the current loop; the timeline's currentTime keeps counting across loops.
      const a = sound.current;
      if (a && soundOnRef.current && !a.paused && Math.abs(a.currentTime * 1000 - ms) > 250) a.currentTime = ms / 1000;
    };
    buildTimeline(el, onTime).then(({ tl }) => {
      if (dead) {
        tl.revert();
        return;
      }
      tlRef.current = tl;
      // Lets the dev server's browser tests seek the film; left out of production builds.
      if (process.env.NODE_ENV !== 'production') (window as unknown as { __film?: Timeline }).__film = tl;
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
        tl.seek(T3 + 10000); // A still of the finished flow with the bug lit up.
        return;
      }
      if (!('IntersectionObserver' in window)) {
        tl.play();
        return;
      }
      io = new IntersectionObserver(
        ([e]) => {
          const a = sound.current;
          if (e.isIntersecting) {
            tl.play();
            if (a && soundOnRef.current) {
              a.currentTime = tl.iterationCurrentTime / 1000;
              a.play().catch(() => setSoundOn(false));
            }
          } else {
            tl.pause();
            a?.pause();
          }
        },
        { threshold: 0.4 },
      );
      io.observe(el);
    });
    return () => {
      dead = true;
      io?.disconnect();
      tlRef.current?.revert();
      tlRef.current = null;
    };
  }, []);

  const toggleSound = () => {
    const a = sound.current;
    const tl = tlRef.current;
    if (!a || !tl) return;
    if (soundOn) {
      a.pause();
      setSoundOn(false);
    } else {
      a.currentTime = tl.iterationCurrentTime / 1000;
      setSoundOn(true);
      if (!tl.paused) a.play().catch(() => setSoundOn(false));
    }
  };

  return (
    <figure className="demo-video hero-video" aria-describedby="demoCap">
      <div className="film" ref={box}>
        <div className="film-stage" ref={stage} aria-hidden="true">
          {/* 1. Title */}
          <section data-scene="title" className="film-scene film-title">
            <span className="film-logo rise"><Logo /></span>
            <h3 className="rise">
              Tests for code
              <br />
              <em>you never tested</em>
            </h3>
            <p className="rise">Repeval writes and runs tests inside your own GitHub Actions.</p>
          </section>

          {/* 2. Pick a repo */}
          <section data-scene="pick" className="film-scene film-pick">
            <h3 className="rise">Pick a repo, press Run</h3>
            <div className="film-repos rise">
              {[
                ['you / demo-shop', 'Public · pushed 2 hours ago', true],
                ['you / portfolio-site', 'Public · pushed yesterday', false],
                ['you / ts-lib', 'Private · pushed last week', false],
              ].map(([name, meta, on]) => (
                <div className={'film-repo' + (on ? ' on' : '')} key={String(name)}>
                  <div>
                    <b>{name}</b>
                    <span>{meta}</span>
                  </div>
                  {on && <span className="film-run">Run</span>}
                </div>
              ))}
            </div>
            <svg className="film-cursor" viewBox="0 0 24 24" width="34" height="34">
              <path d="M4 2l15 9-7 1.5L9 20z" fill="#eef3f2" stroke="#070b0c" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
          </section>

          {/* 3. The flow */}
          <section data-scene="flow" className="film-scene film-flow">
            <div className="film-world">
              <svg className="film-lines" width="1600" height="1000" viewBox="-40 0 1600 1000" style={{ left: -40 }}>
                <defs>
                  {[
                    ['ok', '#2dd4bf'],
                    ['bug', '#ff6b5e'],
                    ['skip', '#56686a'],
                  ].map(([k, c]) => (
                    <marker key={k} id={`film-arrow-${k}`} viewBox="-10 -10 20 20" markerWidth="12" markerHeight="12" orient="auto">
                      <polyline points="-5,-4 0,0 -5,4 -5,-4" fill={c} stroke={c} />
                    </marker>
                  ))}
                </defs>
                {LINES.map((l) => (
                  <path
                    key={l.id}
                    data-line={l.id}
                    data-lane={l.lane}
                    d={l.d}
                    className={`film-line ${l.tone}`}
                    markerEnd={`url(#film-arrow-${l.tone})`}
                  />
                ))}
              </svg>
              {HEADS.map(([name, run, done], c) => (
                <div className="fh" data-head={c} data-box={'h' + c} key={name} style={{ left: X(c), top: 0, width: BW }}>
                  <span className="fh-name">{name}</span>
                  <span className={'fh-text' + (c === 4 ? ' bugtext' : '')}>
                    <span className="t-run">
                      <i /> {run}
                    </span>
                    <span className="t-done">
                      <i /> {done}
                    </span>
                  </span>
                </div>
              ))}
              {LABELS.map((l) => (
                <div className="fg" key={l.text} style={{ left: X(l.col), top: l.y }}>
                  {l.text}
                </div>
              ))}
              {[...FILES, ...found, ...plans, ...TESTS, ...results].map((b) => (
                <FlowBox b={b} key={b.id} />
              ))}
              {Object.entries(SHOTS).map(([id, src]) => {
                const lane = LANES.find((l) => l[0] === id)!;
                return (
                  <div className={`fs ${lane[7] === 'bug' ? 'bug' : 'passed'}`} data-box={'s-' + id} data-lane={id} key={id} style={{ left: X(5), top: lane[3], width: BW }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" />
                    <span>{lane[1]}</span>
                  </div>
                );
              })}
              <FlowBox b={REPORT} />
            </div>
            <header className="film-bar">
              <div>
                <b>you / demo-shop</b>
                <span>Run on main, on GitHub Actions</span>
              </div>
              <b className="film-clock" ref={clock}>
                0:00
              </b>
            </header>
          </section>

          {/* 4. The bug */}
          <section data-scene="bug" className="film-scene film-bug">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="rise" src="/img/cart-m.png" alt="" />
            <div>
              <span className="film-pill rise">● Possible bug on /cart</span>
              <h3 className="rise">The cart page throws an error</h3>
              <code className="rise">cartTotal is not defined</code>
              <p className="rise">Visitors see a $0.00 total under a $28.00 subtotal. Repeval found it first, and explains it in plain words.</p>
            </div>
          </section>

          {/* 5. Every page, photographed */}
          <section data-scene="shots" className="film-scene film-shots">
            <h3 className="rise">
              Every page, photographed <small>At desktop and phone width</small>
            </h3>
            <div className="film-grid">
              {LANES.filter((l) => SHOTS[l[0]]).map((l) => (
                <figure className={'rise' + (l[7] === 'bug' ? ' bug' : '')} key={l[0]}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={SHOTS[l[0]]} alt="" />
                  <figcaption>
                    <span>{l[1]}</span>
                    <span>{l[7] === 'bug' ? 'possible bug' : 'passed'}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>

          {/* 6. Privacy */}
          <section data-scene="privacy" className="film-scene film-privacy">
            <h3 className="rise">
              Your code never
              <br />
              leaves GitHub
            </h3>
            <p className="rise">Tests run in your own GitHub Actions.</p>
            <p className="rise">
              <em>No database. Nothing stored. Free and open source.</em>
            </p>
          </section>

          {/* 7. End card */}
          <section data-scene="end" className="film-scene film-end">
            <span className="film-logo big rise">
              <Logo />
            </span>
            <div className="film-ctas rise">
              <span className="film-btn">
                <Icon name="gh" /> Sign in with GitHub
              </span>
              <span className="film-btn code">npx repeval</span>
            </div>
            <p className="rise">repeval.vercel.app</p>
          </section>
        </div>
        {audio && (
          <>
            <audio ref={sound} src={audio} preload="auto" loop />
            <button type="button" className="film-sound" onClick={toggleSound} aria-pressed={soundOn}>
              {soundOn ? 'Sound on' : 'Turn sound on'}
            </button>
          </>
        )}
      </div>
      <figcaption id="demoCap">
        A run of the demo shop, start to finish{audio ? '.' : '. No sound.'}
      </figcaption>
    </figure>
  );
}
