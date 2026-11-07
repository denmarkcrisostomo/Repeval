'use client';

import '@xyflow/react/dist/style.css';
import {
  Background,
  BackgroundVariant,
  ControlButton,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeChange,
  type NodeProps,
  type ReactFlowInstance,
} from '@xyflow/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { LoadedReport, ReportTest } from '@/lib/report-client';
import { STEPS } from '@/lib/steps';
import type { Progress, RunStep } from '@/lib/types';

// The run as one chain (React Flow, MIT), like the hero demo: each stage is a box in the line; it fans out to
// what it found or made, and those join into the next stage.
//   Sandbox → files → Analyze → pages, endpoints, functions → Plan → Test it · N / Skipped · N
//   → Make tests → test files → Run → Passed · N / each possible bug or broken test → Results → screenshots and report
// Boxes that are alike are grouped; every problem gets its own box. A stage's box appears when it starts. With workflow v3 the run shares a names-only progress file after
// Analyze, Plan and Generate, so the lanes grow out while it runs; the results follow with the report.
// Older workflows share nothing, so there the lanes all grow out once the report arrives.
// When the run is over, the first possible bug is lit up.

const STAGES = [
  { id: 'sandbox', name: 'Sandbox', text: 'A fresh, temporary GitHub machine. Your code is copied here, never to Repeval, and the machine is deleted after the run.' },
  { id: 'understand', name: 'Analyze', stage: 'Understand', text: 'Reads your code to find every page, API endpoint and exported function, and how to start the app.' },
  { id: 'plan', name: 'Plan', text: "Decides what to test. Anything it can't test yet is skipped with the reason, never silently dropped." },
  { id: 'make', name: 'Make tests', text: 'Writes real test files: Vitest for your functions, Playwright for your pages and API.' },
  { id: 'run', name: 'Run', text: 'Runs the unit tests, then starts your app and opens every page in a real browser.' },
  { id: 'results', name: 'Results', text: 'Saves the report and screenshots in your repo for 7 days. The machine is then deleted.' },
].map((st) => ({ ...st, steps: STEPS.filter((s) => s.stage === ('stage' in st ? st.stage : st.name)) }));
type StageId = (typeof STAGES)[number]['id'];
type StageStatus = 'waiting' | 'running' | 'passed' | 'bug' | 'skipped';

/* ---------- the report → one lane per thing found ---------- */

type Group = 'Pages' | 'API' | 'Code';
type Result = 'passed' | 'bug' | 'broken';
interface Lane {
  id: string;
  group: Group;
  label: string;
  kind: string;
  source: string;
  framework: string;
  test?: string;
  skip?: string;
  skipInfo?: string;
  result?: Result;
  resultText?: string;
  resultInfo?: string;
  shot?: string | null;
}
interface Model {
  lanes: Lane[];
  files: string[];
  tests: string[];
  load: { from: string[]; label: string; sub: string; info: string } | null;
  /** What each finished stage's box says, for the stages the data covers so far. */
  done: Partial<Record<StageId, string>>;
  hasBug: boolean;
  /** How far the data reaches, on the same 0..1 scale as the reveal: Understand, Plan, Make tests or everything. */
  level: number;
}

const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const base = (p: string) => p.split('/').pop() ?? p;
// "dynamic route: needs example parameters (AI mode)" → "needs example parameters"
const short = (note?: string) => (note ?? 'skipped').replace(/\s*\([^)]*\)\s*$/, '').split(': ').pop()!;
// "Error: browser errors on this page: Uncaught error: cartTotal is not defined" → "cartTotal is not defined"
const firstLine = (msg?: string) => (msg ?? '').split('\n')[0].replace(/^Error:\s*/, '').trim();
const GROUP_OF = { page: 'Pages', endpoint: 'API', function: 'Code' } as const;
const RANK: Record<ReportTest['status'], number> = { 'possible-bug': 0, broken: 1, passed: 2, skipped: 3 };

function skipLane(lane: Lane, reason?: string) {
  lane.skip = short(reason);
  lane.skipInfo = reason ? `Skipped: ${reason}.` : 'Skipped.';
}

function setResult(lane: Lane, t: ReportTest, note?: string) {
  lane.result = t.status === 'passed' ? 'passed' : t.status === 'possible-bug' ? 'bug' : 'broken';
  if (lane.result === 'passed') {
    lane.resultText = lane.group === 'Pages' ? 'loads, no errors' : lane.group === 'API' ? 'answers, no server error' : 'loads, exported';
    lane.resultInfo = `${lane.label}: ${lane.resultText}.${note ? ` Note: ${note}.` : ''}`;
  } else if (lane.result === 'bug') {
    lane.resultText = firstLine(t.message).split(': ').pop() || 'see the report';
    lane.resultInfo = `The test ran and your app did something wrong. ${firstLine(t.message) || 'The report has the details.'}`;
  } else {
    lane.resultText = 'the test itself failed';
    lane.resultInfo = "The generated test couldn't run. This is Repeval's problem, not your app's: please report it.";
  }
}

/** Lanes while the run is going, from the names-only progress file. */
function lanesFromProgress(p: Progress) {
  const plan = p.plan ? new Map(p.plan.map((t) => [t.id, t])) : null;
  const testOf = new Map<string, string>();
  for (const f of p.tests ?? []) for (const id of f.targets) testOf.set(id, f.file);
  const lanes = p.found.map((f): Lane => {
    const group = GROUP_OF[f.kind];
    const lane: Lane = { id: f.id, group, label: f.label, kind: f.kind, source: f.source, framework: group === 'Code' ? 'Vitest' : 'Playwright' };
    const t = plan?.get(f.id);
    if (plan && !t) {
      lane.skip = 'not in this run';
      lane.skipInfo = 'Not part of the tests picked for this run.';
    } else if (t && !t.enabled) skipLane(lane, t.reason);
    lane.test = testOf.get(f.id);
    return lane;
  });
  const loads = (p.plan ?? []).filter((t) => t.id.startsWith('load:')).map((t) => ({ target: t.id, note: t.reason }));
  return { lanes, loads };
}

/** Lanes once the report is in: one per page, endpoint or function, however many tests it had. */
function lanesFromReport(report: LoadedReport) {
  const generated = report.tests.map((f) => base(f.path));
  const unitFile = (src: string) => {
    const stem = src.replace(/\.[^./]+$/, '').replace(/\//g, '__');
    return generated.find((g) => g.startsWith(stem + '.test.')) ?? `${stem}.test.ts`;
  };
  const byTarget = new Map<string, ReportTest[]>();
  const modules: ReportTest[] = [];
  const loads: ReportTest[] = [];
  for (const t of report.results.tests) {
    if (t.suite === 'load') loads.push(t);
    // "file loads without errors" checks have no lane of their own; a failure shows on that file's functions.
    else if (t.suite === 'unit' && !t.target) modules.push(t);
    else {
      const id = t.target ?? t.id;
      byTarget.set(id, [...(byTarget.get(id) ?? []), t]);
    }
  }
  const lanes = [...byTarget].map(([id, list]): Lane => {
    const worst = [...list].sort((a, b) => RANK[a.status] - RANK[b.status])[0];
    const group: Group = worst.suite === 'e2e' ? 'Pages' : worst.suite === 'api' ? 'API' : 'Code';
    const source = worst.source ?? (group === 'Code' ? worst.file : undefined) ?? 'your app';
    const lane: Lane = {
      id,
      group,
      source,
      framework: group === 'Code' ? 'Vitest' : 'Playwright',
      label: group === 'Code' ? worst.title.split(' › ')[0] : worst.target ? id.replace(/^(page|api):/, '') : worst.title,
      kind: group === 'Pages' ? 'page' : group === 'API' ? 'endpoint' : 'function',
    };
    if (worst.status === 'skipped') skipLane(lane, worst.note);
    else {
      lane.test = group === 'Code' ? unitFile(source) : base(worst.file ?? 'tests');
      setResult(lane, worst, list.find((t) => t.note)?.note);
      const shots = list.find((t) => t.screenshots.length)?.screenshots;
      if (group === 'Pages' && shots) lane.shot = report.image(shots.find((x) => x.includes('desktop')) ?? shots[0]);
    }
    return lane;
  });
  for (const m of modules) {
    if (m.status !== 'possible-bug' && m.status !== 'broken') continue;
    for (const l of lanes) if (l.group === 'Code' && l.source === (m.source ?? m.file) && l.result === 'passed') setResult(l, m);
  }
  return { lanes, loads };
}

function modelOf(progress: Progress | null, report: LoadedReport | null): Model | null {
  if (!report && !progress) return null;
  const { lanes, loads } = report ? lanesFromReport(report) : lanesFromProgress(progress!);
  // Same order as the progress file, so nothing reshuffles when the report arrives. Each source file's
  // functions stay together, so their lines don't cross.
  const order: Group[] = ['Pages', 'API', 'Code'];
  const known = new Map(progress?.found.map((f, i) => [f.id, i]) ?? []);
  const at = new Map(lanes.map((l, i) => [l.id, known.get(l.id) ?? 100_000 + i]));
  lanes.sort(
    (a, b) => order.indexOf(a.group) - order.indexOf(b.group) || (a.group === 'Code' ? a.source.localeCompare(b.source) : 0) || at.get(a.id)! - at.get(b.id)!,
  );

  const files = [...new Set(lanes.map((l) => l.source))];
  const testFiles = [...new Set(lanes.flatMap((l) => (l.test ? [l.test] : [])))];
  const load = loads.length
    ? {
        from: lanes.filter((l) => loads.some((t) => t.target === `load:${l.label}`)).map((l) => l.id),
        label: plural(loads.length, 'load test'),
        sub: /later release/.test(loads[0].note ?? '') ? 'k6, in a later release' : short(loads[0].note),
        info: loads[0].note ? `Load tests: ${loads[0].note}.` : 'Load tests.',
      }
    : null;
  const count = (g: Group) => lanes.filter((l) => l.group === g).length;
  const found = [count('Pages') && plural(count('Pages'), 'page'), count('API') && `${count('API')} API`, count('Code') && plural(count('Code'), 'function')].filter(Boolean);
  const planKnown = !!report || !!progress?.plan;
  const testsKnown = !!report || !!progress?.tests;
  const done: Model['done'] = {
    sandbox: 'ready',
    understand: found.length ? found.join(', ') : 'nothing to test found',
  };
  if (planKnown) done.plan = `${lanes.filter((l) => !l.skip).length} of ${lanes.length + loads.length} to test`;
  if (testsKnown) done.make = plural(testFiles.length, 'test file');
  const summary = report?.results.summary;
  if (summary && report) {
    // Counted like the Run stage's boxes: pages, endpoints and functions, not individual tests.
    const ok = lanes.filter((l) => l.result === 'passed').length;
    const bad = lanes.filter((l) => l.result === 'bug').length;
    const broken = lanes.filter((l) => l.result === 'broken').length;
    done.run = [`${ok} passed`, bad && plural(bad, 'possible bug'), broken && plural(broken, 'broken test')].filter(Boolean).join(' · ');
    done.results = `${plural(report.screenshotCount, 'screenshot')}, 1 report`;
  }
  return {
    lanes,
    files,
    tests: testFiles,
    load,
    done,
    hasBug: !!summary?.['possible-bug'],
    level: report ? 1 : testsKnown ? SLICES.make[1] : planKnown ? SLICES.plan[1] : SLICES.understand[1],
  };
}

/* ---------- run state → what each stage shows ---------- */

function stageStatus(st: (typeof STAGES)[number], steps: RunStep[], done: boolean): StageStatus {
  const states = st.steps.map((s) => steps.find((x) => x.key === s.key)?.state ?? 'waiting');
  if (states.includes('failed')) return 'bug';
  if (states.every((s) => s === 'passed')) return 'passed';
  if (states.every((s) => s === 'waiting' || s === 'skipped')) return done ? 'skipped' : 'waiting';
  return done ? (states.includes('passed') ? 'passed' : 'skipped') : 'running';
}

// After the run, the lanes grow out one stage after another over REVEAL_MS. Each stage gets a slice.
const REVEAL_MS = 4200;
const SLICES: Record<StageId, [number, number]> = {
  sandbox: [0, 0.1],
  understand: [0.1, 0.3],
  plan: [0.3, 0.45],
  make: [0.45, 0.58],
  run: [0.58, 0.85],
  results: [0.85, 1],
};
const progress = (id: StageId, t: number) => {
  const [a, b] = SLICES[id];
  return t < a ? -1 : t >= b ? 1 : (t - a) / (b - a);
};
const shown = (f: number, i: number, n: number) => f >= 1 || (f >= 0 && i < Math.ceil(f * n));


/* ---------- layout: the chain ---------- */

const SW = 210; // stage box
const SH = 72;
const IW = 220; // a fan's boxes
const IH = 50;
const GAP = 60; // their spacing
const PITCH = 700; // from one stage to the next
const stageX = (i: number) => i * PITCH;
const fanX = (i: number) => stageX(i) + SW + 150;
const LIMIT = 12; // a longer fan folds behind "+N more"

type ND = {
  look?: string;
  title?: string;
  sub?: string;
  noteTitle?: string;
  info?: string;
  status?: StageStatus;
  name?: string;
  text?: string;
  src?: string | null;
  dim?: boolean;
  sel?: boolean;
};
type FNode = Node<ND>;
type FEdge = Edge<{ tone: string; lanes: string[] }>;

interface Built {
  nodes: FNode[];
  edges: FEdge[];
  lanesOf: Record<string, Set<string>>;
  latest: number;
  firstBug: string | null;
}

// What a stage found or made: [id, title, sub, look, lanes, note, screenshot]
type Item = [string, string, string, string, string[], string, (string | null)?];

function build(model: Model | null, steps: RunStep[], done: boolean, t: number, expanded: boolean): Built {
  const nodes: FNode[] = [];
  const edges: FEdge[] = [];
  const lanesOf: Record<string, Set<string>> = {};
  const status = STAGES.map((st) => stageStatus(st, steps, done));
  let latest = 0;
  STAGES.forEach((st, i) => {
    if (status[i] === 'waiting') return;
    latest = i;
    const running = st.steps.find((s) => steps.find((x) => x.key === s.key)?.state === 'running');
    const text = status[i] === 'running' ? (running?.doing ?? 'starting') : status[i] === 'skipped' ? 'skipped' : (model?.done[st.id] ?? 'done');
    nodes.push({ id: 'h:' + st.id, type: 'stage', position: { x: stageX(i), y: -SH / 2 }, data: { name: st.name, status: status[i], text, info: st.text }, draggable: false, connectable: false });
  });
  if (!model) return { nodes, edges, lanesOf, latest, firstBug: null };

  const F = Object.fromEntries(STAGES.map((st) => [st.id, progress(st.id, t)])) as Record<StageId, number>;
  const { lanes } = model;
  const idx = new Map(lanes.map((l, i) => [l.id, i]));
  const at = (f: number, l: Lane) => shown(f, idx.get(l.id)!, lanes.length);
  const ids = (ls: Lane[]) => ls.map((l) => l.id);
  const fans: Item[][] = [[], [], [], [], [], []];

  model.files.forEach((f, i) => {
    if (shown(F.sandbox, i, model.files.length))
      fans[0].push(['file:' + f, f, f === 'your app' ? 'source files' : 'source file', 'file', ids(lanes.filter((l) => l.source === f)), 'Read from your repo on the GitHub machine, where its pages, endpoints and functions were found.']);
  });
  const found = lanes.filter((l) => at(F.understand, l));
  const keep = found.length > LIMIT && !expanded ? found.slice(0, LIMIT - 1) : found;
  keep.forEach((l) => fans[1].push(['found:' + l.id, l.label, l.kind, 'found', [l.id], `Found in ${l.source}.`]));
  if (keep.length < found.length) fans[1].push(['more', `＋${found.length - keep.length} more`, 'tap to show them all', 'more', ids(found.slice(keep.length)), '']);

  const planned = lanes.filter((l) => at(F.plan, l));
  const toTest = planned.filter((l) => !l.skip);
  const skipped = planned.filter((l) => l.skip);
  const loads = model.load && F.plan >= 1 ? model.load : null;
  if (toTest.length) {
    const fw = [...new Set(toTest.map((l) => l.framework))].join(' and ');
    fans[2].push(['plan:test', `Test it · ${toTest.length}`, fw, 'passed', ids(toTest), `Planned: Repeval can test these ${toTest.length} without AI, with ${fw}.`]);
  }
  if (skipped.length || loads) {
    const n = skipped.length + (loads ? Number(loads.label.split(' ')[0]) || 1 : 0);
    const why = skipped.map((l) => `${l.label}: ${l.skip}`).concat(loads ? [`${loads.label}: ${loads.sub}`] : []);
    fans[2].push(['plan:skip', `Skipped · ${n}`, 'with the reason for each', 'skip', ids(skipped).concat(loads ? loads.from : []), why.join('. ') + '.']);
  }
  model.tests.forEach((tf, i) => {
    if (!shown(F.make, i, model.tests.length)) return;
    const covered = lanes.filter((l) => l.test === tf);
    const pw = tf.endsWith('.spec.ts');
    fans[3].push(['test:' + tf, tf, `${plural(covered.length, 'test')} · ${pw ? 'Playwright' : 'Vitest'}`, 'test passed', ids(covered),
      pw ? 'Playwright: opens each page or calls each endpoint and checks it works.' : 'Vitest: loads the file and checks its exports.']);
  });
  const results = lanes.filter((l) => l.result && at(F.run, l));
  const passed = results.filter((l) => l.result === 'passed');
  if (passed.length) fans[4].push(['res:pass', `Passed · ${passed.length}`, 'no errors', 'passed', ids(passed), passed.map((l) => `${l.label}: ${l.resultText}`).join('. ') + '.']);
  results
    .filter((l) => l.result !== 'passed')
    .forEach((l) => fans[4].push(['res:' + l.id, l.result === 'bug' ? 'Possible bug' : 'Broken test', `${l.label}: ${l.resultText}`, l.result === 'bug' ? 'bug' : 'broken', [l.id], l.resultInfo ?? '']));
  if (F.results >= 0) {
    results.filter((l) => l.shot).forEach((l) => fans[5].push(['shot:' + l.id, l.label, '', l.result === 'bug' ? 'bug' : 'passed', [l.id], `Screenshots of ${l.label} at desktop and phone width.`, l.shot]));
    if (F.results >= 1)
      fans[5].push(['report', 'Report', model.done.run ?? '', model.hasBug ? 'bug' : 'passed', ids(lanes.filter((l) => !l.skip)), 'Every result, every screenshot and the test files to keep, saved in your repo for 7 days.']);
  }

  fans.forEach((fan, i) => {
    const top = -((fan.length - 1) * GAP) / 2 - IH / 2;
    fan.forEach(([id, title, sub, look, ls, info, src], j) => {
      lanesOf[id] = new Set(ls);
      const lane = id.startsWith('res:') && id !== 'res:pass' ? lanes.find((l) => 'res:' + l.id === id) : null;
      nodes.push({
        id,
        type: src !== undefined ? 'shot' : look === 'more' ? 'more' : 'item',
        position: { x: fanX(i), y: top + j * GAP },
        data: { title, sub, look, info, src, noteTitle: lane ? `${title} on ${lane.label}` : title },
        draggable: false,
        connectable: false,
      });
      const tone = look.includes('bug') ? 'bug' : look === 'skip' ? 'skip' : 'done';
      if (status[i] !== 'waiting') edges.push({ id: `out:${id}`, source: 'h:' + STAGES[i].id, target: id, data: { tone, lanes: ls } });
      if (STAGES[i + 1] && status[i + 1] !== 'waiting' && look !== 'skip' && look !== 'more')
        edges.push({ id: `in:${id}`, source: id, target: 'h:' + STAGES[i + 1].id, data: { tone: tone === 'bug' ? 'bug' : 'done', lanes: ls } });
    });
  });
  const firstBug = fans[4].find((f) => f[3] === 'bug') ?? fans[4].find((f) => f[3] === 'broken');
  return { nodes, edges, lanesOf, latest, firstBug: firstBug ? firstBug[0] : null };
}

/* ---------- boxes ---------- */

const sides = () => (
  <>
    <Handle type="target" position={Position.Left} isConnectable={false} />
    <Handle type="source" position={Position.Right} isConnectable={false} />
  </>
);
const cls = (base: string, d: ND) => `${base}${d.dim ? ' dim' : ''}${d.sel ? ' sel' : ''}`;
const nodeTypes = {
  stage: ({ data }: NodeProps<FNode>) => (
    <div className={`cs ${data.status}`} style={{ width: SW, height: SH }}>
      {sides()}
      <b>{data.name}</b>
      <span className="cs-text">
        <i aria-hidden="true" />
        {data.text}
      </span>
    </div>
  ),
  item: ({ data }: NodeProps<FNode>) => (
    <div className={cls(`ci ${data.look}`, data)} style={{ width: IW, height: IH }}>
      {sides()}
      <b>{data.title}</b>
      <span>{data.sub}</span>
    </div>
  ),
  more: ({ data }: NodeProps<FNode>) => (
    <button type="button" className="ci more" style={{ width: IW, height: IH }}>
      {sides()}
      <b>{data.title}</b>
      <span>{data.sub}</span>
    </button>
  ),
  shot: ({ data }: NodeProps<FNode>) => (
    <div className={cls(`cshot ${data.look}`, data)} style={{ width: IW, height: IH }}>
      {sides()}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {data.src && <img src={data.src} alt="" />}
      <span>{data.title}</span>
    </div>
  ),
};

// Lines take the theme's own colours, so they change with light and dark.
const LINE: Record<string, string> = { done: 'var(--ok)', bug: 'var(--bug)', skip: 'var(--muted)' };
const NOTE = (
  <>
    <b>Tap a box</b> to follow that page, endpoint or function through the run. Drag to look around.
  </>
);
// Arrows pointing out (and in), so full screen doesn't look like React Flow's fit-view button.
const ICON_FULL = 'M14 4h6v6M10 20H4v-6M20 4l-6 6M4 20l6-6';
const ICON_EXIT = 'M4 14h6v6M20 10h-6V4M10 14l-6 6M14 10l6-6';

// Tapping a box lights up everything it shares a lane with.
function lit(id: string, lanesOf: Built['lanesOf']) {
  const want = lanesOf[id];
  if (!want) return null;
  const on = new Set<string>();
  for (const [box, ls] of Object.entries(lanesOf)) for (const l of ls) if (want.has(l)) on.add(box);
  return on;
}

export interface RunFlowProps {
  /** Each diagram on a page needs its own id, or arrowheads point at the other diagram's markers. */
  id: string;
  steps: RunStep[];
  done: boolean;
  /** Names-only progress from workflow v3, while the run is going. */
  progress: Progress | null;
  report: LoadedReport | null;
  /** Grow the chain stage by stage as the data arrives, instead of showing it all at once. */
  reveal: boolean;
}

export default function RunFlow({ id, steps, done, progress, report, reveal }: RunFlowProps) {
  const model = useMemo(() => modelOf(progress, report), [progress, report]);
  const wrap = useRef<HTMLDivElement>(null);
  const inst = useRef<ReactFlowInstance<FNode, FEdge> | null>(null);
  const [t, setT] = useState(reveal ? 0 : 1);
  const tRef = useRef(t);
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState<{ title: string; text: string } | null>(null);
  const [full, setFull] = useState(false);
  const autoPicked = useRef(false);
  // React Flow takes each box's size from the node objects it is handed, and hides a box until it knows
  // its size. The diagram is rebuilt on every update, so the sizes it measured are kept here and handed
  // back; otherwise boxes would vanish and re-measure each time, and stay hidden while a run keeps updating.
  const sizes = useRef(new Map<string, { width: number; height: number }>());
  const keepSizes = (changes: NodeChange<FNode>[]) => {
    for (const c of changes) if (c.type === 'dimensions' && c.dimensions) sizes.current.set(c.id, c.dimensions);
  };

  // Grow the chain up to where the data reaches, at a steady pace: each new progress file or the report
  // moves the goal further, and the diagram catches up stage by stage.
  const goal = model?.level ?? 0;
  useEffect(() => {
    if (tRef.current >= goal) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      tRef.current = goal;
      return setT(goal);
    }
    let last = performance.now();
    const iv = setInterval(() => {
      const now = performance.now();
      const next = Math.min(goal, tRef.current + (now - last) / REVEAL_MS);
      last = now;
      tRef.current = next;
      setT(next);
      if (next >= goal) clearInterval(iv);
    }, 70);
    return () => clearInterval(iv);
  }, [goal]);

  const g = useMemo(() => build(model, steps, done, Math.min(t, goal), expanded), [model, steps, done, t, goal, expanded]);
  const finished = !!report && done && t >= 1;
  const view = useRef({ latest: 0, finished: false });
  view.current = { latest: g.latest, finished };

  // The camera follows the newest stage and its fan, about three stages wide. When the run is over it rests
  // on the end of the chain: the results, Results, and what it saved.
  const frame = (animate: boolean) => {
    const i = inst.current;
    const w = wrap.current?.clientWidth ?? 0;
    const h = wrap.current?.clientHeight ?? 0;
    if (!i || !w) return;
    const duration = animate && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 600 : 0;
    const z = Math.max(0.35, Math.min(0.85, h / 820, w / 1500));
    const { latest, finished: end } = view.current;
    const from = end ? stageX(4) : stageX(latest);
    const to = end ? fanX(5) + IW : fanX(latest) + IW;
    i.setViewport({ x: w / 2 - (z * (from + to)) / 2, y: h / 2, zoom: z }, { duration });
  };
  const frameRef = useRef(frame);
  frameRef.current = frame;

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    let last = '';
    const ro = new ResizeObserver(() => {
      const size = `${el.clientWidth}x${el.clientHeight}`;
      if (!el.clientWidth || size === last) return;
      last = size;
      frameRef.current(false);
    });
    ro.observe(el);
    const onFull = () => setFull(document.fullscreenElement === el);
    document.addEventListener('fullscreenchange', onFull);
    return () => {
      ro.disconnect();
      document.removeEventListener('fullscreenchange', onFull);
    };
  }, []);
  useEffect(() => {
    const tm = setTimeout(() => frameRef.current(true), 60);
    return () => clearTimeout(tm);
  }, [g.latest, finished]);

  // When the run is over and the chain has grown, light up the first possible bug (or broken test).
  useEffect(() => {
    if (!finished || !g.firstBug || autoPicked.current) return;
    autoPicked.current = true;
    const n = g.nodes.find((x) => x.id === g.firstBug);
    setSelected(g.firstBug);
    if (n) setNote({ title: n.data.noteTitle ?? '', text: n.data.info ?? '' });
  }, [finished, g.firstBug, g.nodes]);

  const lane = selected ? lit(selected, g.lanesOf) : null;
  const want = selected ? g.lanesOf[selected] : null;
  const nodes = g.nodes.map((n) => {
    const measured = sizes.current.get(n.id);
    const data = lane && n.type !== 'stage' ? { ...n.data, dim: !lane.has(n.id), sel: n.id === selected } : n.data;
    return { ...n, data, ...(measured ? { measured } : {}) };
  });
  const edges = g.edges.map((e) => {
    const tone = e.data!.tone;
    const color = LINE[tone] ?? LINE.done;
    const off = !!want && !e.data!.lanes.some((l) => want.has(l));
    return {
      ...e,
      type: 'default',
      focusable: false,
      style: { stroke: color, strokeWidth: 1.7, strokeDasharray: tone === 'skip' ? '5 5' : undefined, opacity: off ? 0.12 : 1, transition: 'opacity 200ms ease' },
      markerEnd: { type: MarkerType.ArrowClosed, color, width: 14, height: 14 },
    };
  });

  const choose = (n: FNode) => {
    if (n.type === 'more') return setExpanded(true);
    if (n.type === 'stage') {
      setSelected(null);
      return setNote({ title: n.data.name ?? '', text: n.data.info ?? '' });
    }
    const same = selected === n.id;
    setSelected(same ? null : n.id);
    setNote(same ? null : { title: n.data.noteTitle ?? '', text: n.data.info ?? '' });
  };
  const toggleFull = () => {
    const el = wrap.current;
    if (!el) return;
    if (document.fullscreenElement === el) document.exitFullscreen();
    else el.requestFullscreen().catch(() => undefined);
  };

  return (
    <div className="flow-wrap">
      {/* Short while only the stages are known, full height once the chain grows. */}
      <div className={'flow' + (model ? '' : ' compact')} ref={wrap} data-ui aria-label="The run as a flow diagram">
        <ReactFlow<FNode, FEdge>
          id={id}
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onInit={(i) => {
            inst.current = i;
            frame(false);
          }}
          onNodesChange={keepSizes}
          onNodeClick={(_, n) => choose(n)}
          onPaneClick={() => {
            setSelected(null);
            setNote(null);
          }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          // Drag to look around; pinch or the buttons zoom. The mouse wheel keeps scrolling the page.
          panOnDrag
          zoomOnScroll={false}
          zoomOnPinch
          zoomOnDoubleClick={false}
          panOnScroll={false}
          preventScrolling={false}
          minZoom={0.15}
          maxZoom={1.5}
          attributionPosition="bottom-left"
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1.6} />
          <Controls showInteractive={false} position="bottom-right" fitViewOptions={{ padding: 0.08, duration: 400 }}>
            {typeof document !== 'undefined' && document.fullscreenEnabled && (
              <ControlButton onClick={toggleFull} title={full ? 'Exit full screen' : 'Full screen'} aria-label={full ? 'Exit full screen' : 'Full screen'}>
                <svg viewBox="0 0 24 24" className="cs-icon" aria-hidden="true">
                  <path d={full ? ICON_EXIT : ICON_FULL} />
                </svg>
              </ControlButton>
            )}
          </Controls>
        </ReactFlow>
      </div>
      <p className="flow-note" aria-live="polite">
        {note ? (
          <>
            <b>{note.title}.</b> {note.text}
          </>
        ) : (
          NOTE
        )}
      </p>
    </div>
  );
}
