// The workflow file users add to their repo. Kept identical to templates/repeval.yml in the CLI
// (scripts/check-workflow.mjs fails the build if the two drift apart).
export const WORKFLOW_PATH = '.github/workflows/repeval.yml';
export const WORKFLOW_FILE = 'repeval.yml';
export const ARTIFACT_NAME = 'repeval-report';

export const WORKFLOW_YAML = `# .github/workflows/repeval.yml
# Repeval generates and runs tests for this repo.
# It only runs when you start it (from the Actions tab or the Repeval website).
name: Repeval

on:
  workflow_dispatch:
    inputs:
      ai:
        description: AI provider
        type: choice
        options: [none, anthropic, openai]
        default: none
      tests:
        description: Which tests
        type: choice
        options: [all, unit, e2e, load]
        default: all

permissions:
  contents: read

concurrency:
  group: repeval
  cancel-in-progress: true

jobs:
  repeval:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          persist-credentials: false

      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Analyze
        run: npx --yes repeval@0.1.0 analyze

      - name: Plan
        run: npx --yes repeval@0.1.0 plan --tests "$TESTS"
        env:
          TESTS: \${{ inputs.tests }}

      - name: Generate
        run: npx --yes repeval@0.1.0 generate --ai "$AI"
        env:
          AI: \${{ inputs.ai }}
          ANTHROPIC_API_KEY: \${{ secrets.ANTHROPIC_API_KEY }}
          OPENAI_API_KEY: \${{ secrets.OPENAI_API_KEY }}

      - name: Test
        run: npx --yes repeval@0.1.0 test
        env:
          AI: \${{ inputs.ai }}
          ANTHROPIC_API_KEY: \${{ secrets.ANTHROPIC_API_KEY }}
          OPENAI_API_KEY: \${{ secrets.OPENAI_API_KEY }}

      - name: Save report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: repeval-report
          path: repeval-report/
          include-hidden-files: false
          retention-days: 7
`;

/** GitHub's own "new file" page with the workflow filled in. The user reads it and commits it themselves. */
export function newFileUrl(owner: string, repo: string, branch: string): string {
  const q = new URLSearchParams({ filename: WORKFLOW_PATH, value: WORKFLOW_YAML });
  return `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/new/${encodeURIComponent(branch)}?${q}`;
}
