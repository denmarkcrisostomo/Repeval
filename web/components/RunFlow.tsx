'use client';

import '@xyflow/react/dist/style.css';
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
} from '@xyflow/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { LoadedReport, ReportTest } from '@/lib/report-client';
import { STEPS } from '@/lib/steps';
import type { RunStep } from '@/lib/types';

// The run as a flow diagram (React Flow, MIT). Each page, endpoint and function gets its own lane,
// left to right through the six stages: found → planned or skipped → test file → result → screenshot and report.
// While the run is on GitHub only the stages are known, so a stage's box appears when it starts.
// Once the report arrives, the lanes grow out stage by stage.

const STAGES = [
  { id: 'collect', no: '①', name: 'Collect', text: 'GitHub copies your repo onto a fresh, temporary machine and installs Node 22. Repeval never receives your code.' },
  { id: 'understand', no: '②', name: 'Understand', text: 'Reads your code to find every page, API endpoint and exported function, and how to start the app.' },
  { id: 'plan', no: '③', name: 'Plan', text: "Decides what to test. Anything it can't test yet is skipped with the reason, never silently dropped." },
  { id: 'make', no: '④', name: 'Make tests', text: 'Writes real test files: Vitest for your functions, Playwright for your pages and API.' },
  { id: 'run', no: '⑤', name: 'Run', text: 'Runs the unit tests, then starts your app and opens every page in a real browser.' },
  { id: 'results', no: '⑥', name: 'Results', text: 'Saves the report and screenshots in your repo for 7 days. The machine is then deleted.' },
].map((st) => ({ ...st, steps: STEPS.filter((s) => s.stage === st.name) }));
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
  done: Record<StageId, string>;
  hasBug: boolean;
}

const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const base = (p: string) => p.split('/').pop() ?? p;
// "dynamic route: needs example parameters (AI mode)" → "needs example parameters"
const short = (note?: string) => (note ?? 'skipped').replace(/\s*\([^)]*\)\s*$/, '').split(': ').pop()!;
// "Error: browser errors on this page: Uncaught error: cartTotal is not defined" → "cartTotal is not defined"
const firstLine = (msg?: string) => (msg ?? '').split('\n')[0].replace(/^Error:\s*/, '').trim();

function modelOf(report: LoadedReport): Model {
  const { tests, summary } = report.results;
  const generated = report.tests.map((f) => base(f.path));
  const unitFile = (src: string) => {
    const stem = src.replace(/\.[^./]+$/, '').replace(/\//g, '__');
    return generated.find((g) => g.startsWith(stem + '.test.')) ?? `${stem}.test.ts`;
  };
  const lanes: Lane[] = [];
  const loads: ReportTest[] = [];
  for (const t of tests) {
    if (t.suite === 'load') {
      loads.push(t);
      continue;
    }
    const group: Group = t.suite === 'e2e' ? 'Pages' : t.suite === 'api' ? 'API' : 'Code';
    const target = t.target?.replace(/^(page|api|unit):/, '');
    const source = t.source ?? (group === 'Code' ? t.file : undefined) ?? 'your app';
    const lane: Lane = {
      id: t.id,
      group,
      source,
      framework: group === 'Code' ? 'Vitest' : 'Playwright',
      label: group === 'Code' ? (t.target ? t.title.split(' › ')[0] : base(source)) : (target ?? t.title),
      kind: group === 'Pages' ? 'page' : group === 'API' ? 'endpoint' : t.target ? 'function' : 'module',
    };
    if (t.status === 'skipped') {
      lane.skip = short(t.note);
      lane.skipInfo = t.note ? `Skipped: ${t.note}.` : 'Skipped.';
    } else {
      lane.test = group === 'Code' ? unitFile(source) : base(t.file ?? 'tests');
      lane.result = t.status === 'passed' ? 'passed' : t.status === 'possible-bug' ? 'bug' : 'broken';
      if (lane.result === 'passed') {
        lane.resultText = group === 'Pages' ? 'loads, no errors' : group === 'API' ? 'answers, no server error' : lane.kind === 'module' ? 'loads, no errors' : 'loads, exported';
        lane.resultInfo = `${lane.label}: ${lane.resultText}.${t.note ? ` Note: ${t.note}.` : ''}`;
      } else if (lane.result === 'bug') {
        lane.resultText = firstLine(t.message).split(': ').pop() || 'see the report';
        lane.resultInfo = `The test ran and your app did something wrong. ${firstLine(t.message) || 'The report has the details.'}`;
      } else {
        lane.resultText = 'the test itself failed';
        lane.resultInfo = "The generated test couldn't run. This is Repeval's problem, not your app's: please report it.";
      }
      if (group === 'Pages' && t.screenshots.length) lane.shot = report.image(t.screenshots.find((s) => s.includes('desktop')) ?? t.screenshots[0]);
    }
    lanes.push(lane);
  }
  // Keep each source file's functions together, so its lines don't cross.
  const order: Group[] = ['Pages', 'API', 'Code'];
  lanes.sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group) || (a.group === 'Code' ? a.source.localeCompare(b.source) : 0));

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
  const count = (g: Group, kind?: string) => lanes.filter((l) => l.group === g && (!kind || l.kind === kind)).length;
  const found = [
    count('Pages') && plural(count('Pages'), 'page'),
    count('API') && `${count('API')} API`,
    count('Code', 'function') && plural(count('Code', 'function'), 'function'),
  ].filter(Boolean);
  const planned = lanes.filter((l) => !l.skip).length;
  const bugs = summary['possible-bug'];
  return {
    lanes,
    files,
    tests: testFiles,
    load,
    hasBug: bugs > 0,
    done: {
      collect: plural(files.length, 'source file'),
      understand: found.length ? found.join(', ') : 'nothing to test found',
      plan: `${planned} of ${lanes.length + loads.length} to test`,
      make: plural(testFiles.length, 'test file'),
      run: [`${summary.passed} passed`, bugs && plural(bugs, 'possible bug'), summary.broken && plural(summary.broken, 'broken test')].filter(Boolean).join(' · '),
      results: `${plural(report.screenshotCount, 'screenshot')}, 1 report`,
    },
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
  collect: [0, 0.1],
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

/* ---------- layout: one column per stage, one row per lane ---------- */

const COL = 236;
const W = 200;
const ROW = 60;
const HEAD_H = 76;
const LIMIT = 6;

type ND = {
  kind?: string;
  state?: string;
  title?: string;
  sub?: string;
  noteTitle?: string;
  info?: string;
  status?: StageStatus;
  no?: string;
  name?: string;
  text?: string;
  label?: string;
  group?: Group;
  src?: string | null;
  route?: string;
  dim?: boolean;
  sel?: boolean;
};
type FNode = Node<ND>;
type FEdge = Edge<{ state: string }>;

interface Built {
  nodes: FNode[];
  edges: FEdge[];
  lanesOf: Record<string, Set<string>>;
  latestCol: number;
}

function build(model: Model | null, steps: RunStep[], done: boolean, t: number, expanded: Partial<Record<Group, boolean>>): Built {
  const nodes: FNode[] = [];
  const edges: FEdge[] = [];
  const lanesOf: Record<string, Set<string>> = {};
  const member = (id: string, lane: string) => (lanesOf[id] ??= new Set()).add(lane);
  const node = (id: string, type: string, col: number, y: number, data: ND) =>
    nodes.push({ id, type, position: { x: col * COL, y }, data, draggable: false, connectable: false, selectable: type !== 'glabel' });
  const link = (id: string, source: string, target: string, state: string, extra?: Partial<FEdge>) =>
    edges.push({ id, source, target, type: 'smoothstep', data: { state }, ...extra });

  // Stage boxes along the top, each appearing when its stage starts.
  let latestCol = 0;
  STAGES.forEach((st, c) => {
    const status = stageStatus(st, steps, done);
    if (status === 'waiting') return;
    latestCol = c;
    const running = st.steps.find((s) => steps.find((x) => x.key === s.key)?.state === 'running');
    const text = status === 'running' ? (running?.doing ?? 'starting') : status === 'skipped' ? 'skipped' : (model?.done[st.id] ?? 'done');
    node('h:' + st.id, 'head', c, 0, { no: st.no, name: st.name, status, text, info: st.text });
    if (c) link(`h:${STAGES[c - 1].id}>${st.id}`, 'h:' + STAGES[c - 1].id, 'h:' + st.id, 'done', { sourceHandle: 'r', targetHandle: 'l' });
  });
  if (!model) return { nodes, edges, lanesOf, latestCol };

  const F = Object.fromEntries(STAGES.map((st) => [st.id, progress(st.id, t)])) as Record<StageId, number>;
  const { lanes: all } = model;
  const idx = new Map(all.map((l, i) => [l.id, i]));
  const found = (l: Lane) => shown(F.understand, idx.get(l.id)!, all.length);

  // Rows only for lanes found so far, grouped by kind. Long groups fold behind "+N more".
  let y = HEAD_H;
  const rows: Record<string, number> = {};
  const lanes: Lane[] = [];
  let loadRow: number | null = null;
  (['Pages', 'API', 'Code'] as Group[]).forEach((g) => {
    const inGroup = all.filter((l) => l.group === g);
    const list = inGroup.filter(found);
    if (!list.length) return;
    const keep = list.length > LIMIT && !expanded[g] ? list.slice(0, LIMIT - 1) : list;
    node('g:' + g, 'glabel', 1, y, { label: `${g === 'Code' ? 'Functions' : g} · ${list.length}` });
    y += 30;
    keep.forEach((l) => {
      rows[l.id] = y;
      lanes.push(l);
      y += ROW;
    });
    if (keep.length < list.length) {
      node('more:' + g, 'more', 1, y, { group: g, label: `＋${list.length - keep.length} more` });
      y += ROW;
    }
    if (g === 'API' && model.load && list.length === inGroup.length) {
      loadRow = y;
      y += ROW;
    }
    y += 18;
  });
  const mid = (ids: string[]) => {
    const ys = ids.map((id) => rows[id]).filter((n) => n !== undefined);
    return ys.length ? (Math.min(...ys) + Math.max(...ys)) / 2 : null;
  };
  // Shared boxes sit level with the lanes they serve, nudged apart so they never overlap.
  const spread = (want: { id: string; y: number }[]) => {
    want.sort((a, b) => a.y - b.y);
    let floor = -Infinity;
    return want.map((w) => {
      const at = Math.max(w.y, floor);
      floor = at + ROW;
      return { ...w, y: at };
    });
  };

  // ① source files hang off the Collect box. Until their lanes are found they wait below.
  let spare = Math.max(y, HEAD_H + 12);
  const fileWant = model.files.flatMap((f, i) => {
    if (!shown(F.collect, i, model.files.length)) return [];
    const ys = mid(lanes.filter((l) => l.source === f).map((l) => l.id));
    if (ys === null && F.understand >= 0) return []; // all of its lanes are folded away
    const at = ys ?? spare;
    if (ys === null) spare += ROW;
    return [{ id: f, y: at }];
  });
  for (const { id: f, y: fy } of spread(fileWant)) {
    node('file:' + f, 'item', 0, fy, { title: f, sub: f === 'your app' ? 'source files' : 'source file', state: 'found', kind: 'file', info: `Read from your repo on the GitHub machine.` });
    link(`e:collect>${f}`, 'h:collect', 'file:' + f, 'done', { sourceHandle: 'tree', type: 'step' });
  }

  // ④ test files, centred on the lanes they cover.
  const testWant = model.tests.flatMap((tf, i) => {
    const ys = mid(lanes.filter((l) => l.test === tf).map((l) => l.id));
    return ys !== null && shown(F.make, i, model.tests.length) ? [{ id: tf, y: ys }] : [];
  });
  for (const { id: tf, y: ty } of spread(testWant)) {
    const n = all.filter((l) => l.test === tf).length;
    const pw = tf.endsWith('.spec.ts');
    node('test:' + tf, 'item', 3, ty, {
      title: tf,
      sub: plural(n, 'test'),
      state: 'passed',
      kind: 'test',
      info: pw ? 'Playwright: opens each page or calls each endpoint in a real browser and checks it works.' : 'Vitest: loads the file and checks its exports.',
    });
  }

  lanes.forEach((l) => {
    const i = idx.get(l.id)!;
    ['found:', 'plan:', 'result:', 'shot:'].forEach((p) => member(p + l.id, l.id));
    member('file:' + l.source, l.id);
    const ry = rows[l.id];
    node('found:' + l.id, 'item', 1, ry, { title: l.label, sub: l.kind, state: 'found', kind: 'found', info: `Found in ${l.source}.` });
    link(`e:file>${l.id}`, 'file:' + l.source, 'found:' + l.id, 'done');
    if (!shown(F.plan, i, all.length)) return;
    if (l.skip) {
      node('plan:' + l.id, 'item', 2, ry, { title: 'Skipped', noteTitle: `${l.label}: skipped`, sub: l.skip, state: 'skip', kind: 'plan', info: l.skipInfo });
      link(`e:found>plan:${l.id}`, 'found:' + l.id, 'plan:' + l.id, 'skip');
      return;
    }
    member('test:' + l.test, l.id);
    member('report', l.id);
    node('plan:' + l.id, 'item', 2, ry, { title: 'Test it', noteTitle: `${l.label}: planned`, sub: l.framework, state: 'passed', kind: 'plan', info: 'Planned: Repeval can test this without AI.' });
    link(`e:found>plan:${l.id}`, 'found:' + l.id, 'plan:' + l.id, 'done');
    link(`e:plan>test:${l.id}`, 'plan:' + l.id, 'test:' + l.test, 'done');
    if (!shown(F.run, i, all.length)) return;
    const r = l.result!;
    const line = r === 'bug' ? 'bug' : 'done';
    const title = r === 'bug' ? 'Possible bug' : r === 'broken' ? 'Broken test' : 'Passed';
    node('result:' + l.id, 'item', 4, ry, { title, noteTitle: `${l.label}: ${title.toLowerCase()}`, sub: l.resultText, state: r === 'broken' ? 'running' : r, kind: 'result', info: l.resultInfo });
    link(`e:test>result:${l.id}`, 'test:' + l.test, 'result:' + l.id, line);
    if (l.shot && F.results >= 0) {
      node('shot:' + l.id, 'shot', 5, ry, { src: l.shot, route: l.label, state: r, info: `Screenshots of ${l.label} at desktop and phone width.` });
      link(`e:result>shot:${l.id}`, 'result:' + l.id, 'shot:' + l.id, line);
    }
  });

  // Load tests: planned for endpoints, one box for all of them.
  if (model.load && loadRow !== null && F.plan >= 1) {
    node('plan:load', 'item', 2, loadRow, { title: model.load.label, sub: model.load.sub, state: 'skip', kind: 'plan', info: model.load.info });
    model.load.from
      .filter((id) => rows[id] !== undefined)
      .forEach((id) => {
        link(`e:load:${id}`, 'found:' + id, 'plan:load', 'skip');
        member('plan:load', id);
      });
  }

  // ⑥ the report, right under the screenshots.
  if (F.results >= 1) {
    const shotYs = lanes.filter((l) => l.shot).map((l) => rows[l.id]);
    const ry = shotYs.length ? Math.max(...shotYs) + ROW : (mid(lanes.map((l) => l.id)) ?? HEAD_H);
    node('report', 'item', 5, ry, { title: 'Report', sub: model.done.run, state: model.hasBug ? 'bug' : 'passed', kind: 'report', info: 'Every result, every screenshot and the test files to keep, saved in your repo for 7 days.' });
  }
  // A line is drawn only once both of its boxes are there.
  const ids = new Set(nodes.map((n) => n.id));
  return { nodes, edges: edges.filter((e) => ids.has(e.source) && ids.has(e.target)), lanesOf, latestCol };
}

/* ---------- boxes ---------- */

const sides = () => (
  <>
    <Handle id="l" type="target" position={Position.Left} isConnectable={false} />
    <Handle id="r" type="source" position={Position.Right} isConnectable={false} />
  </>
);
const nodeTypes = {
  head: ({ data }: NodeProps<FNode>) => (
    <div className={`fh ${data.status}`} style={{ width: W }}>
      {sides()}
      <Handle id="tree" type="source" position={Position.Left} isConnectable={false} style={{ top: '78%' }} />
      <span className="fh-no">
        {data.no} {data.name}
      </span>
      <span className="fh-text">
        <i aria-hidden="true" />
        {data.text}
      </span>
    </div>
  ),
  glabel: ({ data }: NodeProps<FNode>) => <div className="fg">{data.label}</div>,
  more: ({ data }: NodeProps<FNode>) => (
    <button type="button" className="fm" style={{ width: W }}>
      {sides()}
      {data.label}
    </button>
  ),
  item: ({ data }: NodeProps<FNode>) => (
    <div className={`fi ${data.kind} ${data.state}${data.dim ? ' dim' : ''}${data.sel ? ' sel' : ''}`} style={{ width: W }}>
      {sides()}
      <b>{data.title}</b>
      <span>{data.sub}</span>
    </div>
  ),
  shot: ({ data }: NodeProps<FNode>) => (
    <div className={`fs ${data.state}${data.dim ? ' dim' : ''}${data.sel ? ' sel' : ''}`} style={{ width: W }}>
      {sides()}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {data.src && <img src={data.src} alt={`Screenshot of ${data.route}`} loading="lazy" />}
      <span>{data.route}</span>
    </div>
  ),
};

const LINE: Record<string, string> = { done: '#2dd4bf', bug: '#ff6b5e', skip: '#56686a' };
const NOTE = (
  <>
    <b>Tap a box</b> to follow that page, endpoint or function through the run. Drag to look around.
  </>
);

// Tapping a box lights up the lanes it belongs to: one item's whole path, or every item a shared file feeds.
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
  report: LoadedReport | null;
  /** Grow the lanes out stage by stage when the report arrives, instead of showing them all at once. */
  reveal: boolean;
}

export default function RunFlow({ id, steps, done, report, reveal }: RunFlowProps) {
  const model = useMemo(() => (report ? modelOf(report) : null), [report]);
  const wrap = useRef<HTMLDivElement>(null);
  const inst = useRef<ReactFlowInstance<FNode, FEdge> | null>(null);
  const [t, setT] = useState(reveal ? 0 : 1);
  const [expanded, setExpanded] = useState<Partial<Record<Group, boolean>>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState<{ title: string; text: string } | null>(null);

  // Grow the lanes once the report is here.
  useEffect(() => {
    if (!model || t >= 1) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return setT(1);
    const start = performance.now() - t * REVEAL_MS;
    const iv = setInterval(() => {
      const x = Math.min(1, (performance.now() - start) / REVEAL_MS);
      setT(x);
      if (x >= 1) clearInterval(iv);
    }, 70);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model]);

  const g = useMemo(() => build(model, steps, done, t, expanded), [model, steps, done, t, expanded]);
  const latest = useRef(0);
  latest.current = g.latestCol;

  // The camera: the whole diagram on wide screens (never zoomed in past 100%), the newest stage on phones.
  const frame = (animate: boolean) => {
    const i = inst.current;
    const w = wrap.current?.clientWidth ?? 0;
    if (!i || !w) return;
    const duration = animate && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 450 : 0;
    if (w < 700) {
      const z = 0.62;
      i.setViewport({ x: Math.min(10, w - (latest.current + 1) * COL * z), y: 10, zoom: z }, { duration });
    } else i.fitView({ padding: 0.06, maxZoom: 1, duration });
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
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const tm = setTimeout(() => frameRef.current(true), 60);
    return () => clearTimeout(tm);
  }, [g.nodes.length, g.latestCol]);

  const lane = selected ? lit(selected, g.lanesOf) : null;
  const nodes = lane
    ? g.nodes.map((n) => (n.type === 'head' || n.type === 'glabel' ? n : { ...n, data: { ...n.data, dim: !lane.has(n.id), sel: n.id === selected } }))
    : g.nodes;
  const edges = g.edges.map((e) => {
    const st = e.data!.state;
    const off = !!lane && !e.id.startsWith('h:') && !(lane.has(e.source) && lane.has(e.target));
    const color = LINE[st] ?? LINE.done;
    return {
      ...e,
      focusable: false,
      style: { stroke: color, strokeWidth: 1.6, strokeDasharray: st === 'skip' ? '4 4' : undefined, opacity: off ? 0.12 : 1, transition: 'stroke 300ms ease, opacity 200ms ease' },
      markerEnd: { type: MarkerType.ArrowClosed, color, width: 14, height: 14 },
    };
  });

  const choose = (n: FNode) => {
    if (n.type === 'more') return setExpanded((x) => ({ ...x, [n.data.group!]: true }));
    if (n.type === 'glabel') return;
    if (n.type === 'head') {
      setSelected(null);
      return setNote({ title: `${n.data.no} ${n.data.name}`, text: n.data.info ?? '' });
    }
    const same = selected === n.id;
    setSelected(same ? null : n.id);
    setNote(same ? null : { title: n.data.noteTitle ?? n.data.title ?? n.data.route ?? '', text: n.data.info ?? '' });
  };

  return (
    <div className="flow-wrap">
      {/* Short while only the stages are known, full height once the lanes come in. */}
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
          onNodeClick={(_, n) => choose(n)}
          onPaneClick={() => {
            setSelected(null);
            setNote(null);
          }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          // Drag to look around, pinch or use the buttons to zoom; the mouse wheel keeps scrolling the page.
          panOnDrag
          zoomOnScroll={false}
          zoomOnPinch
          zoomOnDoubleClick={false}
          panOnScroll={false}
          preventScrolling={false}
          minZoom={0.25}
          maxZoom={1.5}
          colorMode="dark"
          attributionPosition="bottom-left"
        >
          <Background gap={18} size={1.2} color="#1f2a2d" />
          <Controls showInteractive={false} position="bottom-right" />
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
