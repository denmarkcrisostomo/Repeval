import { describe, expect, it } from 'vitest';
import { classifyUnitFailure, parsePlaywright, parseVitest } from '../src/runner/parse.js';

describe('failure classification', () => {
  it('treats load and import errors as broken tests, assertion failures as possible bugs', () => {
    expect(classifyUnitFailure('Error: Failed to load url ../../src/x.ts')).toBe('broken');
    expect(classifyUnitFailure('TypeError: mod.foo is not a function')).toBe('broken');
    expect(classifyUnitFailure('AssertionError: Results changed since the recorded baseline')).toBe('possible-bug');
  });

  it('maps Vitest results back to plan targets', () => {
    const results = parseVitest(
      {
        testResults: [
          {
            name: '/repo/.repeval/tests/unit/src__cart.test.ts',
            status: 'failed',
            assertionResults: [
              { ancestorTitles: ['src/cart.ts'], title: 'loads without errors', fullName: 'a', status: 'passed', failureMessages: [] },
              {
                ancestorTitles: ['src/cart.ts', 'calcTotal()'],
                title: 'returns the same results as the recorded baseline',
                fullName: 'b',
                status: 'failed',
                failureMessages: ['AssertionError: Results changed since the recorded baseline'],
              },
              {
                ancestorTitles: ['src/strings.ts', 'capitalize() (default export)'],
                title: 'is exported as a function',
                fullName: 'c',
                status: 'passed',
                failureMessages: [],
              },
            ],
          },
          { name: '/repo/.repeval/tests/unit/src__bad.test.ts', status: 'failed', message: 'SyntaxError: Unexpected token', assertionResults: [] },
        ],
      },
      (f) => (f.includes('cart') ? 'src/cart.ts' : f.includes('bad') ? 'src/bad.ts' : undefined),
    );
    expect(results.map((r) => [r.title, r.target, r.status])).toEqual([
      ['src/cart.ts › loads without errors', undefined, 'passed'],
      ['calcTotal() › returns the same results as the recorded baseline', 'unit:src/cart.ts#calcTotal', 'possible-bug'],
      ['capitalize() (default export) › is exported as a function', 'unit:src/cart.ts#default', 'passed'],
      ['src/bad.ts loads', undefined, 'broken'],
    ]);
  });

  it('reads Playwright annotations and statuses', () => {
    const parsed = parsePlaywright({
      suites: [
        {
          title: 'pages.spec.ts',
          suites: [],
          specs: [
            {
              title: 'page /cart loads',
              file: 'pages.spec.ts',
              tests: [
                {
                  status: 'unexpected',
                  annotations: [{ type: 'repeval-target', description: 'page:/cart' }],
                  results: [{ status: 'failed', duration: 812, error: { message: 'Error: browser errors on this page: boom' }, attachments: [] }],
                },
              ],
            },
          ],
        },
      ],
    });
    expect(parsed[0]).toMatchObject({ target: 'page:/cart', status: 'possible-bug', durationMs: 812 });
  });
});
