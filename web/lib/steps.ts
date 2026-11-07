// The workflow's steps as the run view uses them. The names match templates/repeval.yml;
// GitHub's own housekeeping steps ("Set up job", "Post Checkout"…) and the share steps are left out.
export interface StepInfo {
  key: string;
  /** Step name in the workflow file. */
  name: string;
  /** Which of the run flow's six stages it belongs to. */
  stage: string;
  /** Shown on the step's stage box while it runs. */
  doing: string;
  /** Plain-language explanation for the "What's happening" card. */
  explain: string;
}

export const STEPS: StepInfo[] = [
  { key: 'checkout', name: 'Checkout', stage: 'Sandbox', doing: 'copying your repo', explain: 'GitHub is copying your repo onto a fresh, temporary machine. Repeval never receives your code.' },
  { key: 'node', name: 'Set up Node', stage: 'Sandbox', doing: 'installing Node 22', explain: 'Installing Node.js 22 on that machine so your project can run.' },
  { key: 'analyze', name: 'Analyze', stage: 'Understand', doing: 'reading code', explain: 'Reading package.json and your code: the stack, every page and API endpoint, exported functions, and how to start the app.' },
  { key: 'plan', name: 'Plan', stage: 'Plan', doing: 'choosing tests', explain: 'Deciding what to test. Anything it cannot test yet is listed with the reason.' },
  { key: 'generate', name: 'Generate', stage: 'Make tests', doing: 'writing tests', explain: 'Writing test files: Vitest for your functions, Playwright for your pages and API.' },
  { key: 'test', name: 'Test', stage: 'Run', doing: 'opening pages', explain: 'Starting your app and opening every page in a real browser, with a screenshot of each one.' },
  { key: 'save', name: 'Save report', stage: 'Results', doing: 'uploading', explain: 'Saving the report in your repo for 7 days. The machine is then deleted.' },
];


export function findStep(name: string): StepInfo | undefined {
  return STEPS.find((s) => s.name.toLowerCase() === name.trim().toLowerCase());
}
