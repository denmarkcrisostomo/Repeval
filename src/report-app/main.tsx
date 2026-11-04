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
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { ReportData, Stage } from '../core/report';
import type { TestResult } from '../core/types';
import './styles.css';

declare global {
  interface Window {
    __REPEVAL__: ReportData;
  }
}

const data = window.__REPEVAL__;
const testsById = new Map(data.tests.map((t) => [t.id, t]));

const STATUS_LABEL: Record<TestResult['status'], string> = {
  passed: 'Passed',
  'possible-bug': 'Possible bug',
  broken: 'Broken test',
  skipped: 'Skipped',
};

const STAGE_LABEL: Record<Stage['status'], string> = {
  done: 'Done',
  warn: 'Needs a look',
  fail: 'Found problems',
  skipped: 'Skipped',
  off: 'Off',
};

/* ---------------- Flow ---------------- */

const COLS: Record<Stage['group'], number> = { input: 0, understand: 260, plan: 520, make: 780, run: 1040, results: 1300 };
const ROWS: Record<string, number> = {
  collect: 170,
  stack: 0,
  code: 115,
  routes: 230,
  boot: 345,
  plan: 170,
  templates: 95,
  ai: 250,
  unit: 30,
  e2e: 170,
  load: 310,
  report: 170,
};

type StageNode = Node<{ stage: Stage }, 'stage'>;

function StageCard({ data: { stage } }: NodeProps<StageNode>) {
  const c = stage.counts;
  return (
    <div className={`stage s-${stage.status} g-${stage.group}`}>
      <Handle type="target" position={Position.Left} isConnectable={false} />
      <div className="stage-top">
        <span className={`dot d-${stage.status}`} aria-hidden="true" />
        <span className="stage-state">{STAGE_LABEL[stage.status]}</span>
      </div>
      <div className="stage-title">{stage.label}</div>
      <div className="stage-detail">{stage.detail}</div>
      {c && (c.passed || c['possible-bug'] || c.broken) ? (
        <div className="stage-counts">
          {!!c.passed && <span className="pill p-passed">{c.passed} ✓</span>}
          {!!c['possible-bug'] && <span className="pill p-possible-bug">{c['possible-bug']} bug</span>}
          {!!c.broken && <span className="pill p-broken">{c.broken} broken</span>}
        </div>
      ) : null}
      <Handle type="source" position={Position.Right} isConnectable={false} />
    </div>
  );
}

const nodeTypes = { stage: StageCard };

function FlowView({ onOpen }: { onOpen: (t: TestResult) => void }) {
  const [selected, setSelected] = useState<string>(() => {
    const pick = (st: Stage['status']) => data.stages.find((s) => s.status === st && s.tests)?.id;
    return pick('fail') ?? pick('warn') ?? pick('done') ?? 'plan';
  });
  const nodes: StageNode[] = useMemo(
    () =>
      data.stages.map((s) => ({
        id: s.id,
        type: 'stage',
        position: { x: COLS[s.group], y: ROWS[s.id] ?? 0 },
        data: { stage: s },
        selected: s.id === selected,
      })),
    [selected],
  );
  const edges: Edge[] = useMemo(
    () =>
      data.edges.map((e) => ({
        id: `${e.from}-${e.to}`,
        source: e.from,
        target: e.to,
        className: e.kind ? `edge-${e.kind}` : undefined,
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
      })),
    [],
  );
  const stage = data.stages.find((s) => s.id === selected);
  const stageTests = (stage?.tests ?? []).map((id) => testsById.get(id)).filter((t): t is TestResult => !!t);

  return (
    <div className="flow-wrap">
      <div className="flow" data-card-flow>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.06 }}
          nodesDraggable={false}
          nodesConnectable={false}
          minZoom={0.3}
          colorMode="system"
          onNodeClick={(_, n) => setSelected(n.id)}
        >
          <Background gap={22} size={1.2} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
      {stage && (
        <aside className="stage-panel" aria-label="Step details">
          <div className="eyebrow">{stage.group}</div>
          <h2>{stage.label}</h2>
          <span className={`badge b-${stage.status}`}>{STAGE_LABEL[stage.status]}</span>
          <ul className="info">
            {stage.info.filter(Boolean).map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
          {stageTests.length > 0 && (
            <>
              <h3>Tests</h3>
              <ul className="mini-tests">
                {stageTests
                  .sort((a, b) => order(a.status) - order(b.status))
                  .map((t) => (
                    <li key={t.id}>
                      <button type="button" onClick={() => onOpen(t)}>
                        <span className={`dot d-${t.status}`} aria-hidden="true" />
                        <span className="mt-title">{t.title}</span>
                        <span className="mt-status">{STATUS_LABEL[t.status]}</span>
                      </button>
                    </li>
                  ))}
              </ul>
            </>
          )}
        </aside>
      )}
    </div>
  );
}

const order = (s: TestResult['status']) => ({ 'possible-bug': 0, broken: 1, passed: 2, skipped: 3 })[s];

/* ---------------- Tests ---------------- */

const SUITE_LABEL: Record<string, string> = { unit: 'Unit tests', e2e: 'Pages (E2E)', api: 'API checks', load: 'Load tests' };

function TestRow({ t, open, onToggle, onImage }: { t: TestResult; open: boolean; onToggle: () => void; onImage: (src: string) => void }) {
  const hasDetail = !!(t.message || t.note || t.screenshots.length || t.trace || t.video);
  return (
    <li className={`test t-${t.status}`}>
      <button type="button" className="test-head" onClick={onToggle} aria-expanded={open} disabled={!hasDetail}>
        <span className={`dot d-${t.status}`} aria-hidden="true" />
        <span className="test-title">{t.title}</span>
        {t.screenshots.length > 0 && <span className="test-meta">{t.screenshots.length} shots</span>}
        <span className="test-meta">{t.durationMs ? `${t.durationMs} ms` : ''}</span>
        <span className={`badge b-${t.status}`}>{STATUS_LABEL[t.status]}</span>
      </button>
      {open && hasDetail && (
        <div className="test-body">
          {t.note && <p className="note">{t.note}</p>}
          {t.message && <pre className="msg">{t.message}</pre>}
          {t.screenshots.length > 0 && (
            <div className="thumbs">
              {t.screenshots.map((s) => (
                <button type="button" key={s} onClick={() => onImage(s)} className="thumb">
                  <img src={s} alt={`Screenshot ${s.split('/').pop()}`} loading="lazy" />
                  <span>{s.split('/').pop()}</span>
                </button>
              ))}
            </div>
          )}
          {(t.trace || t.video) && (
            <p className="links">
              {t.trace && (
                <a href={t.trace}>
                  Playwright trace (open with <code>npx playwright show-trace</code>)
                </a>
              )}
              {t.video && <a href={t.video}>Video</a>}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

function TestsView({ focus, onImage }: { focus: string | null; onImage: (src: string) => void }) {
  const [filter, setFilter] = useState<'all' | TestResult['status']>('all');
  const [open, setOpen] = useState<Set<string>>(() => new Set(focus ? [focus] : []));
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const shown = data.tests.filter((t) => filter === 'all' || t.status === filter);
  const suites = ['unit', 'e2e', 'api', 'load'].filter((s) => shown.some((t) => t.suite === s));
  const filters: ('all' | TestResult['status'])[] = ['all', 'possible-bug', 'broken', 'passed', 'skipped'];

  return (
    <div className="tests">
      <div className="filters" role="group" aria-label="Filter tests">
        {filters.map((f) => (
          <button type="button" key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {f === 'all' ? `All ${data.summary.total}` : `${STATUS_LABEL[f]} ${data.summary[f]}`}
          </button>
        ))}
      </div>
      {data.suites
        .filter((s) => s.status === 'error')
        .map((s) => (
          <div className="suite-error" key={s.kind}>
            <strong>{s.framework} did not run.</strong>
            <pre className="msg">{s.message}</pre>
          </div>
        ))}
      {suites.map((suite) => (
        <section key={suite}>
          <h3>{SUITE_LABEL[suite]}</h3>
          <ul className="test-list">
            {shown
              .filter((t) => t.suite === suite)
              .sort((a, b) => order(a.status) - order(b.status))
              .map((t) => (
                <TestRow key={t.id} t={t} open={open.has(t.id)} onToggle={() => toggle(t.id)} onImage={onImage} />
              ))}
          </ul>
        </section>
      ))}
      {shown.length === 0 && <p className="empty">No tests with this status.</p>}
    </div>
  );
}

/* ---------------- Screenshots ---------------- */

function ShotsView({ onImage }: { onImage: (src: string) => void }) {
  const withShots = data.tests.filter((t) => t.screenshots.length);
  if (withShots.length === 0) return <p className="empty">No screenshots in this run. Screenshots come from E2E page tests.</p>;
  return (
    <div className="shots">
      {withShots.map((t) => (
        <section key={t.id} className="shot-group">
          <h3>
            <span className={`dot d-${t.status}`} aria-hidden="true" /> {t.title}
            <span className={`badge b-${t.status}`}>{STATUS_LABEL[t.status]}</span>
          </h3>
          <div className="shot-row">
            {t.screenshots.map((s) => (
              <button type="button" key={s} className="shot" onClick={() => onImage(s)}>
                <img src={s} alt={`${t.title}: ${s.split('/').pop()}`} loading="lazy" />
                <span>{s.split('/').pop()?.replace(/\.png$/, '')}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/* ---------------- Generated code ---------------- */

function CodeView() {
  const files = data.generated.filter((g) => g.code);
  const [current, setCurrent] = useState(files.find((f) => f.kind === 'unit' || f.kind === 'e2e')?.path ?? files[0]?.path);
  const file = files.find((f) => f.path === current);
  if (!file) return <p className="empty">No tests were generated.</p>;
  return (
    <div className="code">
      <nav aria-label="Generated files">
        {files.map((f) => (
          <button type="button" key={f.path} aria-pressed={f.path === current} onClick={() => setCurrent(f.path)}>
            <span className="fw">{f.framework}</span>
            {f.path.replace(/^\.repeval\//, '')}
          </button>
        ))}
      </nav>
      <div className="code-main">
        <p className="hint">
          Copies of these files are in the report's <code>generated/</code> folder. Move the ones you want to keep into your
          repo.
        </p>
        <pre>{file.code}</pre>
      </div>
    </div>
  );
}

/* ---------------- App ---------------- */

type Tab = 'flow' | 'tests' | 'shots' | 'code';

function App() {
  const [tab, setTab] = useState<Tab>('flow');
  const [focus, setFocus] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const s = data.summary;
  const verdict =
    s['possible-bug'] > 0
      ? { cls: 'fail', text: `${s['possible-bug']} possible bug${s['possible-bug'] === 1 ? '' : 's'} found` }
      : data.suites.some((x) => x.status === 'error')
        ? { cls: 'warn', text: 'Some tests could not run' }
        : s.broken > 0
          ? { cls: 'warn', text: `${s.broken} generated test${s.broken === 1 ? '' : 's'} need fixing` }
          : { cls: 'done', text: 'Everything that ran passed' };
  const shots = data.tests.reduce((n, t) => n + t.screenshots.length, 0);

  const openTest = (t: TestResult) => {
    setFocus(t.id);
    setTab('tests');
  };

  return (
    <>
      <div data-card>
        <header className="top">
          <div>
            <div className="eyebrow">Repeval report · {new Date(data.meta.generatedAt).toLocaleString()}</div>
            <h1>{data.meta.repo}</h1>
            <p className="sub">
              {[data.meta.stack.join(', '), data.meta.startCommand ? `started with ${data.meta.startCommand}` : null, `${(data.meta.durationMs / 1000).toFixed(1)} s`, `AI: ${data.meta.ai}`]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          <div className={`verdict v-${verdict.cls}`}>{verdict.text}</div>
        </header>
        <div className="kpis">
          <div className="kpi k-passed">
            <b>{s.passed}</b>passed
          </div>
          <div className="kpi k-possible-bug">
            <b>{s['possible-bug']}</b>possible bugs
          </div>
          <div className="kpi k-broken">
            <b>{s.broken}</b>broken tests
          </div>
          <div className="kpi k-skipped">
            <b>{s.skipped}</b>skipped
          </div>
          <div className="kpi">
            <b>{shots}</b>screenshots
          </div>
        </div>
      </div>

      <nav className="tabs" role="tablist">
        {(
          [
            ['flow', 'Flow'],
            ['tests', `Tests (${s.total})`],
            ['shots', `Screenshots (${shots})`],
            ['code', 'Generated tests'],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button type="button" role="tab" key={id} aria-selected={tab === id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>

      <main>
        {tab === 'flow' && <FlowView onOpen={openTest} />}
        {tab === 'tests' && <TestsView key={focus ?? 'all'} focus={focus} onImage={setImage} />}
        {tab === 'shots' && <ShotsView onImage={setImage} />}
        {tab === 'code' && <CodeView />}
      </main>

      {image && (
        <div className="lightbox" role="dialog" aria-label="Screenshot" onClick={() => setImage(null)}>
          <img src={image} alt={image} />
          <button type="button" className="close" onClick={() => setImage(null)}>
            Close
          </button>
        </div>
      )}
    </>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
