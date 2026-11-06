<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/denmarkcrisostomo/Repeval/main/design/brand/logo-dark.svg">
    <img alt="Reval logo: the word Reval with a triangle for analyze, test and report" src="https://raw.githubusercontent.com/denmarkcrisostomo/Repeval/main/design/brand/logo-light.png" width="300">
  </picture>
</p>

# Repeval

**Repository + Evaluate.** Point Repeval at a JavaScript or TypeScript repo. It reads the code, writes unit and E2E tests, runs them, and gives you a report with a screenshot of every page.

```bash
npx repeval run ./my-app
```

No AI is needed for this version. AI mode (real assertions, user flows, self-healing tests) comes in a later release.

## What it does

```
① Collect files → ② Understand the repo → ③ Plan → ④ Make tests → ⑤ Run → ⑥ Results
```

| Step | What happens |
|---|---|
| ① Collect | Finds source files, skipping `node_modules`, build output and test files. |
| ② Understand | Detects the stack (Next.js, Vite, Express, NestJS, SvelteKit, Remix, React Router…), maps exported functions with ts-morph, finds pages and API endpoints, and works out how to start the app. |
| ③ Plan | Writes `.repeval/repeval-plan.json`: what to test, with which framework, at what priority. Anything it can't test yet is listed with a reason. |
| ④ Make tests | Writes Vitest and Playwright files into `.repeval/`. Your own files are never touched. |
| ⑤ Run | Installs dependencies if needed, starts your app, runs the tests. |
| ⑥ Results | `repeval-report/index.html`: a flow view built with React Flow, every test result, a screenshot gallery and the generated code. It works offline. |

### The tests it writes (no AI)

- **Unit (Vitest):** checks that every exported function exists. For functions that look pure (no network, file system, time, randomness…), it builds sample arguments from the TypeScript types and records a **baseline** of what each call returns. Later runs compare against that baseline, so a change in behavior shows up as a possible bug.
- **Pages (Playwright):** opens every page and checks that it returns status < 400, shows content and has no browser errors. Each page is screenshotted at desktop and mobile width.
- **API (Playwright):** checks that every simple `GET` endpoint answers without a 5xx.

### How results are sorted

| Status | Meaning |
|---|---|
| **Passed** | The test passed. |
| **Possible bug** | A valid test failed: a page threw an error, an endpoint returned 500, or a function's result changed. Repeval reports these and never weakens the test. |
| **Broken test** | The generated test itself couldn't run (for example, an import failed). |
| **Skipped** | Templates can't cover this yet (dynamic routes, POST bodies, React components, load tests). The reason is shown. |

## Commands

```bash
npx repeval run [dir]        # everything below, in order
npx repeval analyze [dir]    # ① ②  writes .repeval/analysis.json
npx repeval plan [dir]       # ③    --tests all|unit|e2e|load, -i to review in a checklist
npx repeval generate [dir]   # ④    writes tests into .repeval/
npx repeval test [dir]       # ⑤ ⑥  runs them and writes repeval-report/
npx repeval report [dir]     # rebuild the HTML report from the last run
npx repeval init [dir]       # add .github/workflows/repeval.yml
```

Useful options:

- `--fail-on possible-bug|broken|never` sets when the exit code is 1. The default is `possible-bug`.
- `--update-baselines` records new baselines after an intended change.
- `--no-install` skips installing dependencies when `node_modules` is missing.
- `--out <dir>` changes the report folder.

Both `.repeval/` and `repeval-report/` contain their own `.gitignore`, so they never show up in `git status`. To keep a generated test, copy it from `repeval-report/generated/` into your repo.

## Run it in GitHub Actions

```bash
npx repeval init
```

This adds `.github/workflows/repeval.yml`. Read it before committing:

- It only runs when started by hand, from the Actions tab or the Repeval website, never on push.
- It gets `contents: read` only.
- The Repeval version is pinned.
- AI keys (for later) come from your repo's own secrets.

The report is uploaded as a run artifact and kept for 7 days. After Analyze, Plan and Generate, the workflow also saves a small names-only progress file (file paths, routes, function names and skip reasons, no code) for one day, so the website can draw the run while it goes.

The Repeval website starts this workflow for you. Tests run on GitHub's machines, and the website has no permission to read your code.

## Limits of this version

- JavaScript and TypeScript only.
- No AI mode yet, so no real assertions, user-flow tests or self-healing.
- No k6 load tests yet; they are planned and shown as skipped.
- Dynamic routes (`/products/:id`), POST endpoints and React components are skipped.
- **Local runs execute your project's code on your machine**, just like `npm test` would. Use GitHub Actions mode to run untrusted repos on a throwaway VM.

## Development

```bash
npm install
npm run build      # CLI (tsup) + report UI (esbuild, React Flow)
npm test           # analyzer, planner, generators, parsers, and full CLI runs on examples/
```

`examples/` holds three small repos used by the tests:
- `ts-lib`: a TypeScript library;
- `express-app`: pages plus an API, with a deliberate browser error on `/cart`;
- `next-app`: structure only, used by the analyzer tests.

## License

MIT
