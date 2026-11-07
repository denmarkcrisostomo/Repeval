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
import type { Progress, RunPhase, RunStep } from '@/lib/types';

// The run as one chain (React Flow, MIT), like the hero demo: each stage is a box in the line; it fans out to
// what it found or made, and those join into the next stage.
//   Sandbox → Checkout, Node → Analyze → files → pages, endpoints, functions → Plan → Test it · N / Skipped · N
//   → Make tests → test files → Run → Passed · N / each possible bug or broken test → Results → screenshots and report
// Sandbox is GitHub's own steps; Repeval's work starts at Analyze, which reads the files. Boxes that are alike are
// grouped; every problem gets its own box.
// A stage's status comes from GitHub as soon as it changes, but its boxes come from Repeval's data, which the
// workflow can only share between steps: with workflow v3, a names-only progress file after Analyze, Plan and
// Generate, then the report at the end. Older workflows share nothing until the report. So the chain grows left
// to right as that data arrives, one box at a time, a little behind GitHub, with placeholder boxes saying what
// the run is doing meanwhile. When the run is over, the first possible bug is lit up.

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
  /** Which pieces of data this is built from: the progress file's stages, or the report (all of them). */
  has: { found: boolean; plan: boolean; tests: boolean; report: boolean };
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
    has: { found: true, plan: planKnown, tests: testsKnown, report: !!report },
  };
}

/* ---------- run state → what each stage shows ---------- */

const finishedStep = (state?: RunStep['state']) => !!state && state !== 'waiting' && state !== 'running';

function stageStatus(st: (typeof STAGES)[number], steps: RunStep[], done: boolean): StageStatus {
  const states = st.steps.map((s) => steps.find((x) => x.key === s.key)?.state ?? 'waiting');
  if (states.includes('failed')) return 'bug';
  if (states.every((s) => s === 'passed')) return 'passed';
  if (states.every((s) => s === 'waiting' || s === 'skipped')) return done ? 'skipped' : 'waiting';
  return done ? (states.includes('passed') ? 'passed' : 'skipped') : 'running';
}

const STEP_MS = 110; // boxes are added one by one at this pace
const clockOf = (sec: number) => {
  const t = Math.max(0, Math.floor(sec));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

/* ---------- layout: the chain, in columns ---------- */

// Each column is a fan of boxes. Most stages have one; Analyze has two: the files it read, then what it found in
// them, each file joined to its finds.
//   data: the piece of data that fills it. waiting: what its placeholders say while that piece is on the way.
//   ghosts: how many placeholders, when the column's size is known (Sandbox is always its two steps).
type Piece = 'sandbox' | 'found' | 'plan' | 'tests' | 'report';
const COLS: { stage: number; data: Piece; waiting?: string; ghosts?: number }[] = [
  { stage: 0, data: 'sandbox', waiting: 'getting the machine ready', ghosts: 2 },
  { stage: 1, data: 'found', waiting: 'getting the file list' },
  { stage: 1, data: 'found' },
  { stage: 2, data: 'plan', waiting: 'choosing what to test' },
  { stage: 3, data: 'tests', waiting: 'writing test files' },
  { stage: 4, data: 'report', waiting: 'getting the results' },
  { stage: 5, data: 'report', waiting: 'getting the report' },
];
const SW = 230; // stage box: wide enough for "waiting for a machine · 12:34"
const SH = 72;
const IW = 220; // a fan's boxes
const IH = 50;
const GAP = 60; // their spacing
const OUT = 150; // stage to its first column
const BETWEEN = 150; // column to column
const INTO = 130; // last column to the next stage
const SX: number[] = [];
const CX: number[] = [];
{
  let x = 0;
  STAGES.forEach((_, i) => {
    SX[i] = x;
    x += SW + OUT;
    COLS.forEach((c, j) => {
      if (c.stage !== i) return;
      CX[j] = x;
      x += IW + BETWEEN;
    });
    x += INTO - BETWEEN;
  });
}
const lastCol = (i: number) => COLS.reduce((n, c, j) => (c.stage === i ? j : n), -1);
const firstCol = (i: number) => COLS.findIndex((c) => c.stage === i);
const LIMIT = 12; // a longer fan folds behind "+N more"

type ND = {
  look?: string;
  title?: string;
  sub?: string;
  noteTitle?: string;
  info?: string;
  status?: StageStatus | 'queued' | 'fetch';
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
  /** Every box the data has so far, in the order they are added. */
  order: string[];
  /** The column the camera looks at: the one being filled, or the newest stage's last one. */
  focus: number;
  /** That column has nothing on screen yet, so the camera centres on its stage alone. */
  bare: boolean;
  /** Every box is in and the report is here. */
  complete: boolean;
  firstBug: string | null;
}

// What a stage found or made: [id, title, sub, look, lanes, note, screenshot]
type Item = [string, string, string, string, string[], string, (string | null)?];

interface BuildInput {
  model: Model | null;
  steps: RunStep[];
  done: boolean;
  phase: RunPhase;
  /** Seconds the run has waited for a machine. */
  waited: number;
  /** No more data is coming: whatever has not arrived never will. */
  final: boolean;
  /** Boxes added so far; null shows everything at once. */
  revealed: Set<string> | null;
  expanded: { files?: boolean; found?: boolean };
}

function build({ model, steps, done, phase, waited, final, revealed, expanded }: BuildInput): Built {
  const nodes: FNode[] = [];
  const edges: FEdge[] = [];
  const lanesOf: Record<string, Set<string>> = {};
  const isIn = (id: string) => !revealed || revealed.has(id);
  const stateOf = (key: string) => steps.find((x) => x.key === key)?.state;
  const status = STAGES.map((st) => stageStatus(st, steps, done));
  const got: Record<Piece, boolean> = {
    sandbox: STAGES[0].steps.every((s) => finishedStep(stateOf(s.key))),
    found: !!model?.has.found,
    plan: !!model?.has.plan,
    tests: !!model?.has.tests,
    report: !!model?.has.report,
  };
  const lanes = model?.lanes ?? [];
  const ids = (ls: Lane[]) => ls.map((l) => l.id);
  const cols: Item[][] = COLS.map(() => []);

  // Sandbox's boxes are GitHub's own steps, shown as each one finishes.
  const every = ids(lanes);
  for (const [key, title, sub, info] of [
    ['checkout', 'Checkout', 'repo copied', 'GitHub copied your repo onto the sandbox. Repeval never receives your code.'],
    ['node', 'Node 22', 'installed', 'Node.js 22 is installed on the sandbox, so your project can run there.'],
  ]) {
    const state = stateOf(key);
    if (finishedStep(state)) cols[0].push(['sb:' + key, title, state === 'failed' ? 'failed' : state === 'skipped' ? 'skipped' : sub, state === 'failed' ? 'bug' : 'passed', every, info]);
  }
  if (model) {
    const fold = (all: Item[], open: boolean | undefined, id: string) => {
      const keep = all.length > LIMIT && !open ? all.slice(0, LIMIT - 1) : all;
      if (keep.length < all.length)
        keep.push([id, `＋${all.length - keep.length} more`, 'tap to show them all', 'more', [...new Set(all.slice(keep.length).flatMap((x) => x[4]))], '']);
      return keep;
    };
    cols[1] = fold(
      model.files.map((f): Item => {
        const ls = lanes.filter((l) => l.source === f);
        return ['file:' + f, f, `${plural(ls.length, 'thing')} found`, 'file', ids(ls), 'Read on the sandbox. Each line leads to what Repeval found in this file.'];
      }),
      expanded.files,
      'more:files',
    );
    cols[2] = fold(
      lanes.map((l): Item => ['found:' + l.id, l.label, l.kind, 'found', [l.id], `Found in ${l.source}.`]),
      expanded.found,
      'more:found',
    );
  }
  if (model?.has.plan) {
    const toTest = lanes.filter((l) => !l.skip);
    const skipped = lanes.filter((l) => l.skip);
    if (toTest.length) {
      const fw = [...new Set(toTest.map((l) => l.framework))].join(' and ');
      cols[3].push(['plan:test', `Test it · ${toTest.length}`, fw, 'passed', ids(toTest), `Planned: Repeval can test these ${toTest.length} without AI, with ${fw}.`]);
    }
    const loads = model.load;
    if (skipped.length || loads) {
      const n = skipped.length + (loads ? Number(loads.label.split(' ')[0]) || 1 : 0);
      const why = skipped.map((l) => `${l.label}: ${l.skip}`).concat(loads ? [`${loads.label}: ${loads.sub}`] : []);
      cols[3].push(['plan:skip', `Skipped · ${n}`, 'with the reason for each', 'skip', ids(skipped).concat(loads ? loads.from : []), why.join('. ') + '.']);
    }
  }
  if (model?.has.tests)
    for (const tf of model.tests) {
      const covered = lanes.filter((l) => l.test === tf);
      const pw = tf.endsWith('.spec.ts');
      cols[4].push(['test:' + tf, tf, `${plural(covered.length, 'test')} · ${pw ? 'Playwright' : 'Vitest'}`, 'test passed', ids(covered),
        pw ? 'Playwright: opens each page or calls each endpoint and checks it works.' : 'Vitest: loads the file and checks its exports.']);
    }
  if (model?.has.report) {
    const results = lanes.filter((l) => l.result);
    const passed = results.filter((l) => l.result === 'passed');
    if (passed.length) cols[5].push(['res:pass', `Passed · ${passed.length}`, 'no errors', 'passed', ids(passed), passed.map((l) => `${l.label}: ${l.resultText}`).join('. ') + '.']);
    for (const l of results.filter((x) => x.result !== 'passed'))
      cols[5].push(['res:' + l.id, l.result === 'bug' ? 'Possible bug' : 'Broken test', `${l.label}: ${l.resultText}`, l.result === 'bug' ? 'bug' : 'broken', [l.id], l.resultInfo ?? '']);
    for (const l of results.filter((x) => x.shot))
      cols[6].push(['shot:' + l.id, l.label, '', l.result === 'bug' ? 'bug' : 'passed', [l.id], `Screenshots of ${l.label} at desktop and phone width.`, l.shot]);
    cols[6].push(['report', 'Report', model.done.run ?? '', model.hasBug ? 'bug' : 'passed', ids(lanes.filter((l) => !l.skip)), 'Every result, every screenshot and the test files to keep, saved in your repo for 7 days.']);
  }

  // The order the boxes are added in, and the first one still to come: the camera waits there.
  const order = cols.flatMap((c) => c.map((x) => x[0]));
  const colOf = new Map(cols.flatMap((c, j) => c.map((x) => [x[0], j] as const)));
  const next = order.find((id) => !isIn(id));

  // The chain only grows left to right: a stage appears once every box before it is in, even if GitHub has
  // already started it. Data that is never coming (final) counts as in, with nothing to show.
  const colIn = (j: number) => (got[COLS[j].data] || final) && cols[j].every((x) => isIn(x[0]));
  const stageIn = (i: number) => COLS.every((c, j) => c.stage !== i || colIn(j));
  const shown: boolean[] = [];
  STAGES.forEach((_, i) => (shown[i] = i === 0 || (status[i] !== 'waiting' && shown[i - 1] && stageIn(i - 1))));
  const now = status.reduce((n, x, i) => (x !== 'waiting' ? i : n), -1); // where the run really is
  const doing = (i: number) => STAGES[i].steps.find((s) => stateOf(s.key) === 'running')?.doing ?? 'starting';
  const ahead = (j: number) => {
    const i = COLS[j].stage;
    if (now <= i || done) return COLS[j].waiting;
    return status[now] === 'running' ? `${STAGES[now].name}: ${doing(now)}` : `${STAGES[now].name} done`;
  };
  let latest = 0;
  STAGES.forEach((st, i) => {
    if (!shown[i]) return;
    latest = i;
    let state: ND['status'] = status[i];
    let text: string;
    if (state === 'waiting') {
      // Before any step starts, GitHub is still finding a machine: Sandbox waits, with a spinner and a clock.
      state = 'queued';
      text = phase === 'queued' ? `waiting for a machine · ${clockOf(waited)}` : 'starting the job';
    } else if (state === 'running') text = doing(i);
    else if (state === 'skipped') text = 'skipped';
    // Done, but none of its boxes are in yet: it stays neutral, so its colour (a possible bug in red) never shows
    // before the boxes that explain it. It takes its colour with its first box.
    else if (i === 0 && state === 'passed') text = 'ready'; // Sandbox: GitHub's own steps are all it needs
    else if (cols[firstCol(i)].some((x) => isIn(x[0])) || (final && stageIn(i))) text = model?.done[st.id] ?? (state === 'bug' ? 'failed' : 'done');
    else {
      state = 'fetch';
      text = 'done, getting details';
    }
    nodes.push({ id: 'h:' + st.id, type: 'stage', position: { x: SX[i], y: -SH / 2 }, data: { name: st.name, status: state, text, info: st.text }, draggable: false, connectable: false });
  });

  const line = (id: string, source: string, target: string, tone: string, ls: string[], animated = false) =>
    edges.push({ id, source, target, animated, data: { tone, lanes: ls } });
  const visible = cols.map((c) => c.filter((x) => isIn(x[0])));
  const filled: boolean[] = []; // columns with any box on screen, placeholders included
  COLS.forEach((c, j) => {
    const i = c.stage;
    if (!shown[i] || status[i] === 'waiting' || status[i] === 'skipped') return;
    const fan = visible[j];
    const first = j === firstCol(i); // fed by the stage, or by the column before it
    const into = j === lastCol(i) && STAGES[i + 1] && shown[i + 1] ? 'h:' + STAGES[i + 1].id : null;
    // This column's data is not here yet: placeholder boxes, saying what the run is doing meanwhile.
    if (!fan.length && !got[c.data] && !final) {
      if (!first) return;
      const n = c.ghosts ?? 3;
      const say = Math.floor((n - 1) / 2);
      filled[j] = true;
      for (let k = 0; k < n; k++) {
        const gid = `ghost:${j}:${k}`;
        lanesOf[gid] = new Set();
        nodes.push({ id: gid, type: 'ghost', position: { x: CX[j], y: (k - (n - 1) / 2) * GAP - IH / 2 }, data: { text: k === say ? ahead(j) : undefined }, draggable: false, connectable: false, selectable: false });
        line(`out:${gid}`, 'h:' + STAGES[i].id, gid, 'wait', [], true);
      }
      return;
    }
    if (fan.length) filled[j] = true;
    const top = -((fan.length - 1) * GAP) / 2 - IH / 2;
    fan.forEach(([id, title, sub, look, ls, info, src], k) => {
      lanesOf[id] = new Set(ls);
      const lane = id.startsWith('res:') && id !== 'res:pass' ? lanes.find((l) => 'res:' + l.id === id) : null;
      nodes.push({
        id,
        type: src !== undefined ? 'shot' : look === 'more' ? 'more' : 'item',
        position: { x: CX[j], y: top + k * GAP },
        data: { title, sub, look, info, src, noteTitle: lane ? `${title} on ${lane.label}` : title },
        draggable: false,
        connectable: false,
      });
      const tone = look.includes('bug') ? 'bug' : look === 'skip' ? 'skip' : 'done';
      if (first) line(`out:${id}`, 'h:' + STAGES[i].id, id, tone, ls);
      // From each box in the column before that shares a lane with this one: a file to what was found in it.
      else for (const p of visible[j - 1]) if (p[4].some((l) => ls.includes(l))) line(`via:${p[0]}>${id}`, p[0], id, tone, ls);
      if (into && look !== 'skip' && look !== 'more') line(`in:${id}`, id, into, tone === 'bug' ? 'bug' : 'done', ls);
    });
  });
  const firstBug = visible[5].find((f) => f[3] === 'bug') ?? visible[5].find((f) => f[3] === 'broken');
  // The camera looks at the column being filled, or else the newest stage's last column with anything in it
  // (placeholders included). With none, it looks at that stage alone.
  let focus = next ? colOf.get(next)! : lastCol(latest);
  if (!next) while (focus > firstCol(latest) && !filled[focus]) focus--;
  return { nodes, edges, lanesOf, order, focus, bare: !filled[focus], complete: got.report && !next, firstBug: firstBug ? firstBug[0] : null };
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
  // A box still on the way: a faded outline with a shimmer, and in one of them, what it waits for.
  ghost: ({ data }: NodeProps<FNode>) => (
    <div className="ci ghost" style={{ width: IW, height: IH }} aria-hidden="true">
      {sides()}
      {data.text ? <em>{data.text}…</em> : <i className="bar" />}
      <i className="bar short" />
    </div>
  ),
};

// Lines take the theme's own colours, so they change with light and dark.
const LINE: Record<string, string> = { done: 'var(--ok)', bug: 'var(--bug)', skip: 'var(--muted)', wait: 'var(--muted)' };
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
  const on = new Set<string>([id]);
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
  /** Add the boxes one by one as the data arrives, instead of showing them all at once. */
  reveal: boolean;
  phase?: RunPhase;
  /** Seconds the run has waited for a machine, while queued. */
  waited?: number;
  /** No more data is coming (the report is here, or there won't be one). Defaults to `done`. */
  final?: boolean;
}

export default function RunFlow({ id, steps, done, progress, report, reveal, phase = done ? 'done' : 'running', waited = 0, final = done }: RunFlowProps) {
  const model = useMemo(() => modelOf(progress, report), [progress, report]);
  const wrap = useRef<HTMLDivElement>(null);
  const inst = useRef<ReactFlowInstance<FNode, FEdge> | null>(null);
  const [expanded, setExpanded] = useState<{ files?: boolean; found?: boolean }>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState<{ title: string; text: string } | null>(null);
  const [full, setFull] = useState(false);
  const autoPicked = useRef(false);
  // Watched live, boxes are added one at a time; otherwise they are all there at once (null).
  const revealed = useRef<Set<string> | null>(reveal ? new Set() : null);
  const [added, setAdded] = useState(0);
  // React Flow takes each box's size from the node objects it is handed, and hides a box until it knows
  // its size. The diagram is rebuilt on every update, so the sizes it measured are kept here and handed
  // back; otherwise boxes would vanish and re-measure each time, and stay hidden while a run keeps updating.
  const sizes = useRef(new Map<string, { width: number; height: number }>());
  const keepSizes = (changes: NodeChange<FNode>[]) => {
    for (const c of changes) if (c.type === 'dimensions' && c.dimensions) sizes.current.set(c.id, c.dimensions);
  };

  const g = useMemo(
    () => build({ model, steps, done, phase, waited, final, revealed: revealed.current, expanded }),
    // `added` stands for the revealed set, which changes in place.
    [model, steps, done, phase, waited, final, expanded, added],
  );
  const order = useRef(g.order);
  order.current = g.order;

  // Add the next box every STEP_MS, in order, until the diagram has everything the data holds.
  useEffect(() => {
    if (!reveal) return;
    const t = setInterval(() => {
      const seen = revealed.current!;
      const next = order.current.find((x) => !seen.has(x));
      if (!next) return;
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) order.current.forEach((x) => seen.add(x));
      else seen.add(next);
      setAdded((n) => n + 1);
    }, STEP_MS);
    return () => clearInterval(t);
  }, [reveal]);
  // Boxes unfolded from "+N more" appear at once, and the camera stays where it is.
  useEffect(() => {
    const seen = revealed.current;
    if (!seen) return;
    for (const x of order.current) if ((expanded.files && x.startsWith('file:')) || (expanded.found && x.startsWith('found:'))) seen.add(x);
    setAdded((n) => n + 1);
  }, [expanded]);

  const finished = !!report && done && g.complete;
  const view = useRef({ focus: 0, bare: true, finished: false });
  view.current = { focus: g.focus, bare: g.bare, finished };

  // The camera follows the column being filled, with its stage, or else the newest stage and its fan. A stage
  // with nothing in its fan yet (Sandbox while GitHub finds a machine) sits in the middle on its own. When the
  // run is over it rests on the end of the chain: the results, Results, and what it saved.
  const frame = (animate: boolean) => {
    const i = inst.current;
    const w = wrap.current?.clientWidth ?? 0;
    const h = wrap.current?.clientHeight ?? 0;
    if (!i || !w) return;
    const duration = animate && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 600 : 0;
    const z = Math.max(0.35, Math.min(0.85, h / 820, w / 1500));
    const { focus, bare, finished: end } = view.current;
    const from = end ? SX[4] : SX[COLS[focus].stage];
    const to = end ? CX[COLS.length - 1] + IW : bare ? from + SW : CX[focus] + IW;
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
  }, [g.focus, g.bare, finished]);

  // When the run is over and every box is in, light up the first possible bug (or broken test).
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
    const data = lane && n.type !== 'stage' && n.type !== 'ghost' ? { ...n.data, dim: !lane.has(n.id), sel: n.id === selected } : n.data;
    return { ...n, data, ...(measured ? { measured } : {}) };
  });
  const edges = g.edges.map((e) => {
    const tone = e.data!.tone;
    const color = LINE[tone] ?? LINE.done;
    const off = tone === 'wait' ? !!want : !!want && !e.data!.lanes.some((l) => want.has(l));
    return {
      ...e,
      type: 'default',
      focusable: false,
      style: { stroke: color, strokeWidth: 1.7, strokeDasharray: tone === 'skip' ? '5 5' : undefined, opacity: off ? 0.12 : tone === 'wait' ? 0.5 : 1, transition: 'opacity 200ms ease' },
      markerEnd: { type: MarkerType.ArrowClosed, color, width: 14, height: 14 },
    };
  });

  const choose = (n: FNode) => {
    if (n.type === 'ghost') return;
    if (n.type === 'more') return setExpanded((x) => ({ ...x, [n.id === 'more:files' ? 'files' : 'found']: true }));
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
      <div className="flow" ref={wrap} data-ui aria-label="The run as a flow diagram">
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
