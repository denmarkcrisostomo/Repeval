// The landing page's hero demo: a short run of the demo shop as one chain, animated with anime.js.
// Each stage is a box in the chain: it fans out to what it found or made, and those join into the next stage.
//   Sandbox → Checkout, Node → Analyze → files → pages and endpoints → Plan → … → Results → screenshots and report
// It grows while on screen (pausing when scrolled away), with the view panning along, in the page's own
// light or dark colours, on a dotted grid like React Flow's. Once grown, tap a box to light up everything it
// is connected to, drag to look around, and zoom or go full screen with the buttons.
// It is built as plain DOM inside one element, so React renders only that element.

import type { Timeline } from 'animejs';

type Anime = typeof import('animejs');

/** When each stage starts, in ms, and what a voice-over would say there. Record a voice-over to these times. */
export const CUES = [
  { at: 0, stage: 'sandbox', line: 'GitHub starts a fresh, temporary sandbox and copies your repo there. Repeval never receives your code.' },
  { at: 1500, stage: 'analyze', line: 'It reads your files and finds every page and endpoint in them.' },
  { at: 3700, stage: 'plan', line: "It plans the tests, and skips what it can't test yet, with the reason." },
  { at: 4700, stage: 'make', line: 'It writes real Playwright tests.' },
  { at: 5700, stage: 'run', line: 'Then it runs them, opening every page in a real browser.' },
  { at: 7100, stage: 'results', line: 'Every page is photographed, and the report is saved.' },
  { at: 8500, stage: 'bug', line: "And here's a real bug: the cart page throws an error." },
] as const;
const TOTAL = 9300;

/* ---------- the chain, in world units ---------- */

const W = 1280;
const H = 600;
const MID = H / 2;
const SW = 170; // stage box
const SH = 72;
const IW = 210; // item box
const IH = 50;
const GAP = 62; // spacing of a fan
const OUT = 170; // stage to its first fan
const BETWEEN = 150; // fan to fan, within a stage
const INTO = 130; // last fan to the next stage
const ALL = ['home', 'about', 'cart', 'help', 'product', 'health', 'products', 'orders'];
const TESTED = ['home', 'about', 'cart', 'help', 'health', 'products'];

interface Stage {
  id: string;
  name: string;
  run: string;
  done: string;
  bug?: boolean;
}
const STAGES: Stage[] = [
  { id: 'sandbox', name: 'Sandbox', run: 'copying your repo', done: 'ready' },
  { id: 'analyze', name: 'Analyze', run: 'reading code', done: '5 pages, 3 API' },
  { id: 'plan', name: 'Plan', run: 'choosing tests', done: '6 of 8 to test' },
  { id: 'make', name: 'Make tests', run: 'writing tests', done: '2 test files' },
  { id: 'run', name: 'Run', run: 'running tests', done: '5 passed · 1 bug', bug: true },
  { id: 'results', name: 'Results', run: 'saving report', done: '4 screenshots' },
];
// Each fan is a column of boxes: [id, title, sub, look, lanes it belongs to, screenshot]. Most stages have one;
// Analyze has two, the files it read and then what it found in them, each file joined to its finds.
type Item = [string, string, string, string, string[], string?];
const FANS: { stage: number; items: Item[] }[] = [
  {
    stage: 0,
    items: [
      ['b-checkout', 'Checkout', 'repo copied', 'passed', ALL],
      ['b-node', 'Node 22', 'installed', 'passed', ALL],
    ],
  },
  {
    stage: 1,
    items: [
      ['f-server', 'server.js', '7 found', 'file', ['home', 'about', 'cart', 'product', 'health', 'products', 'orders']],
      ['f-help', 'public/help.html', '1 found', 'file', ['help']],
    ],
  },
  {
    stage: 1,
    items: [
      ['n-home', '/', 'page', 'found', ['home']],
      ['n-about', '/about', 'page', 'found', ['about']],
      ['n-cart', '/cart', 'page', 'found', ['cart']],
      ['n-help', '/help.html', 'page', 'found', ['help']],
      ['n-product', '/products/:id', 'page', 'found', ['product']],
      ['n-health', 'GET /api/health', 'endpoint', 'found', ['health']],
      ['n-products', 'GET /api/products', 'endpoint', 'found', ['products']],
      ['n-orders', 'POST /api/orders', 'endpoint', 'found', ['orders']],
    ],
  },
  {
    stage: 2,
    items: [
      ['p-test', 'Test it · 6', '4 pages, 2 endpoints', 'passed', TESTED],
      ['p-skip', 'Skipped · 2', 'need example IDs or a body', 'skip', ['product', 'orders']],
    ],
  },
  {
    stage: 3,
    items: [
      ['t-pages', 'pages.spec.ts', '4 tests · Playwright', 'test passed', ['home', 'about', 'cart', 'help']],
      ['t-api', 'api.spec.ts', '2 tests · Playwright', 'test passed', ['health', 'products']],
    ],
  },
  {
    stage: 4,
    items: [
      ['r-pass', 'Passed · 5', 'no errors', 'passed', ['home', 'about', 'help', 'health', 'products']],
      ['r-cart', 'Possible bug', '/cart: cartTotal is not defined', 'bug', ['cart']],
    ],
  },
  {
    stage: 5,
    items: [
      ['s-home', '/', '', 'shot passed', ['home'], 'home'],
      ['s-about', '/about', '', 'shot passed', ['about'], 'about'],
      ['s-cart', '/cart', '', 'shot bug', ['cart'], 'cart'],
      ['s-help', '/help.html', '', 'shot passed', ['help'], 'help'],
      ['report', 'Report', '5 passed · 1 possible bug', 'bug', TESTED],
    ],
  },
];
// The skipped box doesn't lead anywhere: it stops at Plan's fan.
const DEAD_ENDS = new Set(['p-skip']);

interface Box {
  id: string;
  kind: 'stage' | 'item';
  x: number;
  y: number;
  w: number;
  h: number;
  lanes: string[] | null;
  stage?: Stage;
  title?: string;
  sub?: string;
  look?: string;
  shot?: string;
}
// Left to right: a stage, its fans, then the next stage.
const SX: number[] = [];
const FX: number[] = [];
{
  let x = 0;
  STAGES.forEach((_, i) => {
    SX[i] = x;
    x += SW + OUT;
    FANS.forEach((f, j) => {
      if (f.stage !== i) return;
      FX[j] = x;
      x += IW + BETWEEN;
    });
    x += INTO - BETWEEN;
  });
}
const lastFan = (i: number) => FANS.reduce((n, f, j) => (f.stage === i ? j : n), -1);

const BOXES: Box[] = [];
STAGES.forEach((s, i) => BOXES.push({ id: 's:' + s.id, kind: 'stage', x: SX[i], y: MID - SH / 2, w: SW, h: SH, lanes: null, stage: s }));
FANS.forEach((fan, j) => {
  const top = MID - ((fan.items.length - 1) * GAP) / 2 - IH / 2;
  fan.items.forEach(([id, title, sub, look, lanes, shot], k) => BOXES.push({ id, kind: 'item', x: FX[j], y: top + k * GAP, w: IW, h: IH, title, sub, look, lanes, shot }));
});
const BOX: Record<string, Box> = Object.fromEntries(BOXES.map((b) => [b.id, b]));
const WORLD_W = FX[FANS.length - 1] + IW;

// Curved lines: a stage to its first fan, a file to what was found in it, and the last fan of a stage into the
// next stage. Each line belongs to the box it points at (`to`), so it draws in with that box.
const curve = (a: Box, b: Box) => {
  const x1 = a.x + a.w, y1 = a.y + a.h / 2, x2 = b.x - 6, y2 = b.y + b.h / 2, c = (x2 - x1) * 0.5;
  return `M${x1} ${y1}C${x1 + c} ${y1} ${x2 - c} ${y2} ${x2} ${y2}`;
};
type Line = { id: string; d: string; tone: 'ok' | 'bug' | 'skip'; lanes: string[]; to?: string };
const LINES: Line[] = [];
FANS.forEach((fan, j) => {
  const i = fan.stage;
  const prev = j > 0 && FANS[j - 1].stage === i ? FANS[j - 1] : null;
  const next = j === lastFan(i) && STAGES[i + 1] ? BOX['s:' + STAGES[i + 1].id] : null;
  fan.items.forEach(([id, , , look, lanes]) => {
    const tone = look.includes('bug') ? 'bug' : look === 'skip' ? 'skip' : 'ok';
    if (prev)
      for (const p of prev.items) if (p[4].some((l) => lanes.includes(l))) LINES.push({ id: `l-out-${p[0]}-${id}`, d: curve(BOX[p[0]], BOX[id]), tone, lanes, to: id });
    if (!prev) LINES.push({ id: `l-out-${id}`, d: curve(BOX['s:' + STAGES[i].id], BOX[id]), tone, lanes, to: id });
    if (next && !DEAD_ENDS.has(id)) LINES.push({ id: `l-in-${id}`, d: curve(BOX[id], next), tone: tone === 'bug' ? 'bug' : 'ok', lanes });
  });
});

/* ---------- the camera ---------- */

/** How far out the view sits while it grows: about three stages at a time. */
const ZOOM = 0.6;
const tyOf = (z: number) => (H - z * H) / 2; // keeps the chain centred vertically
/** Centred on stage i and its fans. */
const at = (i: number, s = ZOOM) => W / 2 - (s * (SX[i] + FX[lastFan(i)] + IW)) / 2;
// The ends of the chain stop short of the stage's faded edges (12% each side), so they never look washed out.
const EDGE = W * 0.13;
const clampX = (x: number, s: number) =>
  s * WORLD_W <= W - 2 * EDGE ? (W - s * WORLD_W) / 2 : Math.min(EDGE, Math.max(W - EDGE - s * WORLD_W, x));
// The zoom buttons go from the whole chain at once to 120%.
const MIN_ZOOM = (W - 2 * EDGE) / WORLD_W;
const MAX_ZOOM = 1.2;

/* ---------- markup ---------- */

const img = (name: string) => `<img class="for-light" src="/img/${name}.png" alt=""><img class="for-dark" src="/img/${name}-dark.png" alt="">`;
function boxHtml(b: Box) {
  const pos = `style="left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px"`;
  if (b.stage) {
    const s = b.stage;
    return `<div class="fst" data-box="${b.id}" ${pos}><i class="ring run"></i>${s.bug ? '<i class="ring bug"></i>' : ''}<b>${s.name}</b><span class="fst-text${s.bug ? ' bugtext' : ''}"><span class="t-run"><i></i>${s.run}</span><span class="t-done"><i></i>${s.done}</span></span></div>`;
  }
  const attrs = `data-box="${b.id}" role="button" tabindex="-1" aria-label="${b.title}${b.sub ? ': ' + b.sub : ''}" ${pos}`;
  if (b.shot) return `<div class="fsh ${b.look!.split(' ')[1]}" ${attrs}>${img(b.shot)}<span>${b.title}</span></div>`;
  return `<div class="fb ${b.look}" ${attrs}><b>${b.title}</b><span>${b.sub}</span></div>`;
}
function markup() {
  const marker = (k: string) =>
    `<marker id="film-arrow-${k}" viewBox="-10 -10 20 20" markerWidth="12" markerHeight="12" orient="auto"><polyline class="tip ${k}" points="-5,-4 0,0 -5,4 -5,-4"/></marker>`;
  // React Flow's dotted background, drawn the way React Flow draws it: an SVG pattern in screen pixels.
  return `<svg class="film-dots" aria-hidden="true"><pattern id="film-dot-grid" patternUnits="userSpaceOnUse"><circle/></pattern><rect width="100%" height="100%" fill="url(#film-dot-grid)"/></svg>
<div class="film-stage" role="group" aria-label="A run of the demo shop as a flow. Tap a box to follow it, drag to look around.">
  <div class="film-centre">
  <div class="film-world" style="width:${WORLD_W}px">
    <svg class="film-lines" width="${WORLD_W}" height="${H}" aria-hidden="true"><defs>${['ok', 'bug', 'skip'].map(marker).join('')}</defs>${LINES.map(
      (l) => `<path data-line="${l.id}" d="${l.d}" class="film-line ${l.tone}" marker-end="url(#film-arrow-${l.tone})"/>`,
    ).join('')}</svg>
    ${BOXES.map(boxHtml).join('')}
    <i class="film-sel" aria-hidden="true"></i>
  </div>
  </div>
</div>`;
}

/* ---------- the growth timeline ---------- */

function grow(root: HTMLElement, anime: Anime, onTime: (ms: number) => void, onDone: () => void): Timeline {
  const { createTimeline, stagger, svg } = anime;
  const one = (sel: string) => root.querySelector<HTMLElement>(sel)!;
  const tl = createTimeline({ autoplay: false, defaults: { ease: 'out(3)' }, onUpdate: (t) => onTime(t.currentTime), onComplete: onDone });
  const pop = (targets: HTMLElement[], t: number, each = 0) =>
    targets.length && tl.add(targets, { opacity: [0, 1], filter: ['blur(3px)', 'blur(0px)'], duration: 380, delay: each ? stagger(each) : 0 }, t);
  const draw = (ids: string[], t: number, each = 0) => {
    const els = ids.map((id) => root.querySelector<SVGPathElement>(`[data-line="${id}"]`)).filter((x): x is SVGPathElement => !!x);
    if (!els.length) return;
    // A line stays hidden until it starts drawing, or its arrowhead would show on its own.
    tl.add(els, { opacity: [0, 1], duration: 60, delay: each ? stagger(each) : 0 }, t);
    tl.add(svg.createDrawable(els), { draw: ['0 0', '0 1'], duration: 420, ease: 'inOut(2)', delay: each ? stagger(each) : 0 }, t);
  };
  // A stage starts amber (running) and turns to done. Only opacity animates, so colours follow the theme.
  const stage = (i: number, start: number, done: number) => {
    const el = one(`[data-box="s:${STAGES[i].id}"]`);
    pop([el], start);
    tl.add(el.querySelector<HTMLElement>('.ring.run')!, { opacity: [1, 0], duration: 300 }, done);
    const bug = el.querySelector<HTMLElement>('.ring.bug');
    if (bug) tl.add(bug, { opacity: [0, 1], duration: 300 }, done);
    tl.add(el.querySelector<HTMLElement>('.t-run')!, { opacity: [1, 0], duration: 200 }, done);
    tl.add(el.querySelector<HTMLElement>('.t-done')!, { opacity: [0, 1], duration: 250 }, done + 120);
  };
  // A fan's boxes pop in one after another, each with the lines that point at it.
  const fan = (j: number, t: number, each: number) =>
    FANS[j].items.forEach(([id], k) => {
      draw(LINES.filter((l) => l.to === id).map((l) => l.id), t - 100 + k * each);
      pop([one(`[data-box="${id}"]`)], t + k * each);
    });
  const join = (j: number, t: number) => draw(FANS[j].items.map((f) => 'l-in-' + f[0]), t, 40);
  const cam = (i: number, t: number) =>
    tl.add(one('.film-world'), { translateX: clampX(at(i), ZOOM), translateY: tyOf(ZOOM), scale: ZOOM, duration: 900, ease: 'inOut(3)' }, t);

  tl.set(one('.film-world'), { translateX: clampX(at(0), ZOOM), translateY: tyOf(ZOOM), scale: ZOOM }, 0);
  stage(0, 100, 1100); // Sandbox: Checkout, then Node
  fan(0, 400, 300);
  join(0, 1200);
  cam(1, 1200);
  stage(1, 1500, 3300); // Analyze: the files, then what was found in each
  fan(1, 1800, 250);
  fan(2, 2400, 100);
  join(2, 3400);
  cam(2, 3400);
  stage(2, 3700, 4400);
  fan(3, 3900, 200);
  join(3, 4500);
  cam(3, 4500);
  stage(3, 4700, 5400);
  fan(4, 4900, 200);
  join(4, 5500);
  cam(4, 5500);
  stage(4, 5700, 6800);
  fan(5, 6000, 450);
  join(5, 6900);
  cam(5, 6900);
  stage(5, 7100, 7900);
  fan(6, 7300, 120);
  return tl;
}

/* ---------- mounting ---------- */

const ICONS = {
  in: 'M12 5v14M5 12h14',
  out: 'M5 12h14',
  full: 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5',
  exit: 'M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5',
};
const icon = (d: string) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;

/**
 * Builds the demo inside `el` (its parent gets the zoom and full-screen buttons). Pass `audio` for a
 * voice-over that follows the growth. Returns a function that takes it all down again.
 */
export function mountHeroFlow(el: HTMLElement, loadAnime: () => Promise<Anime>, opts: { audio?: string } = {}): () => void {
  el.innerHTML = markup();
  const stageEl = el.querySelector<HTMLElement>('.film-stage')!;
  const world = el.querySelector<HTMLElement>('.film-world')!;
  const sel = el.querySelector<HTMLElement>('.film-sel')!;
  const pattern = el.querySelector<SVGPatternElement>('#film-dot-grid')!;
  const dot = pattern.querySelector('circle')!;
  const host = el.parentElement!;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const off: (() => void)[] = [];
  const on = <K extends keyof HTMLElementEventMap>(t: HTMLElement, type: K, fn: (e: HTMLElementEventMap[K]) => void) => {
    t.addEventListener(type, fn);
    off.push(() => t.removeEventListener(type, fn));
  };

  // The stage is always 1280 wide, scaled to the box. Its height follows the box (in the hero, as tall as the
  // text beside it); the chain stays centred in it, so a taller box only adds room above and below.
  const centre = el.querySelector<HTMLElement>('.film-centre')!;
  let k = 0.5;
  let offY = 0;
  const ro = new ResizeObserver(() => {
    k = el.clientWidth / W;
    const stageH = el.clientHeight / k || H;
    offY = (stageH - H) / 2;
    el.style.setProperty('--k', String(k));
    stageEl.style.height = `${stageH}px`;
    centre.style.top = `${offY}px`;
    syncDots();
  });
  ro.observe(el);
  off.push(() => ro.disconnect());

  let anime: Anime | null = null;
  let tl: Timeline | null = null;
  let ready = false;
  let selected: string | null = null;
  let viewX = 0; // the world's translateX once interactive
  let zoom = ZOOM;

  // An optional voice-over. The timeline is the master clock; the audio follows it.
  let audio: HTMLAudioElement | null = null;
  let soundOn = false;
  if (opts.audio) {
    const a = Object.assign(document.createElement('audio'), { src: opts.audio, preload: 'auto' });
    const btn = Object.assign(document.createElement('button'), { type: 'button', className: 'film-sound', textContent: 'Turn sound on' });
    host.append(a, btn);
    off.push(() => (a.remove(), btn.remove()));
    audio = a;
    on(btn, 'click', () => {
      soundOn = !soundOn;
      btn.textContent = soundOn ? 'Sound on' : 'Turn sound on';
      btn.setAttribute('aria-pressed', String(soundOn));
      if (!soundOn || ready) return a.pause();
      a.currentTime = tl ? tl.currentTime / 1000 : 0;
      if (tl && !tl.paused) a.play().catch(() => (soundOn = false));
    });
  }

  // The dots copy React Flow's <Background variant="dots" gap={20} size={1.6} /> on the run page: spacing and
  // size both scale with the zoom, and at the starting view they match the run flow at its usual zoom (0.85).
  function syncDots() {
    const m = new DOMMatrix(getComputedStyle(world).transform);
    const z = (0.85 * m.a) / ZOOM;
    const gap = 20 * z;
    const r = (1.6 * z) / 2;
    pattern.setAttribute('x', String((m.e * k) % gap));
    pattern.setAttribute('y', String(((m.f + offY) * k) % gap));
    pattern.setAttribute('width', String(gap));
    pattern.setAttribute('height', String(gap));
    pattern.setAttribute('patternTransform', `translate(-${r},-${r})`);
    dot.setAttribute('cx', String(r));
    dot.setAttribute('cy', String(r));
    dot.setAttribute('r', String(r));
  }
  const onTime = (ms: number) => {
    syncDots();
    if (audio && soundOn && !audio.paused && Math.abs(audio.currentTime * 1000 - ms) > 250) audio.currentTime = ms / 1000;
  };

  /* ---------- tapping a box lights everything it is connected to ---------- */
  const allBoxes = [...world.querySelectorAll<HTMLElement>('[data-box]')];
  const allLines = [...world.querySelectorAll<SVGPathElement>('[data-line]')];
  const lineLanes: Record<string, string[]> = Object.fromEntries(LINES.map((l) => [l.id, l.lanes]));
  function moveTo(x: number, duration: number) {
    viewX = clampX(x, zoom);
    anime!.animate(world, { translateX: viewX, translateY: tyOf(zoom), scale: zoom, duration: reduce ? 0 : duration, ease: 'inOut(3)', onUpdate: syncDots, onComplete: syncDots });
    syncControls();
  }
  function light(id: string | null, follow = true) {
    selected = id;
    const want = id ? new Set(BOX[id].lanes) : null;
    const lit = (lanes: string[] | null) => !want || !lanes || lanes.some((l) => want.has(l));
    const d = reduce ? 0 : 320;
    allBoxes.forEach((b) => anime!.animate(b, { opacity: lit(BOX[b.dataset.box!].lanes) ? 1 : 0.2, duration: d }));
    allLines.forEach((l) => anime!.animate(l, { opacity: lit(lineLanes[l.dataset.line!]) ? 1 : 0.12, duration: d }));
    if (!id) {
      anime!.animate(sel, { opacity: 0, duration: d });
      return;
    }
    const b = BOX[id];
    anime!.animate(sel, { left: b.x - 4, top: b.y - 4, width: b.w + 8, height: b.h + 8, opacity: 1, duration: d && sel.style.opacity === '1' ? d : 0 });
    if (follow) moveTo(W / 2 - zoom * (b.x + b.w / 2), 600);
  }
  // When the run has grown: the first possible bug lights up, like on the real run page.
  function finish() {
    if (ready) return;
    ready = true;
    el.classList.add('ready');
    allBoxes.forEach((b) => b.hasAttribute('role') && (b.tabIndex = 0));
    audio?.pause();
    zoom = ZOOM;
    viewX = clampX(at(5), ZOOM);
    light('r-cart', false);
    moveTo(at(5), 700); // Results, with the bug before it and the screenshots it ends in
  }
  const finishNow = () => {
    if (!ready && tl) {
      tl.seek(TOTAL);
      finish();
    }
  };
  function tap(target: Element) {
    if (!anime) return;
    finishNow();
    const box = target.closest<HTMLElement>('[data-box][role]');
    light(box && selected !== box.dataset.box ? box.dataset.box! : null);
  }

  // Drag to look around; a press that doesn't move is a tap.
  let drag: { x: number; from: number; moved: boolean } | null = null;
  on(stageEl, 'pointerdown', (e) => {
    if (!ready) return;
    drag = { x: e.clientX, from: viewX, moved: false };
    stageEl.setPointerCapture(e.pointerId);
  });
  on(stageEl, 'pointermove', (e) => {
    if (!drag || !anime) return;
    const dx = (e.clientX - drag.x) / k;
    if (Math.abs(dx) > 6) drag.moved = true;
    if (!drag.moved) return;
    viewX = clampX(drag.from + dx, zoom);
    anime.animate(world, { translateX: viewX, duration: 0, onComplete: syncDots });
  });
  on(stageEl, 'pointerup', (e) => {
    const d = drag;
    drag = null;
    if (d && !d.moved) tap(document.elementFromPoint(e.clientX, e.clientY) || stageEl);
  });
  on(stageEl, 'click', (e) => {
    if (!ready) tap(e.target as Element);
  });
  on(stageEl, 'keydown', (e) => {
    const t = e.target as Element;
    if ((e.key === 'Enter' || e.key === ' ') && t.closest('[data-box][role]')) {
      e.preventDefault();
      tap(t);
    }
  });

  /* ---------- zoom in, zoom out, full screen ---------- */
  // The buttons sit outside the film, so its faded edges never fade them.
  const controls = document.createElement('div');
  controls.className = 'film-controls';
  controls.innerHTML =
    `<button type="button" data-zoom="in" aria-label="Zoom in" title="Zoom in">${icon(ICONS.in)}</button>` +
    `<button type="button" data-zoom="out" aria-label="Zoom out" title="Zoom out">${icon(ICONS.out)}</button>` +
    (document.fullscreenEnabled ? `<button type="button" data-full aria-label="Full screen" title="Full screen">${icon(ICONS.full)}</button>` : '');
  host.appendChild(controls);
  off.push(() => controls.remove());
  function setZoom(z: number) {
    if (!anime) return;
    finishNow();
    const centre = (W / 2 - viewX) / zoom; // the world point in the middle stays there
    zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
    moveTo(W / 2 - centre * zoom, reduce ? 0 : 300);
  }
  function syncControls() {
    controls.querySelector<HTMLButtonElement>('[data-zoom="in"]')!.disabled = zoom >= MAX_ZOOM - 0.001;
    controls.querySelector<HTMLButtonElement>('[data-zoom="out"]')!.disabled = zoom <= MIN_ZOOM + 0.001;
  }
  on(controls, 'click', (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>('button');
    if (!b) return;
    if (b.dataset.zoom) return setZoom(zoom * (b.dataset.zoom === 'in' ? 1.25 : 0.8));
    if (document.fullscreenElement === host) document.exitFullscreen();
    else host.requestFullscreen().catch(() => undefined);
  });
  const onFull = () => {
    const full = document.fullscreenElement === host;
    const b = controls.querySelector<HTMLButtonElement>('[data-full]');
    if (!b) return;
    b.innerHTML = icon(full ? ICONS.exit : ICONS.full);
    b.setAttribute('aria-label', full ? 'Exit full screen' : 'Full screen');
    b.title = full ? 'Exit full screen' : 'Full screen';
  };
  document.addEventListener('fullscreenchange', onFull);
  off.push(() => document.removeEventListener('fullscreenchange', onFull));

  /* ---------- start ---------- */
  let dead = false;
  let io: IntersectionObserver | null = null;
  loadAnime().then(
    (a) => {
      if (dead) return;
      anime = a;
      tl = grow(stageEl, a, onTime, finish);
      // Lets the dev server's browser tests drive the demo; left out of production builds.
      if (process.env.NODE_ENV !== 'production') (window as unknown as { __film?: Timeline }).__film = tl;
      if (reduce) {
        tl.seek(TOTAL);
        finish();
        return;
      }
      io = new IntersectionObserver(
        ([e]) => {
          if (ready || !tl) return;
          if (e.isIntersecting) {
            tl.play();
            if (audio && soundOn) {
              audio.currentTime = tl.currentTime / 1000;
              audio.play().catch(() => (soundOn = false));
            }
          } else {
            tl.pause();
            audio?.pause();
          }
        },
        { threshold: 0.4 },
      );
      io.observe(el);
    },
    () => {
      // anime.js didn't load: show the end of the chain, still.
      el.classList.add('failed');
      world.style.transform = `translate(${clampX(at(5), ZOOM)}px, ${tyOf(ZOOM)}px) scale(${ZOOM})`;
      syncDots();
    },
  );

  return () => {
    dead = true;
    io?.disconnect();
    tl?.revert();
    off.forEach((f) => f());
    if (document.fullscreenElement === host) document.exitFullscreen().catch(() => undefined);
    el.innerHTML = '';
  };
}
