import type { Analysis, Plan, Target, TestsFilter } from '../core/types.js';

const RISKY_NAME = /calc|total|price|tax|discount|parse|valid|format|convert|compute|score|sum|average|round|slug|sanitiz|merge|sort|filter|auth|permission/i;

function unitPriority(lines: number, params: number, name: string): Target['priority'] {
  let score = 0;
  if (lines > 15) score += 2;
  else if (lines > 5) score += 1;
  if (params >= 2) score += 1;
  if (RISKY_NAME.test(name)) score += 2;
  return score >= 3 ? 'high' : score >= 1 ? 'medium' : 'low';
}

const ORDER = { high: 0, medium: 1, low: 2 } as const;
const TYPE_ORDER = { unit: 0, e2e: 1, api: 2, load: 3 } as const;

export function buildPlan(a: Analysis, tests: TestsFilter = 'all'): Plan {
  const targets: Target[] = [];
  const canStart = !!a.boot.command;
  const noStart = 'could not find how to start the app';

  for (const f of a.functions) {
    const label = `${f.exportName === 'default' ? `${f.name} (default)` : f.name}() in ${f.file}`;
    if (f.isComponent) {
      targets.push({
        id: `unit:${f.id}`,
        type: 'unit',
        target: f.id,
        label,
        framework: 'vitest',
        priority: 'low',
        enabled: false,
        reason: 'UI component: needs AI mode or a component test adapter',
      });
      continue;
    }
    targets.push({
      id: `unit:${f.id}`,
      type: 'unit',
      target: f.id,
      label,
      framework: 'vitest',
      priority: unitPriority(f.lines, f.params.length, f.name),
      enabled: true,
      reason: f.callable
        ? undefined
        : `export check only: ${f.impureReasons[0] ?? 'no safe sample values for its parameters (AI mode can write real tests)'}`,
    });
  }

  for (const p of a.pages) {
    targets.push({
      id: `page:${p.route}`,
      type: 'e2e',
      target: p.route,
      label: `Page ${p.route}`,
      framework: 'playwright',
      priority: p.route === '/' ? 'high' : 'medium',
      enabled: canStart && !p.dynamic,
      reason: p.dynamic ? 'dynamic route: needs example parameters (AI mode)' : canStart ? undefined : noStart,
    });
  }

  for (const e of a.endpoints) {
    const simple = e.method === 'GET' && !e.dynamic;
    targets.push({
      id: `api:${e.method} ${e.path}`,
      type: 'api',
      target: `${e.method} ${e.path}`,
      label: `${e.method} ${e.path}`,
      framework: 'playwright',
      priority: 'medium',
      enabled: canStart && simple,
      reason: !simple ? 'needs a request body or path parameters (AI mode)' : canStart ? undefined : noStart,
    });
    if (e.method === 'GET') {
      targets.push({
        id: `load:${e.method} ${e.path}`,
        type: 'load',
        target: `${e.method} ${e.path}`,
        label: `Load test ${e.method} ${e.path}`,
        framework: 'k6',
        priority: 'low',
        enabled: false,
        reason: 'k6 load tests arrive in a later release',
      });
    }
  }

  const keep = (t: Target) =>
    tests === 'all' ||
    (tests === 'unit' && t.type === 'unit') ||
    (tests === 'e2e' && (t.type === 'e2e' || t.type === 'api')) ||
    (tests === 'load' && t.type === 'load');

  return {
    version: 1,
    createdAt: new Date().toISOString(),
    tests,
    targets: targets
      .filter(keep)
      .sort((x, y) => TYPE_ORDER[x.type] - TYPE_ORDER[y.type] || ORDER[x.priority] - ORDER[y.priority]),
  };
}

/** Let the user tick or untick targets. Only targets that can run are offered. */
export async function reviewPlan(plan: Plan): Promise<Plan> {
  const { checkbox } = await import('@inquirer/prompts');
  const runnable = plan.targets.filter((t) => t.enabled || !t.reason);
  if (runnable.length === 0) return plan;
  const picked = await checkbox({
    message: 'Pick what to test (space to toggle, enter to confirm)',
    pageSize: 20,
    choices: runnable.map((t) => ({
      name: `${t.type.padEnd(4)} ${t.priority.padEnd(6)} ${t.label}`,
      value: t.id,
      checked: t.enabled,
    })),
  });
  const chosen = new Set(picked);
  return {
    ...plan,
    targets: plan.targets.map((t) =>
      runnable.includes(t) ? { ...t, enabled: chosen.has(t.id), reason: chosen.has(t.id) ? t.reason : 'turned off in review' } : t,
    ),
  };
}
